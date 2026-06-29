/* =========================================================================
   MÓDULO DE LOGICA ASÍNCRONA - DASHBOARD OPERATIVO DE VENTANILLA
   ========================================================================= */

let historialAlertasDashboard = []; 

/**
 * 🔄 GANCHO DE ENLACE MAESTRO
 * Realiza las consultas asíncronas hacia el backend Flask de forma centralizada
 */
async function fetchEstructura(endpoint) {
    console.log(`🔍 [RASTREADOR API] Iniciando consulta al endpoint: /dashboard/${endpoint}`);
    try {
        const baseAPI = window.API || '/api'; 
        const urlFinal = `${baseAPI}/dashboard/${endpoint}`;
        const token = localStorage.getItem('token');
        
        console.log(`📡 [RASTREADOR API] URL construida: ${urlFinal}`);
        
        const respuesta = await fetch(urlFinal, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`📥 [RASTREADOR API] Respuesta recibida de /dashboard/${endpoint}. Estatus: ${respuesta.status}`);
        
        if (!respuesta.ok) throw new Error(`HTTP Código: ${respuesta.status}`);
        const datos = await respuesta.json();
        console.log(`✅ [RASTREADOR API] Datos JSON procesados con éxito para ${endpoint}:`, datos);
        return datos;
    } catch (error) {
        console.error(`❌ [RASTREADOR CRÍTICO] Falló fetchEstructura en /dashboard/${endpoint}:`, error);
        return null; 
    }
}

/**
 * 📊 Inicializador maestro de la vista del operador
 */
async function inicializarModuloDashboard() {
    console.log("📊 [MODULO DASHBOARD OPERADOR] Inicializando pasarela de métricas diarias...");
    try {
        const [metricasRes, auditoriaRes] = await Promise.all([
            fetchEstructura('metricas'),       
            fetchEstructura('auditoria')
        ]);

        // 🌟 CONTROL DE CAÍDA DE CONTINGENCIA
        if (!metricasRes) {
            console.warn("⚠️ [DASHBOARD] No se pudo obtener respuesta del servidor Flask. Limpiando interfaz a ceros.");
            const kpis = ['kpi-transito', 'kpi-activos', 'kpi-incidencias', 'kpi-total-activos', 'kpi-prestamos-activos', 'kpi-alertas-fallas'];
            kpis.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = "---";
            });
            return;
        }

        // Si la data llegó exitosamente a fetchEstructura, la pasamos a renderizar directamente
        renderizarMetricasPantalla(metricasRes);
        await cargarUltimosMovimientosVentanilla();

    }  catch (error) {
        console.error("💥 [RASTREADOR CRÍTICO] Error en inicializarModuloDashboard():", error);
    }
}

/**
 * Mapea e inyecta los datos del backend directamente en las tarjetas KPIs del DOM
 */
function renderizarMetricasPantalla(estructuraMetricas) {
    console.log("📥 [DASHBOARD] Renderizando datos en el DOM:", estructuraMetricas);

    // Selectores mapeados elásticamente a lo que tengas en tu HTML
    const kpiTransito = document.getElementById('kpi-transito') || document.getElementById('kpi-prestamos-activos');
    const kpiActivos = document.getElementById('kpi-activos') || document.getElementById('kpi-total-activos');
    const kpiIncidencias = document.getElementById('kpi-incidencias') || document.getElementById('kpi-alertas-fallas');

    // Asignación lógica basada en el JSON real de tu PostgreSQL
    if (estructuraMetricas) {
        // 1. En Tránsito = Préstamos que están actualmente activos (fuera del almacén)
        if (kpiTransito) {
            kpiTransito.textContent = estructuraMetricas.prestamos?.activos ?? 0;
        }
        
        // 2. Total de Activos = Capacidad de inventario global mapeada en tu JSON (total: 200)
        if (kpiActivos) {
            kpiActivos.textContent = estructuraMetricas.activos?.total ?? 0;
        }
        
        // 3. Incidencias / Taller = Equipos retenidos en mantenimiento técnico (en_mantenimiento: 25)
        if (kpiIncidencias) {
            kpiIncidencias.textContent = estructuraMetricas.activos?.en_mantenimiento ?? 0;
        }
        
        console.log("✅ [DASHBOARD] KPIs sincronizados exitosamente con datos reales.");
    }
}

/**
 * Carga de forma asíncrona los movimientos generados en la ventanilla para la tabla rápida
 */
async function cargarUltimosMovimientosVentanilla() {
    const tablaBody = document.getElementById('tabla-recientes-body');
    if (!tablaBody) return;

    const token = localStorage.getItem('token');

    try {
        const respuesta = await fetch('/api/prestamos', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error(`Status API: ${respuesta.status}`);
        const datos = await respuesta.json();

        tablaBody.innerHTML = '';

        if (Array.isArray(datos) && datos.length > 0) {
            // Tomamos los 4 más recientes
            const recientes = datos.slice(0, 4); 
            
            recientes.forEach(movimiento => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border)';
                tr.style.transition = 'background-color 0.2s ease';
                
                // Mapeo adaptado según tu captura de depuración del array: 
                // "activo_serie" y "usuario_nombre" (que contiene la matrícula)
                const identificadorActivo = movimiento.activo_serie || movimiento.numero_serie || 'Equipo';
                const identificadorAlumno = movimiento.usuario_nombre || movimiento.matricula || 'Alumno';
                const estadoPrestamiento = movimiento.estado === 'devuelto' ? 'Concluido' : 'En Tránsito';
                const colorEstado = movimiento.estado === 'devuelto' ? 'var(--muted)' : 'var(--success)';

                tr.innerHTML = `
                    <td style="padding: 12px 8px; font-weight: 500; color: var(--text);">${identificadorActivo}</td>
                    <td style="padding: 12px 8px; color: var(--muted);">${identificadorAlumno}</td>
                    <td style="padding: 12px 8px;"><span class="badge" style="background: var(--accent-dim); color: var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 11px;">Préstamo</span></td>
                    <td style="padding: 12px 8px;"><span style="color: ${colorEstado}; font-weight: 500;">● ${estadoPrestamiento}</span></td>
                `;
                tablaBody.appendChild(tr);
            });
            console.log("✅ [DASHBOARD] Historial de préstamos recientes inyectado en el DOM.");
        } else {
            inyectarFilaSimuladaVentanilla(tablaBody);
        }

    } catch (error) {
        console.error("⚠️ [DASHBOARD OPERADOR] Fallo al mapear historial real, aplicando contingencia:", error);
        inyectarFilaSimuladaVentanilla(tablaBody);
    }
}

function inyectarFilaSimuladaVentanilla(tablaBody) {
    tablaBody.innerHTML = `
        <tr>
            <td colspan="4" style="padding: 24px; text-align: center; color: var(--muted);">No se registraron movimientos en este turno.</td>
        </tr>
    `;
}

// ⏱️ Auto-ejecución por hash
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.hash === '#dashboard' || !window.location.hash) {
        inicializarModuloDashboard();
    }
});