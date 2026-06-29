// frontend/js/dashboard.js

/**
 * 🌐 Conector optimizado para la API de Flask
 */
async function fetchMetricasDashboard() {
    console.log(`🔍 [API] Consultando métricas unificadas: /dashboard/metricas`);
    try {
        const baseAPI = window.API || '/api';
        const token = localStorage.getItem('token');
        
        const respuesta = await fetch(`${baseAPI}/dashboard/metricas`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error(`HTTP Status: ${respuesta.status}`);
        return await respuesta.json();
    } catch (error) {
        console.error("❌ [API ERROR] Falló la carga del payload analítico:", error);
        return null;
    }
}

/**
 * 📊 Orquestador de la Vista del Administrador
 */
async function inicializarDashboardAdmin() {
    console.log("🚀 [SPA] Inicializando módulo Dashboard Estratégico...");
    
    const metricas = await fetchMetricasDashboard();

    if (!metricas) {
        reestablecerVisualesDashboard();
        return;
    }

    // Sincronización segura de KPIs basada en la estructura exacta de tu controlador de Python
    try {
        const total = metricas.activos?.total ?? 0;
        const disponibles = metricas.activos?.disponible ?? 0;
        const mantenimiento = metricas.activos?.en_mantenimiento ?? 0;
        const prestados = metricas.prestamos?.activos ?? 0;

        document.getElementById('kpi-total-activos').textContent = total;
        document.getElementById('kpi-prestamos-activos').textContent = prestados;
        document.getElementById('kpi-alertas-fallas').textContent = mantenimiento;

        const kpiStock = document.getElementById('kpi-stock-libre');
        if (kpiStock) {
            kpiStock.textContent = total > 0 ? `${Math.round((disponibles / total) * 100)}%` : "0%";
        }

        // Renderizado de las componentes de Chart.js
        renderizarGraficosDashboard(metricas);

    } catch (domError) {
        console.error("⚠️ [DOM ERROR] Falla al mapear variables al documento HTML:", domError);
    }
}

/**
 * 📈 Renderizador de Componentes Analíticos (Barras e Histogramas)
 */
function renderizarGraficosDashboard(payload) {
    if (typeof Chart === 'undefined') {
        console.error("❌ [CRÍTICO] Chart.js no se encuentra cargado en el entorno global.");
        return;
    }

    // --- GRÁFICA 1: MODELOS MÁS SOLICITADOS (Barras Horizontales) ---
    const ctxDemandas = document.getElementById('chartEquiposSolicitados');
    if (ctxDemandas) {
        if (window.instanciaChartDemandas instanceof Chart) window.instanciaChartDemandas.destroy();

        window.instanciaChartDemandas = new Chart(ctxDemandas, {
            type: 'bar',
            data: {
                labels: payload.demandas?.labels || [],
                datasets: [{
                    label: 'Solicitudes',
                    data: payload.demandas?.valores || [],
                    backgroundColor: 'rgba(79, 142, 247, 0.85)',
                    borderColor: '#4f8ef7',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#6b7694' }, beginAtZero: true },
                    y: { grid: { display: false }, ticks: { color: '#e8ecf4' } }
                }
            }
        });
    }

    // --- GRÁFICA 2: COSTOS OPERATIVOS (Barras Verticales) ---
    const ctxCostos = document.getElementById('chartCostosMantenimiento');
    if (ctxCostos) {
        if (window.instanciaChartCostos instanceof Chart) window.instanciaChartCostos.destroy();

        window.instanciaChartCostos = new Chart(ctxCostos, {
            type: 'bar',
            data: {
                labels: payload.costos?.meses || [],
                datasets: [{
                    label: 'Gastos de Operación (MXN)',
                    data: payload.costos?.valores || [],
                    backgroundColor: 'rgba(67, 217, 143, 0.85)',
                    borderColor: '#43d98f',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#6b7694' } },
                    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#6b7694' }, beginAtZero: true }
                }
            }
        });
    }
}

/**
 * 🔄 Fallback en caso de desconexión del backend
 */
function reestablecerVisualesDashboard() {
    document.getElementById('kpi-total-activos').textContent = "---";
    document.getElementById('kpi-prestamos-activos').textContent = "---";
    document.getElementById('kpi-alertas-fallas').textContent = "---";
    document.getElementById('kpi-stock-libre').textContent = "---%";
    
    if (window.instanciaChartDemandas instanceof Chart) window.instanciaChartDemandas.destroy();
    if (window.instanciaChartCostos instanceof Chart) window.instanciaChartCostos.destroy();
}