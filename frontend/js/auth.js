/* =========================================================================
   CONTROLADOR DE AUTENTICACIÓN, ANIMACIONES Y SESIÓN GLOBAL (auth.js)
   ========================================================================= */

const API = '/api';

/**
 * Procesa el envío del formulario de login, maneja restricciones RBAC y ejecuta animaciones
 */
async function manejadorLogin(event) {
    // Evita que la página se refresque de forma tradicional al enviar el formulario
    event.preventDefault();

    const usuario  = document.getElementById('usuario').value.trim();
    const password = document.getElementById('password').value.trim();
    const msg      = document.getElementById('msg');
    const btn      = document.getElementById('btnLogin');

    if (!usuario || !password) { 
        msg.className = 'msg error'; 
        msg.textContent = 'Completa todos los campos.'; 
        return; 
    }

    // Configuración visual de feedback (Estado de Carga)
    btn.disabled = true; 
    btn.textContent = 'Verificando...';
    msg.textContent = '';
    msg.className = 'msg';

    try {
        const res = await fetch(`${API}/auth/login`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ usuario, password }) 
        });
        
        const data = await res.json();

        // 🔒 CAPTURA DE BLOQUEO (HTTP 403 Forbidden): Cuenta registrada pero sin aprobación
        if (res.status === 403) {
            msg.className = 'msg error';
            msg.textContent = data.message || 'Tu cuenta está en espera de aprobación por un administrador.';
            btn.disabled = false;
            btn.textContent = 'Iniciar Sesión';
            return; // Se detiene por completo el flujo de acceso y animación
        }

        if (res.ok && data.success) {
            // Normalización y mapeo seguro de variables recibidas del Backend
            const nombreUsuario = data.nombre || data.usuario;
            const rolServidor = (data.rol || data.role || 'operador').toLowerCase();

            // 🌟 NORMALIZACIÓN RBAC: Mapear el ENUM de PostgreSQL 'administrador' a la cadena fija 'admin'
            let rolEstandarizado = 'operador';
            if (rolServidor === 'admin' || rolServidor === 'administrador') {
                rolEstandarizado = 'admin';
            }

            // Persistencia limpia de la sesión en el navegador (Tokens y Atributos)
            localStorage.setItem('token', data.token || 'true'); 
            localStorage.setItem('rol', rolEstandarizado); // Guardado seguro como 'admin' u 'operador'
            localStorage.setItem('usuario_nombre', nombreUsuario);
            localStorage.setItem('usuario_username', data.usuario || usuario);
            localStorage.setItem('user_id', data.id || 1); // Forzar id para enganche de activos
            
            msg.className = 'msg ok'; 
            msg.textContent = `Bienvenido, ${nombreUsuario}`;
            
            // 🚀 DISPARAR LA ANIMACIÓN TRIDIMENSIONAL DE CRISTAL
            const overlay = document.getElementById('login-overlay');
            const bgSimulation = document.getElementById('bg-simulation');

            if (overlay) overlay.classList.add('app-revelada');
            if (bgSimulation) {
                bgSimulation.classList.add('enfocado');
                // Parche de emergencia en línea si el CSS de variables no responde
                bgSimulation.style.filter = "none";
                bgSimulation.style.transform = "scale(1)";
                bgSimulation.style.opacity = "1";
            }

            // ⏱️ Esperamos exactamente 600ms a que termine la animación de expansión espacial
            setTimeout(() => { 
                btn.disabled = false;
                btn.textContent = 'Iniciar Sesión';

                // Redirección física blindada usando la variable normalizada
                if (rolEstandarizado === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'operador.html';
                }
            }, 600);

        } else {
            msg.className = 'msg error'; 
            msg.textContent = data.message || 'Usuario o contraseña incorrectos.';
            btn.disabled = false; 
            btn.textContent = 'Iniciar Sesión';
        }
    } catch(e) {
        console.error("[ERROR AUTH]", e);
        msg.className = 'msg error'; 
        msg.textContent = 'No se pudo conectar con el servidor backend.';
        btn.disabled = false; 
        btn.textContent = 'Iniciar Sesión';
    }
}

/**
 * Envía la solicitud de registro al backend asignándole por defecto el estado pendiente
 */
async function manejadorRegistro(event) {
    event.preventDefault();

    const nombre   = document.getElementById('reg-nombre').value.trim();
    const usuario  = document.getElementById('reg-usuario').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const msg      = document.getElementById('msg');
    const btn      = document.getElementById('btnRegistro');

    if (!nombre || !usuario || !password) {
        msg.className = 'msg error';
        msg.textContent = 'Completa todos los campos del registro.';
        return;
    }

    if (password.length < 6) {
        msg.className = 'msg error';
        msg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Procesando registro...';
    msg.textContent = '';
    msg.className = 'msg';

    try {
        // Petición apuntando a tu blueprint de autenticación en Flask
        const res = await fetch(`${API}/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, usuario, password, rol: 'operador' })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            msg.className = 'msg ok';
            msg.textContent = data.message || '¡Registro enviado con éxito! Espera a que un administrador apruebe tu acceso.';
            
            // Limpiamos el formulario de registro para evitar envíos duplicados
            document.getElementById('formRegistro').reset();
            
            // Regresamos al usuario automáticamente a la vista de login tras 3 segundos
            setTimeout(() => {
                conmutarVistasAuth(null, 'login');
            }, 3500);

        } else {
            msg.className = 'msg error';
            msg.textContent = data.message || 'No se pudo procesar la solicitud de registro.';
        }
    } catch (error) {
        console.error("[ERROR REGISTRO]", error);
        msg.className = 'msg error';
        msg.textContent = 'Error de red al intentar conectar con el servidor.';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Solicitar Registro';
    }
}

/**
 * Alterna de forma visual entre el formulario de login y el de registro sin alterar el layout global
 */
function conmutarVistasAuth(event, vista) {
    if (event) event.preventDefault();
    
    const vistaLogin = document.getElementById('vista-login');
    const vistaRegistro = document.getElementById('vista-registro');
    const msg = document.getElementById('msg');
    
    // Limpiamos alertas previas al cambiar de ventana
    if (msg) {
        msg.textContent = '';
        msg.className = 'msg';
    }

    if (vista === 'registro') {
        if (vistaLogin) vistaLogin.style.display = 'none';
        if (vistaRegistro) vistaRegistro.style.display = 'block';
    } else {
        if (vistaRegistro) vistaRegistro.style.display = 'none';
        if (vistaLogin) vistaLogin.style.display = 'block';
    }
}

/* =========================================================================
   SOPORTE GLOBAL Y CICLO DE VIDA (Accesible desde admin.html y operator.html)
   ========================================================================= */

/**
 * Destruye la sesión de usuario de forma limpia y redirige a la pasarela pública
 */
function ejecutarCierreSesion() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Sincronizar el tema guardado en localStorage inmediatamente al cargar cualquier archivo
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('app_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Si el switch visual del tema existe en la barra lateral, sincronizar su estado (checked)
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.checked = (savedTheme === 'light');
    }
});