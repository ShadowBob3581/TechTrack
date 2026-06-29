// frontend/js/prestamos.js

// Cache local de datos para optimizar búsquedas y filtrados instantáneos
let listadoPrestamos = [];
let activosDisponibles = [];

// Recuperar metadata del usuario desde localStorage para homogeneizar sesión
const sessionUser = JSON.parse(localStorage.getItem('usuario') || '{}');
const userSessionId = localStorage.getItem('user_id') || sessionUser.id || 1;

// 🚀 FUNCIÓN DESPERTADOR PARA MAIN.JS
function inicializarModuloPrestamos() {
    console.log("📦 Inicializador del módulo de Préstamos invocado.");
    cargarModuloPrestamos();
}

// CONEXIÓN ASÍNCRONA CON LA API (UNIFICADA Y CORREGIDA)
async function cargarModuloPrestamos() {
    try {
        // 🚀 Uso estricto de window.API y Promise.all para consultas simultáneas
        const [prestamosRes, activosRes] = await Promise.all([
            fetch(`${window.API}/prestamos`).then(r => {
                if (!r.ok) throw new Error("Error al traer préstamos");
                return r.json();
            }),
            fetch(`${window.API}/activos`).then(r => {
                if (!r.ok) throw new Error("Error al traer activos");
                return r.json();
            })
        ]);

        // Guardamos en la caché de ámbito global
        listadoPrestamos = prestamosRes || [];
        activosDisponibles = (activosRes || []).filter(a => a.estado === 'disponible');

        // Evaluar parámetros de URL en caso de redirecciones desde el Dashboard
        const parametrosURL = new URLSearchParams(window.location.search);
        const filtroSolicitado = parametrosURL.get('filter');

        const btnVencido = document.getElementById('btnFilterVencido');

        // CORREGIDO: Homologado a 'vencido' en singular para coincidir con el backend
        if (filtroSolicitado === 'vencidos' && btnVencido) {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            btnVencido.classList.add('active');
            filtrarPrestamos('vencido', btnVencido, false);
        } else {
            renderizarTablaPrestamos(listadoPrestamos);
        }

    } catch (error) {
        console.error("[ERROR] prestamos.cargarModuloPrestamos:", error);
        const contenedor = document.getElementById('tablaWrap');
        if (contenedor) {
            contenedor.innerHTML = `<div class="loading" style="color: var(--danger)">Error al sincronizar datos con el servidor: ${error.message}</div>`;
        }
    }
}

// LÓGICA DE DETECCIÓN DE FECHAS LÍMITE
function calcularEstadoPrestamo(registro) {
    if (registro.fecha_devolucion_real) return 'devuelto';
    
    // Comparar fecha límite contra el tiempo actual del sistema o usar el estado precalculado del Backend
    if (registro.estado === 'vencido') return 'vencido';

    const limite = new Date(registro.fecha_devolucion);
    const ahora = new Date();
    
    return (limite < ahora) ? 'vencido' : 'activo';
}

// RENDERIZADOR DINÁMICO DE TABLA
function renderizarTablaPrestamos(datos) {
    const contenedor = document.getElementById('tablaWrap');
    if (!contenedor) return;

    if (!datos || datos.length === 0) {
        contenedor.innerHTML = '<div class="loading" style="color: var(--text-muted)">No se registran préstamos bajo este criterio de búsqueda.</div>';
        return;
    }

    const filasHTML = datos.map(p => {
        const estado = calcularEstadoPrestamo(p);
        
        // Formateo del botón de acción usando la clase estilizada .btn-return-action
        const accionBoton = (estado !== 'devuelto') 
            ? `<button class="btn-return-action" onclick="abrirDev(${p.id})">Retorno</button>` 
            : `<span style="color: var(--muted, #64748b); font-size: 12px;">Completado</span>`;

        // Parseo estético de fechas con hora para mayor precisión en laboratorios
        const fPrestamo = new Date(p.fecha_prestamo).toLocaleDateString('es-MX');
        const fPrevista = new Date(p.fecha_devolucion).toLocaleDateString('es-MX');

        return `
            <tr>
                <td><strong>#${p.id}</strong></td>
                <td>
                    <div style="font-weight: 600; color: #ffffff;">${p.activo_nombre || 'Equipo Tecnológico'}</div>
                    <div style="color: #64748b; font-size: 11px; margin-top: 2px;">N/S: ${p.activo_serie || 'S/N'}</div>
                </td>
                <td><code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color: #3b82f6;">${p.usuario_nombre || p.solicitante_matricula}</code></td>
                <td>${p.operador_nombre || 'Sistema'}</td>
                <td>${fPrestamo}</td>
                <td>${fPrevista}</td>
                <td><span class="badge ${estado}">${estado.toUpperCase()}</span></td>
                <td>${accionBoton}</td>
            </tr>
        `;
    }).join('');

    contenedor.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Activo Tecnológico</th>
                    <th>Matrícula</th>
                    <th>Gestionó</th>
                    <th>Préstamo</th>
                    <th>Límite Retorno</th>
                    <th>Estado</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>
                ${filasHTML}
            </tbody>
        </table>
    `;
}

// FILTRADO INMEDIATO EN CLIENTE (Reactivo desde pestañas)
function filtrarPrestamos(categoria, botonElemento, limpiarURL = true) {
    if (limpiarURL && window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    botonElemento.classList.add('active');

    if (categoria === 'todos') {
        renderizarTablaPrestamos(listadoPrestamos);
    } else {
        const filtrados = listadoPrestamos.filter(p => calcularEstadoPrestamo(p) === categoria);
        renderizarTablaPrestamos(filtrados);
    }
}

// CONTROL DE MODAL: NUEVA SALIDA
function abrirModal() {
    const overlay = document.getElementById('overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    document.getElementById('msgModal').textContent = '';
    document.getElementById('msgModal').className = 'msg-modal';
    
    const modalSelect = document.getElementById('fActivo');
    const btnGuardar = document.getElementById('btnGuardarPrestamo');
    
    if (activosDisponibles.length === 0) {
        modalSelect.innerHTML = `<option value="">[ No hay equipos disponibles en almacén ]</option>`;
        modalSelect.disabled = true;
        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.style.opacity = "0.4";
        }
        return;
    }

    modalSelect.disabled = false;
    if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.style.opacity = "1";
    }
    
    modalSelect.innerHTML = activosDisponibles.map(a => `
        <option value="${a.id}">${a.nombre} (N/S: ${a.numero_serie || 'S/N'})</option>
    `).join('');

    // Preconfigurar fecha límite de entrega sugerida (+3 días estándar escolares)
    const fechaSugerida = new Date(); 
    fechaSugerida.setDate(fechaSugerida.getDate() + 3);
    
    const año = fechaSugerida.getFullYear();
    const mes = String(fechaSugerida.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaSugerida.getDate()).padStart(2, '0');
    const hora = String(fechaSugerida.getHours()).padStart(2, '0');
    const minutos = String(fechaSugerida.getMinutes()).padStart(2, '0');
    
    document.getElementById('fFecha').value = `${año}-${mes}-${dia}T${hora}:${minutos}`;
}

function cerrarModal() { 
    document.getElementById('overlay').style.display = 'none'; 
}

// GUARDAR NUEVA SALIDA (POST)
async function guardar() {
    const activoId = parseInt(document.getElementById('fActivo').value);
    const matricula = document.getElementById('fMatricula').value.trim();
    const fechaPrevista = document.getElementById('fFecha').value;
    const msg = document.getElementById('msgModal');

    if (!activoId || !matricula || !fechaPrevista) {
        msg.className = 'msg-modal error';
        msg.style.color = '#ef4444';
        msg.textContent = 'Por favor, complete todos los campos del formulario.';
        return;
    }

    const payload = {
        activo_id: activoId,
        usuario_operador_id: parseInt(userSessionId), 
        solicitante_matricula: matricula,
        fecha_devolucion_prevista: fechaPrevista
    };

    try {
        const respuesta = await fetch(`${window.API}/prestamos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const resultado = await respuesta.json();

        if (resultado.success || resultado.id) {
            msg.style.color = '#34d399';
            msg.textContent = '✓ Transacción de préstamo guardada con éxito.';
            setTimeout(() => {
                cerrarModal();
                document.getElementById('fMatricula').value = '';
                cargarModuloPrestamos();
            }, 800);
        } else {
            msg.style.color = '#ef4444';
            msg.textContent = resultado.error || 'No se pudo procesar el préstamo.';
        }
    } catch (e) {
        console.error(e);
        msg.style.color = '#ef4444';
        msg.textContent = 'Error de comunicación: El servidor no responde.';
    }
}

// CONTROL DE MODAL: RETORNO DE ACTIVO
function abrirDev(id) {
    document.getElementById('devId').value = id;
    document.getElementById('msgDev').textContent = '';
    document.getElementById('overlayDev').style.display = 'flex';
}

function cerrarDev() { 
    document.getElementById('overlayDev').style.display = 'none'; 
}

// GUARDAR RETORNO / DEVOLUCIÓN (PUT)
async function guardarDev() {
    const id = document.getElementById('devId').value;
    const observaciones = document.getElementById('fRetorno').value;
    const msg = document.getElementById('msgDev');

    try {
        const respuesta = await fetch(`${window.API}/prestamos/${id}/devolver`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estado_retorno: observaciones,
                usuario_id: parseInt(userSessionId)
            })
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            msg.style.color = '#34d399';
            msg.textContent = '✓ Retorno procesado. Inventario y bitácora actualizados.';
            setTimeout(() => {
                cerrarDev();
                cargarModuloPrestamos();
            }, 800);
        } else {
            msg.style.color = '#ef4444';
            msg.textContent = resultado.error || 'Ocurrió un inconveniente al cerrar el préstamo.';
        }
    } catch (e) {
        console.error(e);
        msg.style.color = '#ef4444';
        msg.textContent = 'Error de enlace de red con la API.';
    }
}