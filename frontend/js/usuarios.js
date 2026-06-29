/* =========================================================================
   👥 CONTROLADOR DE PERSONAL Y PERMISOS RBAC (usuarios.js)
   ========================================================================= */

// Variables de caché local para evitar colisiones y optimizar filtros
let usrListadoPendientes = [];
let usrListadoActivos = [];

/**
 * 🚀 FUNCIÓN DESPERTADOR: Invocada automáticamente por el enrutador admin_main.js
 */
function inicializarModuloUsuarios() {
    console.log("👥 [MÓDULO USUARIOS] Inicializando bandeja de personal...");
    cargarBandejaUsuarios();
}

/**
 * Trae las listas de usuarios pendientes y activos desde el servidor Flask
 */
async function cargarBandejaUsuarios() {
    const baseAPI = window.API || '/api';
    const token = localStorage.getItem('token');

    try {
        // Petición paralela incluyendo el prefijo '/auth' requerido por el Blueprint de Flask
        const [resPendientes, resActivos] = await Promise.all([
            fetch(`${baseAPI}/auth/usuarios/pendientes`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${baseAPI}/auth/usuarios/activos`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!resPendientes.ok || !resActivos.ok) throw new Error("Error en la descarga de nómina");

        usrListadoPendientes = await resPendientes.json();
        usrListadoActivos = await resActivos.json();

        renderizarPendientes(usrListadoPendientes);
        renderizarActivos(usrListadoActivos);

    } catch (error) {
        console.error("❌ [USUARIOS] Fallo crítico al consultar API:", error);
        notificarErrorTablas();
    }
}

/**
 * Renderiza las solicitudes de acceso utilizando la nueva cuadrícula de tarjetas
 */
function renderizarPendientes(usuarios) {
    const contenedor = document.getElementById('grid-aprobaciones-pendientes');
    if (!contenedor) return;

    if (!usuarios || usuarios.length === 0) {
        contenedor.innerHTML = `
            <div class="no-cards-msg">
                🎉 No hay solicitudes de acceso pendientes de revisión.
            </div>`;
        return;
    }

    contenedor.innerHTML = usuarios.map((u, index) => {
        // Genera las iniciales a partir del nombre (Máximo 2 letras)
        const iniciales = u.nombre ? u.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
        const idDictamen = u.id || index;

        return `
            <div class="card-usuario pendiente-border">
                <div class="card-border-top"></div>
                <div class="user-avatar">${iniciales}</div>
                <span class="user-name" title="${u.nombre}">${u.nombre}</span>
                <p class="user-email" title="${u.correo}">${u.correo}</p>
                
                <div class="badge-container">
                    <span class="badge modificacion">${u.rol.toUpperCase()}</span>
                </div>
                
                <div class="card-actions">
                    <button class="btn btn-primary" onclick="dictaminarUsuario(${idDictamen}, 'aprobar')">
                        Aprobar
                    </button>
                    <button class="btn btn-cancel" onclick="dictaminarUsuario(${idDictamen}, 'rechazar')">
                        Rechazar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Renderiza el personal activo en fichas modulares dinámicas
 */
function renderizarActivos(usuarios) {
    const contenedor = document.getElementById('grid-usuarios-activos');
    if (!contenedor) return;

    if (!usuarios || usuarios.length === 0) {
        contenedor.innerHTML = `
            <div class="no-cards-msg">
                No se encontraron operadores registrados.
            </div>`;
        return;
    }

    contenedor.innerHTML = usuarios.map(u => {
        const iniciales = u.nombre ? u.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'OP';
        const esAdmin = u.rol.toLowerCase() === 'admin' || u.rol.toLowerCase() === 'administrador';
        const claseBorde = esAdmin ? 'admin-border' : '';

        return `
            <div class="card-usuario ${claseBorde}">
                <div class="card-border-top"></div>
                <div class="user-avatar">${iniciales}</div>
                <span class="user-name" title="${u.nombre}">${u.nombre}</span>
                <p class="user-email" title="${u.correo}">${u.correo}</p>
                
                <div class="badge-container">
                    <span class="badge alta">${u.rol.toUpperCase()}</span>
                </div>
                
                <div class="card-actions" style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                    <button class="btn btn-secondary" 
                            style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--bg); border: 1px solid var(--border);" 
                            onclick="restablecerContrasenaUsuario(${u.id}, '${u.nombre}')">
                        🔑 Restablecer Clave
                    </button>
                    <button class="btn btn-cancel" 
                            style="width: 100%;"
                            onclick="revocarAccesoUsuario(${u.id})" 
                            ${esAdmin ? 'disabled style="opacity: 0.3; cursor: not-allowed; width:100%;"' : ''}>
                        🚫 Revocar Credencial
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Aprueba o rechaza el registro de un nuevo operador en el sistema
 */
async function dictaminarUsuario(id, accion) {
    const baseAPI = window.API || '/api';
    const token = localStorage.getItem('token');
    
    const esAprobar = accion === 'aprobar';
    const titulo = esAprobar ? '¿Aprobar solicitud?' : '¿Rechazar solicitud?';
    const texto = esAprobar 
        ? 'El usuario obtendrá credenciales institucionales inmediatas para operar el sistema.' 
        : 'Esta solicitud será eliminada de forma permanente de la lista de espera.';
    const botonConfirmarColor = esAprobar ? '#3b82f6' : '#ef4444'; 

    // Confirmación estilizada con SweetAlert2
    const resultado = await Swal.fire({
        title: titulo,
        text: texto,
        icon: esAprobar ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonColor: botonConfirmarColor,
        cancelButtonColor: '#4b5563', 
        confirmButtonText: esAprobar ? 'Sí, Aprobar' : 'Sí, Rechazar',
        cancelButtonText: 'Cancelar',
        background: '#111827', 
        color: '#f3f4f6'
    });

    if (!resultado.isConfirmed) return;

    try {
        // Pantalla de espera transicional mientras responde la BD
        Swal.fire({
            title: 'Procesando...',
            text: 'Guardando resolución en la base de datos.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); },
            background: '#111827',
            color: '#f3f4f6'
        });

        const respuesta = await fetch(`${baseAPI}/auth/usuarios/dictaminar/${id}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ dictamen: accion })
        });

        if (respuesta.ok) {
            await cargarBandejaUsuarios();
            
            Swal.fire({
                title: esAprobar ? '¡Aprobado!' : '¡Rechazado!',
                text: `El operador ha sido dictaminado correctamente.`,
                icon: 'success',
                confirmButtonColor: '#3b82f6',
                background: '#111827',
                color: '#f3f4f6'
            });
        } else {
            Swal.fire({
                title: 'Error del Servidor',
                text: 'No se pudo procesar la resolución en el servidor público.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
                background: '#111827',
                color: '#f3f4f6'
            });
        }
    } catch (error) {
        console.error("Error al dictaminar:", error);
        Swal.fire({
            title: 'Error de Red',
            text: 'Fallo crítico de conexión con el backend de Flask.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
            background: '#111827',
            color: '#f3f4f6'
        });
    }
}

/**
 * Revoca el acceso de un operador activo (Baja lógica o suspensión de cuenta)
 */
async function revocarAccesoUsuario(id) {
    const baseAPI = window.API || '/api';
    const token = localStorage.getItem('token');

    const resultado = await Swal.fire({
        title: '⚠️ ¿Suspender credenciales?',
        text: 'El operador perderá de inmediato su token de acceso y la facultad de registrar movimientos en ventanilla.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', 
        cancelButtonColor: '#4b5563',
        confirmButtonText: 'Sí, suspender acceso',
        cancelButtonText: 'Mantener activo',
        background: '#111827',
        color: '#f3f4f6'
    });

    if (!resultado.isConfirmed) return;

    try {
        Swal.fire({
            title: 'Revocando...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); },
            background: '#111827',
            color: '#f3f4f6'
        });

        const respuesta = await fetch(`${baseAPI}/auth/usuarios/revocar/${id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (respuesta.ok) {
            await cargarBandejaUsuarios();
            
            Swal.fire({
                title: 'Credencial Revocada',
                text: 'El operador ha sido removido y enviado de vuelta a la lista de espera transaccional.',
                icon: 'success',
                confirmButtonColor: '#3b82f6',
                background: '#111827',
                color: '#f3f4f6'
            });
        } else {
            Swal.fire({
                title: 'Acción Denegada',
                text: 'El servidor denegó la revocación del usuario seleccionado.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
                background: '#111827',
                color: '#f3f4f6'
            });
        }
    } catch (error) {
        console.error("Error al revocar:", error);
        Swal.fire({
            title: 'Fallo de Enlace',
            text: 'Error de red al intentar suspender la cuenta del operador.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
            background: '#111827',
            color: '#f3f4f6'
        });
    }
}

/**
 * 🔐 NUEVA FUNCIÓN: Despliega un modal con SweetAlert2 para capturar y actualizar la contraseña del usuario
 */
async function restablecerContrasenaUsuario(id, nombreCompleto) {
    const baseAPI = window.API || '/api';
    const token = localStorage.getItem('token');

    // Desplegar modal táctico con input incrustado
    const { value: nuevaPassword } = await Swal.fire({
        title: '🔑 Reestablecer Contraseña',
        text: `Ingresa la nueva contraseña para: ${nombreCompleto}`,
        input: 'password',
        inputPlaceholder: 'Escribe la nueva contraseña...',
        inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off',
            minlength: 6
        },
        showCancelButton: true,
        confirmButtonText: 'Actualizar Contraseña',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3b82f6',
        cancelButtonColor: '#4b5563',
        background: '#111827',
        color: '#f3f4f6',
        inputValidator: (value) => {
            if (!value) {
                return '¡Debes ingresar una contraseña válida!';
            }
            if (value.length < 6) {
                return 'La contraseña debe tener al menos 6 caracteres.';
            }
        }
    });

    // Si el usuario cancela o cierra el modal, salimos de la función
    if (!nuevaPassword) return;

    try {
        Swal.fire({
            title: 'Actualizando...',
            text: 'Modificando firma criptográfica en el sistema.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); },
            background: '#111827',
            color: '#f3f4f6'
        });

        const respuesta = await fetch(`${baseAPI}/auth/usuarios/restablecer-password/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ password: nuevaPassword.trim() })
        });

        const data = await respuesta.json();

        if (respuesta.ok && data.success) {
            Swal.fire({
                title: '¡Contraseña Actualizada!',
                text: `La contraseña de ${nombreCompleto} ha sido modificada con éxito.`,
                icon: 'success',
                confirmButtonColor: '#3b82f6',
                background: '#111827',
                color: '#f3f4f6'
            });
        } else {
            Swal.fire({
                title: 'Error al cambiar clave',
                text: data.message || 'El backend rechazó la actualización de la credencial.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
                background: '#111827',
                color: '#f3f4f6'
            });
        }
    } catch (error) {
        console.error("❌ [ERROR RESTABLECER JS]:", error);
        Swal.fire({
            title: 'Fallo de Red',
            text: 'No se pudo establecer comunicación con el controlador de Flask.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
            background: '#111827',
            color: '#f3f4f6'
        });
    }
}

/**
 * Filtro local en tiempo real para buscar operadores activos sin saturar el backend
 */
function filtrarOperadoresLocales() {
    const query = document.getElementById('buscar-operador')?.value.toLowerCase().trim() || '';
    
    const filtrados = usrListadoActivos.filter(u => 
        u.nombre.toLowerCase().includes(query) || 
        u.correo.toLowerCase().includes(query)
    );

    renderizarActivos(filtrados);
}

/**
 * Manejador de errores visuales modificado para limpiar los contenedores grid
 */
function notificarErrorTablas() {
    const msg = `<div class="no-cards-msg" style="color: var(--danger);">⚠️ Fallo de sincronización con la API.</div>`;
    if(document.getElementById('grid-aprobaciones-pendientes')) document.getElementById('grid-aprobaciones-pendientes').innerHTML = msg;
    if(document.getElementById('grid-usuarios-activos')) document.getElementById('grid-usuarios-activos').innerHTML = msg;
}

// Publicación global en Window
window.inicializarModuloUsuarios = inicializarModuloUsuarios;
window.dictaminarUsuario = dictaminarUsuario;
window.revocarAccesoUsuario = revocarAccesoUsuario;
window.restablecerContrasenaUsuario = restablecerContrasenaUsuario;
window.filtrarOperadoresLocales = filtrarOperadoresLocales;