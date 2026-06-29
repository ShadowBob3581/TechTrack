/* =========================================================================
   🕵️ CONTROLADOR DE LA CAJA NEGRA Y AUDITORÍA REFACTORIZADO (auditoria.js)
   ========================================================================= */

let listaRegistrosAuditoria = [];

function inicializarModuloHistorial() {
    console.log("📋 Inicializador del módulo de Auditoría unificado e invocado.");
    cargarModuloAuditoria(); 
}

async function cargarModuloAuditoria() {
    const tabla = document.getElementById('tabla-logs-auditoria');
    if (!tabla) return;

    const baseAPI = window.API || '/api';
    const token = localStorage.getItem('token');

    try {
        tabla.innerHTML = `
            <tr>
                <td colspan="5" class="loading">
                    🔄 Sincronizando firmas digitales de la base de datos...
                </td>
            </tr>`;

        const respuesta = await fetch(`${baseAPI}/auditoria/logs`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!respuesta.ok) throw new Error("Fallo al obtener historial de logs periciales.");
        
        listaRegistrosAuditoria = await respuesta.json();
        
        if (listaRegistrosAuditoria.error) {
            tabla.innerHTML = `<tr><td colspan="5" class="loading" style="color: var(--danger);">Error: ${listaRegistrosAuditoria.error}</td></tr>`;
            return;
        }

        renderizarTablaAuditoria(listaRegistrosAuditoria);
    } catch (error) {
        console.error("[ERROR] auditoria.cargarModuloAuditoria:", error);
        tabla.innerHTML = `
            <tr>
                <td colspan="5" class="loading" style="color: var(--danger);">
                    ⚠️ Fallo de conexión con el servidor de auditoría: ${error.message}
                </td>
            </tr>`;
    }
}

/**
 * 🌟 Sincronizado milimétricamente con tus clases .badge de componentes.css
 */
function obtenerClaseBadge(accionRaw) {
    if (!accionRaw) return 'alta';
    const accion = accionRaw.toUpperCase();
    if (accion.includes('ALTA') || accion.includes('INSERT')) return 'devuelto';     // Verde (.disponible/.devuelto)
    if (accion.includes('BAJA') || accion.includes('DELETE')) return 'vencido';      // Rojo (.baja/.vencido)
    if (accion.includes('PRESTAMO')) return 'activo';                                // Azul (.activo/.prestamo)
    if (accion.includes('RETORNO') || accion.includes('DEVOLU')) return 'devuelto';  // Verde
    return 'alta'; // Ámbar (.alta/.modificacion/.mantenimiento)
}

function limpiarTexto(cadena) {
    if (!cadena) return 'Sin especificaciones técnicas.';
    return cadena
        .replace(/present¢/g, 'presenta')
        .replace(/Pr,stamo/g, 'Préstamo')
        .replace(/ dac?o /g, ' daño ');
}

function renderizarTablaAuditoria(datos) {
    const tabla = document.getElementById('tabla-logs-auditoria');
    if (!tabla) return;

    if (!Array.isArray(datos) || datos.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5" class="loading">
                    📭 Sin registros en la bitácora del sistema ("Caja Negra").
                </td>
            </tr>`;
        return;
    }

    tabla.innerHTML = datos.map(r => {
        const campoFecha = r.fecha_hora || r.fecha_registro || r.fecha;
        const stringFecha = campoFecha ? campoFecha.replace('T', ' ').substring(0, 19) : '—';

        // Captura de tus badges universales de componentes.css
        const claseBadge = obtenerClaseBadge(r.accion);
        const textoAccionLegible = (r.accion || 'MOVIMIENTO').replace(/_/g, ' ').toUpperCase();
        const detalleSanitizado = limpiarTexto(r.detalles_cambio || r.detalles);

        const nombreOperador = r.usuario_nombre || 'Sistema';
        const rolOperador = r.usuario_rol || 'Automático';
        const ipOrigen = r.ip_origen || '127.0.0.1';

        // 🌟 Retornamos la estructura utilizando clases nativas como .text-mono y .badge
        return `
            <tr>
                <td class="text-mono" style="color: var(--muted); white-space: nowrap;">${stringFecha}</td>
                <td>
                    <div style="font-weight: 600; color: var(--text);">${nombreOperador}</div>
                    <div style="font-size: 11px; color: var(--muted); text-transform: lowercase;">${rolOperador}</div>
                </td>
                <td><span class="badge ${claseBadge}">${textoAccionLegible}</span></td>
                <td>
                    <div style="font-weight: 600; color: var(--text); margin-bottom: 2px;">${r.activo_nombre || '—'}</div>
                    <div style="color: var(--muted); font-size: 12px; max-width: 420px; overflow: hidden; text-overflow: ellipsis;" title="${detalleSanitizado}">
                        ${detalleSanitizado}
                    </div>
                </td>
                <td class="text-mono" style="color: var(--muted);">${ipOrigen}</td>
            </tr>
        `;
    }).join('');
}

function filtrarLogsLocales() {
    const query = document.getElementById('buscar-log')?.value.toLowerCase().trim() || '';
    const tipoAccion = document.getElementById('filtro-accion')?.value || 'todos';

    const filtrados = listaRegistrosAuditoria.filter(r => {
        const activo = (r.activo_nombre || '').toLowerCase();
        const operador = (r.operador_nombre || r.usuario_nombre || '').toLowerCase();
        const detalles = (r.detalles_cambio || r.detalles || '').toLowerCase();

        const matchesQuery = !query || 
            activo.includes(query) || 
            operador.includes(query) || 
            detalles.includes(query);
            
        const accionLower = (r.accion || '').toLowerCase();
        let matchesAccion = tipoAccion === 'todos';
        
        if (tipoAccion === 'insert') matchesAccion = accionLower.includes('insert') || accionLower.includes('alta');
        if (tipoAccion === 'delete') matchesAccion = accionLower.includes('delete') || accionLower.includes('baja');
        if (tipoAccion === 'prestamo') matchesAccion = accionLower.includes('prestamo');
        if (tipoAccion === 'devolucion') matchesAccion = accionLower.includes('devolucion') || accionLower.includes('retorno');
        if (tipoAccion === 'mantenimiento') matchesAccion = accionLower.includes('mantenimiento') || accionLower.includes('update');

        return matchesQuery && matchesAccion;
    });

    renderizarTablaAuditoria(filtrados);
}

window.inicializarModuloHistorial = inicializarModuloHistorial;
window.cargarHistorialAuditoria = cargarModuloAuditoria;
window.filtrarLogsLocales = filtrarLogsLocales;