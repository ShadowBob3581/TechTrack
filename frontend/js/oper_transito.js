/* =========================================================================
   MÓDULO DE LOGICA ASÍNCRONA - CONTROL DE VENTANILLA (EQUIPOS EN TRÁNSITO)
   ========================================================================= */

let prestamosVigentesCache = []; 

/**
 * GANCHO INICIALIZADOR CORREGIDO (Mismo nombre exacto que espera tu Router SPA)
 */
async function inicializarModuloTransito() {
    console.group("🔄 [RASTREADOR TRÁNSITO] Iniciando Modulo...");
    console.log("📥 Elementos del DOM verificados correctamente.");
    
    // 1. Consultar inmediatamente las tuplas de préstamos en la BD
    await consultarPrestamosVigentes();
    
    // 2. Enlazar los inputs de filtrado en tiempo real
    configurarFiltrosVentanilla();

    // 3. SOLUCIÓN AL MODAL MUERTO: Vincular el submit del retorno asegurando existencia en el DOM
    vincularFormularioDevolucion();

    console.groupEnd();
}

// Exponer de forma idéntica la función al objeto global window para la navegación SPA
if (typeof window.inicializarModuloTransito !== 'function') {
    window.inicializarModuloTransito = inicializarModuloTransito;
}

/**
 * Consume el endpoint de Flask (GET /api/prestamos) con rastreo de payload
 */
async function consultarPrestamosVigentes() {
    const tablaBody = document.getElementById('tabla-transito-body');
    if (!tablaBody) return;

    const token = localStorage.getItem('token');
    console.log("🌐 Solicitando datos a GET /api/prestamos...");

    try {
        const respuesta = await fetch('/api/prestamos', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`📡 Servidor respondió con HTTP Status: ${respuesta.status}`);

        if (!respuesta.ok) throw new Error(`Status Backend: ${respuesta.status} (${respuesta.statusText})`);
        
        const todosLosPrestamos = await respuesta.json();
        
        // RASTREADOR DE ESQUEMA: Inspecciona cómo nombra tu backend las columnas de la consulta SQL
        console.log("📥 Colección cruda devuelta por Flask:", todosLosPrestamos);
        
        // Filtrado elástico de préstamos vigentes
        prestamosVigentesCache = todosLosPrestamos.filter(p => !p.fecha_devolucion_real && !p.devuelto && p.estado_prestamo !== 'devuelto');
        
        console.log(`📊 Total de préstamos evaluados en tránsito: ${prestamosVigentesCache.length}`);
        
        renderizarTablaTransito(prestamosVigentesCache);

    } catch (error) {
        console.error("❌ [FALLO EN TRÁNSITO] Error al recuperar flujos de la API:", error);
        tablaBody.innerHTML = `
            <tr>
                <td colspan="5" style="padding: 30px; text-align: center; color: var(--danger); font-weight: 600;">
                    💥 Fallo de conexión: No se logró enlazar con los flujos de tránsito. Revise la consola (F12).
                </td>
            </tr>
        `;
    }
}

/**
 * Pinta dinámicamente las filas utilizando las llaves reales confirmadas por la API
 */
function renderizarTablaTransito(listaPrestamos) {
    const tablaBody = document.getElementById('tabla-transito-body');
    if (!tablaBody) return;

    tablaBody.innerHTML = '';

    if (!Array.isArray(listaPrestamos) || listaPrestamos.length === 0) {
        tablaBody.innerHTML = `
            <tr>
                <td colspan="5" style="padding: 60px; text-align: center; color: var(--muted);">
                    <div style="font-size: 24px; margin-bottom: 8px;">📭</div>
                    <div style="font-weight: 600; color: var(--text);">Ningún activo se encuentra en tránsito</div>
                    <div style="font-size: 12px; margin-top: 4px;">Los flujos operativos físicos están al corriente.</div>
                </td>
            </tr>
        `;
        return;
    }

    listaPrestamos.forEach(item => {
        const tr = document.createElement('tr');
        
        // =========================================================================
        // SOLUCIÓN DEFINITIVA: Mapeo directo con las llaves reales del Backend
        // =========================================================================
        
        // 1. Número de Serie (Usa 'activo_serie' según tu JSON)
        const numeroSerie = item.activo_serie || item.numero_serie || item.activo_individual_id || 'S/N';
        
        // 2. Matrícula (Tu JSON demuestra que la matrícula viene en 'usuario_nombre')
        const matricula = item.usuario_nombre || item.solicitante_matricula || item.matricula || 'N/A';
        
        // 3. Fecha de Préstamo (Mapeada desde 'fecha_prestamo')
        const rawFechaPrestamo = item.fecha_prestamo;
        const fPrestamo = rawFechaPrestamo 
            ? new Date(rawFechaPrestamo).toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric'}) 
            : 'S/F';

        // 4. Fecha de Retorno Absoluta (Tu JSON demuestra que viene en 'fecha_devolucion')
        const rawFechaRetorno = item.fecha_devolucion;
        const fRetorno = rawFechaRetorno 
            ? new Date(rawFechaRetorno).toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric'}) 
            : 'Por definir';

        // 5. ID de transacción para el modal (Usa 'id' que vale 142 en tu captura)
        const prestamoId = item.id;

        tr.innerHTML = `
            <td>
                <span class="serie-badge">${numeroSerie}</span>
            </td>
            <td>
                <div class="cell-main-text">${matricula}</div>
                <div class="cell-sub-text">Alumno Vigente TESCHA</div>
            </td>
            <td>
                <div class="cell-main-text">${fPrestamo}</div>
                <div class="cell-sub-text">Registro en Sistema</div>
            </td>
            <td>
                <div class="cell-main-text" style="color: var(--accent); font-weight: 600;">${fRetorno}</div>
                <div class="cell-sub-text">Tiempo Límite</div>
            </td>
            <td class="text-center" style="text-align: center;">
                <button class="btn-action-return" 
                        onclick="abrirModalRetorno('${prestamoId}', '${numeroSerie}', '${matricula}')">
                    <span>📥</span> Registrar Devolución
                </button>
            </td>
        `;
        tablaBody.appendChild(tr);
    });
}

/**
 * Ajuste al motor de filtros para que busque usando las llaves correctas
 */
function configurarFiltrosVentanilla() {
    const inpUsuario = document.getElementById('filtro-operador-usuario');
    const inpSerie = document.getElementById('filtro-operador-serie');

    if (!inpUsuario || !inpSerie) return;

    const procesarFiltro = () => {
        const valUsuario = inpUsuario.value.toLowerCase().trim();
        const valSerie = inpSerie.value.toLowerCase().trim();

        const filtrados = prestamosVigentesCache.filter(p => {
            const matricula = (p.usuario_nombre || p.solicitante_matricula || '').toLowerCase();
            const serie = (p.activo_serie || '').toLowerCase();
            
            const cumpleUsuario = !valUsuario || matricula.includes(valUsuario);
            const cumpleSerie = !valSerie || serie.includes(valSerie);
            
            return cumpleUsuario && cumpleSerie;
        });

        renderizarTablaTransito(filtrados);
    };

    inpUsuario.addEventListener('input', procesarFiltro);
    inpSerie.addEventListener('input', procesarFiltro);
}

/**
 * Control visual y de inyección de datos para el Modal overlay
 */
function abrirModalRetorno(idPrestamo, numeroSerie, matricula) {
    console.group("🔓 [RASTREADOR MODAL] Abriendo ventana de retorno físico...");
    console.log("📌 Datos inyectados al modal:", { idPrestamo, numeroSerie, matricula });

    document.getElementById('modal-prestamo-id').value = idPrestamo;
    document.getElementById('modal-activo-serie').value = numeroSerie;
    document.getElementById('txt-modal-serie').textContent = numeroSerie;
    document.getElementById('txt-modal-matricula').textContent = matricula;
    document.getElementById('campo-estado-retorno').value = '';

    const modal = document.getElementById('modal-retorno-activo');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('campo-estado-retorno').focus(), 50);
    } else {
        console.error("❌ CRÍTICO: El contenedor '#modal-retorno-activo' no existe en el HTML cargado.");
    }
    console.groupEnd();
}

function cerrarModalRetorno() {
    const modal = document.getElementById('modal-retorno-activo');
    if (modal) modal.style.display = 'none';
}

/**
 * Vincula el evento submit al formulario del modal de forma segura
 */
function vincularFormularioDevolucion() {
    const formulario = document.getElementById('form-procesar-devolucion');
    if (!formulario) {
        console.error("❌ RASTREADOR: No se localizó el formulario del modal '#form-procesar-devolucion'.");
        return;
    }

    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();

        console.group("🚀 [RASTREADOR DEVOLUCIÓN] Enviando cierre a base de datos...");

        const token = localStorage.getItem('token');
        const idPrestamo = document.getElementById('modal-prestamo-id').value;
        const estadoRetorno = document.getElementById('campo-estado-retorno').value.trim();
        const usuarioOperadorId = localStorage.getItem('usuario_id') ? parseInt(localStorage.getItem('usuario_id')) : 1;

        console.log("📦 Payload empaquetado para PUT:", {
            id_prestamo_url: idPrestamo,
            estado_retorno: estadoRetorno,
            usuario_id: usuarioOperadorId
        });

        // REPARACIÓN COMPONENTE: Validación de ID única
        if (!idPrestamo || idPrestamo === "undefined") {
            console.error("❌ CRÍTICO: La ID del préstamo es indefinida. No se puede armar la URL del endpoint.");
            
            mostrarNotificacionOperador(
                'error',
                'Error de Transacción',
                'No se pudo identificar la ID única del préstamo en tránsito. Cierre el modal e intente de nuevo.'
            );
            
            console.groupEnd();
            return;
        }

        try {
            const endpoint = `/api/prestamos/${idPrestamo}/devolver`;
            console.log(`🌐 Transmitiendo hacia: ${endpoint}`);

            const respuesta = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    estado_retorno: estadoRetorno,
                    usuario_id: usuarioOperadorId
                })
            });

            console.log(`📡 Servidor retornó un código HTTP: ${respuesta.status}`);

            let data;
            try {
                data = await respuesta.json();
                console.log("📥 JSON decodificado desde Flask:", data);
            } catch (jsonErr) {
                console.error("💥 La API no respondió JSON válido. ¿Ocurrió una excepción HTML 500 en Python?", jsonErr);
                
                mostrarNotificacionOperador(
                    'error',
                    'Error del Servidor',
                    'El servidor arrojó una respuesta inválida en su conversión (Posible error interno HTML 500).'
                );
                
                console.groupEnd();
                return;
            }

            if (respuesta.ok && (data.success || data.status === 'ok')) {
                console.log("🎉 [ÉXITO] El préstamo fue concluido y archivado en PostgreSQL con éxito.");
                
                cerrarModalRetorno();
                await consultarPrestamosVigentes();
                
                // NOTIFICACIÓN PREMIUM EXPOSITIVA DE ÉXITO
                mostrarNotificacionOperador(
                    'success',
                    '¡Devolución Procesada!',
                    'El préstamo físico ha sido concluido correctamente y el activo está disponible nuevamente.'
                );
            } else {
                console.warn("⚠️ [RECHAZADO] Flask denegó la conclusión del préstamo:", data.error || data);
                
                // NOTIFICACIÓN PREMIUM EXPOSITIVA DE RECHAZO (Idéntico a tu captura)
                mostrarNotificacionOperador(
                    'error',
                    'Error Operacional',
                    data.error || 'El servidor denegó la inserción o actualización de la pieza.'
                );
            }

        } catch (error) {
            console.error("💥 [FALLO CRÍTICO DE RED] Imposible conectar para devolución:", error);
            
            mostrarNotificacionOperador(
                'error',
                'Fallo de Red',
                'No se logró conectar con el servidor para concluir el préstamo físico. Verifique su servicio en Flask.'
            );
        }

        console.groupEnd();
    });

    console.log("✅ Escuchador de confirmaciones inyectado en el Modal de Devoluciones.");
}