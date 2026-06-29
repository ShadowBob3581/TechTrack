/* =========================================================================
   MÓDULO DE LOGICA ASÍNCRONA - INCIDENCIAS Y DESVÍOS A MANTENIMIENTO
   ========================================================================= */

// El caché local ahora se llenará exclusivamente con lo que responda la Base de Datos
let incidenciasTurnoLocal = [];

/**
 * Gancho inicializador disparado por el router maestro (oper_main.js) al cargar #incidencias
 */
async function inicializarModuloIncidencias() {
    console.log("🛠️ [VENTANILLA] Inicializando gestor preventivo de incidencias...");
    
    // 1. Cargar desde la base de datos antes de pintar la tabla
    await consultarActivosEnMantenimiento();
    
    // 2. Configurar el formulario de envío
    configurarFormularioIncidencia();
}

// Exponer la función al objeto global window para el Router SPA
if (typeof window.inicializarModuloIncidencias !== 'function') {
    window.inicializarModuloIncidencias = inicializarModuloIncidencias;
}

/**
 * CONSULTA REAL A LA BD: Trae los activos y filtra los que están en mantenimiento
 */
async function consultarActivosEnMantenimiento() {
    const token = localStorage.getItem('token');
    console.log("🌐 Consultando catálogo de incidencias en GET /api/activos...");

    try {
        const respuesta = await fetch('/api/activos', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error(`Status API: ${respuesta.status}`);
        const todosLosActivos = await respuesta.json();

        // Mapeamos y filtramos únicamente los equipos que la base de datos reporta en taller o mantenimiento
        incidenciasTurnoLocal = todosLosActivos.filter(a => 
            a.estado === 'mantenimiento' || a.estado_activo === 'mantenimiento'
        );

        console.log(`📊 Activos recuperados en mantenimiento: ${incidenciasTurnoLocal.length}`);
        renderizarTablaIncidencias();

    } catch (error) {
        console.error("❌ Error al cargar activos en mantenimiento:", error);
        const tablaBody = document.getElementById('tabla-incidencias-body');
        if (tablaBody) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="3" style="padding: 24px; text-align: center; color: #e74c3c; font-weight: 600;">
                        💥 Error al sincronizar historial de taller con la base de datos.
                    </td>
                </tr>
            `;
        }
    }
}

/**
 * Pinta los registros reales de la Base de Datos en la tabla de control
 */
function renderizarTablaIncidencias() {
    const tablaBody = document.getElementById('tabla-incidencias-body');
    if (!tablaBody) return;

    tablaBody.innerHTML = '';

    if (!Array.isArray(incidenciasTurnoLocal) || incidenciasTurnoLocal.length === 0) {
        tablaBody.innerHTML = `
            <tr>
                <td colspan="3" style="padding: 24px; text-align: center; color: var(--muted);">
                    ✨ No se han registrado incidencias o equipos en taller actualmente.
                </td>
            </tr>
        `;
        return;
    }

    incidenciasTurnoLocal.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.style.transition = 'background-color 0.2s';
        
        // Mapeo seguro utilizando las llaves reales observadas en tu API de activos
        const numeroSerie = item.numero_serie || item.activo_serie || 'S/N';
        const detalleFalla = item.descripcion_falla || item.detalles || 'Revisión preventiva por operador';

        tr.innerHTML = `
            <td style="padding: 10px; font-weight: 600; color: var(--text);">${numeroSerie}</td>
            <td style="padding: 10px; color: var(--muted); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${detalleFalla}">${detalleFalla}</td>
            <td style="padding: 10px; text-align: right;"><span style="color: #ff9f43; font-weight: 500;">🔧 Taller</span></td>
        `;
        tablaBody.appendChild(tr);
    });
}

/**
 * Enlaza el evento submit para procesar el cambio de estado físico del equipo
 */
function configurarFormularioIncidencia() {
    const formulario = document.getElementById('form-registro-incidencia');
    if (!formulario) return;

    // Removemos duplicados de listeners reconstruyendo el nodo de manera limpia
    const nuevoFormulario = formulario.cloneNode(true);
    formulario.parentNode.replaceChild(nuevoFormulario, formulario);

    nuevoFormulario.addEventListener('submit', async (e) => {
        e.preventDefault();

        const token = localStorage.getItem('token');
        const numeroSerie = document.getElementById('inc-numero-serie').value.trim().toUpperCase();
        const descripcionFalla = document.getElementById('inc-descripcion-falla').value.trim();

        // Validación visual antes del envío
        if (!numeroSerie || !descripcionFalla) {
            mostrarNotificacionOperador(
                'error',
                'Campos Incompletos',
                'Por favor escribe el número de serie y detalla el daño físico encontrado.'
            );
            return;
        }

        try {
            console.log(`🌐 Transmitiendo desvío a taller para la serie: ${numeroSerie}...`);
            
            // Pasarela: Actualizar el estado del activo en el backend de Flask
            const respuesta = await fetch(`/api/activos/${numeroSerie}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    estado: 'mantenimiento',
                    detalles_falla: descripcionFalla // Enviamos la descripción para que Flask la guarde
                })
            });

            let data;
            try {
                data = await respuesta.json();
            } catch (err) {
                throw new Error("La respuesta del servidor no es un JSON válido.");
            }

            if (respuesta.ok && (data.success || data.status === 'ok')) {
                
                // REFRESCADO EN TIEMPO REAL: Re-consultamos la base de datos para ver reflejado el cambio
                await consultarActivosEnMantenimiento();
                
                nuevoFormulario.reset();

                // NOTIFICACIÓN PREMIUM CON SWEETALERT2 DARK
                mostrarNotificacionOperador(
                    'success',
                    'Reporte Confirmado',
                    `El equipo ${numeroSerie} fue bloqueado y movido al taller. El Administrador verá los cambios en su panel.`
                );
            } else {
                mostrarNotificacionOperador(
                    'error',
                    'Error Operacional',
                    data.error || data.message || 'No se localizó el número de serie en el inventario de TESCHA.'
                );
            }

        } catch (error) {
            console.error("💥 [INCIDENCIAS] Error de red al reportar daño:", error);
            mostrarNotificacionOperador(
                'error',
                'Fallo de Red',
                'No se logró conectar con el servidor. Asegúrese de que el backend de Flask esté activo.'
            );
        }
    });
}