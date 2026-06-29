/* =========================================================================
   ENRUTADOR MAESTRO DE INTERFAZ - SPA OPERADORES / VENTANILLA (oper_main.js)
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    // 🛡️ CONTROL DE ACCESO ACCESIBLE: Verificar sesión activa y rol correcto
    const token = localStorage.getItem('token');
    const rol = localStorage.getItem('rol');

    if (!token || rol !== 'operador') {
        console.warn("🚫 [SEGURIDAD] Intento de acceso no autorizado a ventanilla. Redirigiendo.");
        localStorage.clear();
        window.location.href = 'login.html';
        return;
    }

    // 1. Invocamos la renderización de nuestra Navbar Premium heredando las clases compartidas
    cargarNavbarOperador();

    // 2. Inyectamos el nombre del operador de manera segura en el campo reducido
    const nombreCompleto = localStorage.getItem('usuario_nombre') || 'Operador Ventanilla';
    const profileName = document.getElementById('navbar-profile-name');
    if (profileName) profileName.textContent = nombreCompleto;

    // Escuchar los cambios en la URL (Navegación SPA reactiva)
    window.addEventListener('hashchange', enrutadorOperador);
    
    // Ejecutar el enrutador por primera vez para cargar la vista por defecto
    enrutadorOperador();
});

function cargarNavbarOperador() {
    const contenedor = document.getElementById('sidebar-container');
    if (!contenedor) return;

    // Estructura idéntica al admin.css usando clases maestras (.sidebar, .sidebar-menu, etc.)
    contenedor.innerHTML = `
        <nav class="sidebar">
            <div class="sidebar-top-block">
                <div class="sidebar-header">
                    <div class="sidebar-logo">O</div>
                    <div class="sidebar-title-block">
                        <span class="sidebar-title">TechTrack</span>
                    </div>
                </div>

                <ul class="sidebar-menu">
                    <li class="sidebar-item" id="nav-dashboard">
                        <a href="#dashboard"><span class="sidebar-icon">📊</span> Dashboard</a>
                    </li>
                    <li class="sidebar-item" id="nav-transito">
                        <a href="#transito"><span class="sidebar-icon">🔄</span> En Tránsito</a>
                    </li>
                    <li class="sidebar-item" id="nav-salida">
                        <a href="#salida"><span class="sidebar-icon">📥</span> Nuevo Préstamo</a>
                    </li>
                    <li class="sidebar-item" id="nav-incidencias">
                        <a href="#incidencias"><span class="sidebar-icon">⚠️</span> Incidencias</a>
                    </li>
                </ul>
            </div>

            <div class="sidebar-footer">
                <label class="theme-switch">
                    <input type="checkbox" id="theme-toggle" class="theme-switch__checkbox" onchange="conmutarTemaGlobal()">
                    <div class="theme-switch__container">
                        <div class="theme-switch__clouds"></div>
                        <div class="theme-switch__stars-container">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 55" fill="none">
                                <path fill-rule="evenodd" clip-rule="evenodd" d="M135.831 3.00688C135.055 3.85027 134.111 4.29946 133 4.35447C134.111 4.40947 135.055 4.85867 135.831 5.71123C136.607 6.55462 136.996 7.56303 136.996 8.72727C136.996 7.95722 137.172 7.25134 137.525 6.59129C137.886 5.93124 138.372 5.39954 138.98 5.00535C139.598 4.60199 140.268 4.39114 141 4.35447C139.88 4.2903 138.936 3.85027 138.16 3.00688C137.384 2.16348 136.996 1.16425 136.996 0C136.996 1.16425 136.607 2.16348 135.831 3.00688ZM31 23.3545C32.1114 23.2995 33.0551 22.8503 33.8313 22.0069C34.6075 21.1635 34.9956 20.1642 34.9956 19C34.9956 20.1642 35.3837 21.1635 36.1599 22.0069C36.9361 22.8503 37.8798 23.2903 39 23.3545C38.2679 23.3911 37.5976 23.602 36.9802 24.0053C36.3716 24.3995 35.8864 24.9312 35.5248 25.5913C35.172 26.2513 34.9956 26.9572 34.9956 27.7273C34.9956 26.563 34.6075 25.5546 33.8313 24.7112C33.0551 23.8587 32.1114 23.4095 31 23.3545ZM0 36.3545C1.11136 36.2995 2.05513 35.8503 2.83131 35.0069C3.6075 34.1635 3.99559 33.1642 3.99559 32C3.99559 33.1642 4.38368 34.1635 5.15987 35.0069C5.93605 35.8503 6.87982 36.2903 8 36.3545C7.26792 36.3911 6.59757 36.602 5.98015 37.0053C5.37155 37.3995 4.88644 37.9312 4.52481 38.5913C4.172 39.2513 3.99559 39.9572 3.99559 40.7273C3.99559 39.563 3.6075 38.5546 2.83131 37.7112C2.05513 36.8587 1.11136 36.4095 0 36.3545ZM56.8313 24.0069C56.0551 24.8503 55.1114 25.2995 54 25.3545C55.1114 25.4095 56.0551 25.8587 56.8313 26.7112C57.6075 27.5546 57.9956 28.563 57.9956 29.7273C57.9956 28.9572 58.172 28.2513 58.5248 27.5913C58.8864 26.9312 59.3716 26.3995 59.9802 26.0053C60.5976 25.602 61.2679 25.3911 62 25.3545C60.8798 25.2903 59.9361 24.8503 59.1599 24.0069C58.3837 23.1635 57.9956 22.1642 57.9956 21C57.9956 22.1642 57.6075 23.1635 56.8313 24.0069ZM81 25.3545C82.1114 25.2995 83.0551 24.8503 83.8313 24.0069C84.6075 23.1635 84.9956 22.1642 84.9956 21C84.9956 22.1642 85.3837 23.1635 86.1599 24.0069C86.9361 24.8503 87.8798 25.2903 89 25.3545C88.2679 25.3911 87.5976 25.602 86.9802 26.0053C86.3716 26.3995 85.8864 26.9312 85.5248 27.5913C85.172 28.2513 84.9956 28.9572 84.9956 29.7273C84.9956 28.563 84.6075 27.5546 83.8313 26.7112C83.0551 25.8587 82.1114 25.4095 81 25.3545ZM136 36.3545C137.111 36.2995 138.055 35.8503 138.831 35.0069C139.607 34.1635 139.996 33.1642 139.996 32C139.996 33.1642 140.384 34.1635 141.16 35.0069C141.936 35.8503 142.88 36.2903 144 36.3545C143.268 36.3911 142.598 36.602 141.98 37.0053C141.372 37.3995 140.886 37.9312 140.525 38.5913C140.172 39.2513 139.996 39.9572 139.996 40.7273C139.996 39.563 139.607 38.5546 138.831 37.7112C138.055 36.8587 137.111 36.4095 136 36.3545ZM101.831 49.0069C101.055 49.8503 100.111 50.2995 99 50.3545C100.111 50.4095 101.055 50.8587 101.831 51.7112C102.607 52.5546 102.996 53.563 102.996 54.7273C102.996 53.9572 103.172 53.2513 103.525 52.5913C103.886 51.9312 104.372 51.3995 104.98 51.0053C105.598 50.602 106.268 50.3911 107 50.3545C105.88 50.2903 104.936 49.8503 104.16 49.0069C103.384 48.1635 102.996 47.1642 102.996 46C102.996 47.1642 102.607 48.1635 101.831 49.0069Z" fill="currentColor"></path>
                            </svg>
                        </div>
                        <div class="theme-switch__circle-container">
                            <div class="theme-switch__sun-moon-container">
                                <div class="theme-switch__moon">
                                    <div class="theme-switch__spot"></div>
                                    <div class="theme-switch__spot"></div>
                                    <div class="theme-switch__spot"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </label>

                <div class="sidebar-profile">
                    <div class="profile-avatar">OP</div>
                    <div class="profile-info">
                        <span class="profile-name" id="navbar-profile-name">Cargando...</span>
                        <span class="profile-role">Operador</span>
                    </div>
                </div>

                <button class="btn btn-logout" onclick="ejecutarCierreSesion()">🔒 Salir</button>
            </div>
        </nav>
    `;

    // Sincronizar el tema guardado inmediatamente al construir el HTML de la barra
    const temaGuardado = localStorage.getItem('app_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', temaGuardado);
    
    const checkbox = document.getElementById('theme-toggle');
    if (checkbox) {
        checkbox.checked = (temaGuardado === 'dark');
    }
}

/**
 * Orquesta la carga de plantillas HTML asíncronas basándose en el ancla hash de la URL
 */
async function enrutadorOperador() {
    const contenedorPrincipal = document.getElementById('app');
    if (!contenedorPrincipal) return;

    let ruta = window.location.hash.replace('#', '').trim();
    if (!ruta) ruta = 'dashboard';

    console.log(`🧭 [ENRUTADOR OPERADOR] Moviendo ventanilla hacia: [${ruta}]`);

    actualizarMenuLateral(ruta);

    let archivoVista = '';
    switch (ruta) {
        case 'dashboard':
            archivoVista = 'oper/vista1_dashboard.html';
            break;
        case 'transito':
            archivoVista = 'oper/vista2_transito.html';
            break;
        case 'salida':
            archivoVista = 'oper/vista3_salida.html'; 
            break;
        case 'incidencias':
            archivoVista = 'oper/vista4_incidentes.html';
            break;
        default:
            archivoVista = 'oper/vista1_dashboard.html';
            break;
    }

    try {
        contenedorPrincipal.innerHTML = `<div class="loading">Sincronizando registros de ventanilla...</div>`;

        const respuesta = await fetch(archivoVista);
        if (!respuesta.ok) throw new Error(`Error al obtener fragmento HTML de operador: ${respuesta.status}`);

        const htmlPuro = await respuesta.text();
        contenedorPrincipal.innerHTML = htmlPuro;

        // =========================================================================
        // 🌟 DISPARO DE GANCHOS DE CICLO DE VIDA (CORREGIDO Y BLINDADO)
        // =========================================================================
        if (ruta === 'dashboard') {
            // CORREGIDO: Despertamos la lógica asíncrona para que consulte a PostgreSQL de inmediato
            if (typeof inicializarModuloDashboard === 'function') {
                await inicializarModuloDashboard();
            } else if (typeof inicializarDashboardAdmin === 'function') {
                // Respaldo por si quedó con el nombre viejo en memoria cache
                await inicializarDashboardAdmin();
            }

            // Enlazar botones de acceso rápido que pertenezcan al fragmento del Dashboard
            document.getElementById('shortcut-loan')?.addEventListener('click', () => window.location.hash = 'salida');
            document.getElementById('shortcut-return')?.addEventListener('click', () => window.location.hash = 'transito');
            
        } else if (ruta === 'transito') {
            if (typeof inicializarModuloTransito === 'function') inicializarModuloTransito();
        } else if (ruta === 'salida') {
            if (typeof inicializarModuloSalida === 'function') inicializarModuloSalida();
        } else if (ruta === 'incidencias') {
            if (typeof inicializarModuloIncidencias === 'function') inicializarModuloIncidencias();
        }

    } catch (error) {
        console.error("💥 [ENRUTADOR OPERADOR] Falló la inyección de la sub-vista:", error);
        contenedorPrincipal.innerHTML = `
            <div class="section" style="text-align: center; padding: 40px;">
                <h3 style="color: var(--danger)">Error de sincronización operativa</h3>
                <p style="color: var(--muted); font-size: 14px; margin-top: 8px;">No se pudo enlazar el componente operativo solicitado (Ruta: ${archivoVista}).</p>
                <button class="btn btn-primary" style="margin-top: 16px;" onclick="window.location.reload()">Reintentar Carga</button>
            </div>
        `;
    }
}

/**
 * Mantiene la sincronización de la clase active sobre los elementos de la lista en la barra lateral
 */
function actualizarMenuLateral(rutaActiva) {
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });

    const itemNav = document.getElementById(`nav-${rutaActiva}`);
    if (itemNav) {
        itemNav.classList.add('active');
    }
}

/**
 * Control centralizado para conmutar el tema global de la interfaz (Claro/Oscuro)
 * Sincronizado exactamente con las funciones de admin_main.js
 */
function conmutarTemaGlobal() {
    const htmlElement = document.documentElement;
    const checkbox = document.getElementById('theme-toggle');
    
    if (!checkbox) return;

    if (checkbox.checked) {
        htmlElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('app_theme', 'dark');
    } else {
        htmlElement.setAttribute('data-theme', 'light');
        localStorage.setItem('app_theme', 'light');
    }
}

// ⏱️ Sincronización secundaria del switch físico al cargar el DOM del documento
document.addEventListener('DOMContentLoaded', () => {
    const temaGuardado = localStorage.getItem('app_theme') || 'dark';
    const htmlElement = document.documentElement;
    const checkbox = document.getElementById('theme-toggle');

    htmlElement.setAttribute('data-theme', temaGuardado);

    if (checkbox) {
        checkbox.checked = (temaGuardado === 'dark');
    }
});

/**
 * Lanza una notificación premium interactiva usando SweetAlert2 Dark
 * @param {string} tipo - 'success' o 'error'
 * @param {string} titulo - Encabezado principal (Ej. 'Error Operacional')
 * @param {string} mensaje - Detalle del error o confirmación de la API
 */
function mostrarNotificacionOperador(tipo, titulo, mensaje) {
    Swal.fire({
        title: titulo,
        text: mensaje,
        icon: tipo, // 'success' pintará la palomita verde, 'error' el tache rojo
        confirmButtonText: 'OK',
        confirmButtonColor: tipo === 'error' ? '#dc3545' : '#28a745', // Rojo para error, verde para éxito
        background: '#151a26', // Fondo oscuro premium idéntico a tu tema
        color: '#ffffff',      // Texto blanco para contraste absoluto
        customClass: {
            popup: 'techtrack-swal-popup',
            confirmButton: 'techtrack-swal-btn'
        },
        buttonsStyling: true
    });
}

// Exponer globalmente
window.mostrarNotificacionOperador = mostrarNotificacionOperador;