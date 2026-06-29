// frontend/js/activos.js

// Recuperar datos validados por auth.js de forma segura usando localStorage
const usuarioActivo = {
    id: localStorage.getItem("user_id") || 1,
    rol: localStorage.getItem("rol")?.toLowerCase(),
    nombre: localStorage.getItem("usuario_name")
};

let listadoActivos = [];

/**
 * 🚀 1. FUNCIÓN DESPERTADOR (Invocada de manera exacta por admin_main.js)
 * Optimizada con async/await para evitar congelamientos si un elemento del DOM falta
 */
async function inicializarModuloInventario() {
    console.log("🖥️ Inicializador del módulo de Activos/Inventario invocado por el enrutador");
    
    // Ejecutamos la carga del catálogo de categorías en segundo plano
    cargarCategoriasDinamicas();
    
    // Ejecutamos inmediatamente la sincronización y renderizado de las tarjetas principales
    await cargarModuloActivos();
}

/**
 * Sincroniza el inventario consultando la API de Flask
 */
async function cargarModuloActivos() {
    try {
        const baseAPI = window.API || '/api';
        const respuesta = await fetch(`${baseAPI}/activos`);
        listadoActivos = await respuesta.json();
        renderizarTarjetasActivos(listadoActivos);
    } catch (error) {
        console.error("[ERROR] activos.cargarModuloActivos:", error);
        const contenedor = document.getElementById('grid-inventario-activos');
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="no-cards-msg" style="color: var(--danger); width: 100%; text-align: center;">
                    ❌ Error crítico de red al sincronizar el inventario con el servidor de base de datos.
                </div>`;
        }
    }
}

/**
 * Renderiza los registros mapeados a partir de las tablas de la base de datos
 */
function renderizarTarjetasActivos(datos) {
    const contenedor = document.getElementById('grid-inventario-activos');
    if (!contenedor) return;
    
    if (!datos || datos.length === 0) {
        contenedor.innerHTML = `
            <div class="no-cards-msg" style="width: 100%; text-align: center;">
                Sin activos tecnológicos registrados en el almacén.
            </div>`;
        return;
    }

    const esAdmin = usuarioActivo.rol === 'admin' || usuarioActivo.rol === 'administrador';

    contenedor.innerHTML = datos.map(activo => {
        // Mapeo directo usando las minúsculas exactas de tus ENUMS de PostgreSQL
        let claseEstado = 'disponible';
        let estadoBD = (activo.estado || 'disponible').toLowerCase();
        
        if (estadoBD === 'prestado') claseEstado = 'prestado';
        if (estadoBD === 'mantenimiento') claseEstado = 'mantenimiento';
        if (estadoBD === 'baja') claseEstado = 'baja';

        // Identificación adaptativa de categorías
        let categoriaIcono = '📦';
        let catLimpia = (activo.categoria || '').toLowerCase();
        if (catLimpia.includes('comput')) categoriaIcono = '🖥️';
        if (catLimpia.includes('electr')) categoriaIcono = '⚡';
        if (catLimpia.includes('medic')) categoriaIcono = '🔬';
        if (catLimpia.includes('herram')) categoriaIcono = '🛠️';

        // Estetización del texto de estado para el usuario final
        let textoEstadoVisb = estadoBD.charAt(0).toUpperCase() + estadoBD.slice(1);
        if (estadoBD === 'mantenimiento') textoEstadoVisb = 'Mantenimiento';

        return `
            <div class="card-activo estado-${claseEstado}">
                <div class="activo-meta">
                    <div class="activo-icon-box">${categoriaIcono}</div>
                    <div class="activo-info">
                        <span class="activo-title" title="${activo.nombre}">${activo.nombre}</span>
                        <span class="activo-brand">${activo.marca || 'TESCHA'}</span>
                    </div>
                </div>

                <div class="activo-details-box">
                    <div class="detail-row">
                        <span class="detail-label">S/N:</span>
                        <span class="detail-value serial-font">${activo.numero_serie || '—'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Categoría:</span>
                        <span class="detail-value">${activo.categoria}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Estado:</span>
                        <span class="status-badge ${claseEstado}">${textoEstadoVisb}</span>
                    </div>
                </div>
                
                <div class="card-activo-actions">
                    ${esAdmin ? `
                        <button class="btn btn-secondary" onclick="editarActivo(${activo.id})">
                            ✏️ Editar
                        </button> 
                        <button class="btn btn-cancel" style="border-color: rgba(239, 68, 68, 0.3);" onclick="eliminarActivo(${activo.id})">
                            ❌ Dar de Baja
                        </button>
                    ` : '<span style="color:var(--muted); font-size:11px; text-align:center; width:100%;">Modo de Solo Lectura</span>'}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Apertura del modal unificado corregido para Inserción o Edición
 */
function abrirModalInventario(datos = null) {
    console.log("📂 [MODAL HARDWARE] Abriendo modal de activos. Datos:", datos);
    const overlay = document.getElementById('modal-activo');
    if (!overlay) {
        console.error("❌ No se encontró el elemento con ID 'modal-activo' en el DOM.");
        return;
    }

    // Bloquear el scroll de la página trasera de fondo
    document.body.style.overflow = 'hidden';

    // Usar estructuras independientes para mapear campos de forma segura
    const txtId = document.getElementById('activo-id');
    if (txtId) txtId.value = datos?.id || '';

    const txtTitulo = document.getElementById('modal-activo-titulo');
    if (txtTitulo) txtTitulo.textContent = datos ? '🔧 Editar Activo Tecnológico' : '📦 Registrar Nuevo Activo';

    const txtNombre = document.getElementById('activo-nombre');
    if (txtNombre) txtNombre.value = datos?.nombre || '';

    const txtSerie = document.getElementById('activo-serie');
    if (txtSerie) txtSerie.value = datos?.numero_serie || '';

    const txtMarca = document.getElementById('activo-marca');
    if (txtMarca) txtMarca.value = datos?.marca || '';
    
    const txtUbicacion = document.getElementById('activo-ubicacion');
    if (txtUbicacion) {
        txtUbicacion.value = datos?.ubicacion_fisica || datos?.ubicacion || '';
    }
    
    const selectCategoria = document.getElementById('activo-select-cat');
    if (selectCategoria) {
        selectCategoria.value = datos?.categoria ? datos.categoria.toLowerCase() : selectCategoria.options[0]?.value || '';
    }

    // Despliegue con animación
    overlay.style.display = 'flex';
}

function cerrarModalInventario() {
    const overlay = document.getElementById('modal-activo');
    if (overlay) {
        overlay.style.display = 'none';
    }
    // Desbloquear el scroll devolviendo el control al navegador
    document.body.style.overflow = '';
}

/**
 * Filtro local reactivo en memoria adaptado para las nuevas tarjetas
 */
function filtrarInventarioLocal() {
    const query = document.getElementById('buscar-inventario')?.value.toLowerCase().trim() || '';
    const catFiltro = document.getElementById('filtro-categoria')?.value || 'todos';
    const estFiltro = document.getElementById('filtro-estado')?.value || 'todos';

    const resultados = listadoActivos.filter(activo => {
        const cumpleTexto = !query || 
            (activo.nombre || '').toLowerCase().includes(query) || 
            (activo.numero_serie || '').toLowerCase().includes(query);

        const cumpleCat = catFiltro === 'todos' || (activo.categoria || '').toLowerCase() === catFiltro;
        
        let estadoLimpio = (activo.estado || '').toLowerCase();
        let cumpleEst = estFiltro === 'todos';
        if (estFiltro === 'disponible') cumpleEst = estadoLimpio.includes('disp');
        if (estFiltro === 'prestado') cumpleEst = estadoLimpio.includes('prest');
        if (estFiltro === 'mantenimiento') cumpleEst = estadoLimpio.includes('manten') || estadoLimpio.includes('fall');
        if (estFiltro === 'baja') cumpleEst = estadoLimpio.includes('baja');

        return cumpleTexto && cumpleCat && cumpleEst;
    });
    
    renderizarTarjetasActivos(resultados); 
}

function editarActivo(id) {
    const activoEncontrado = listadoActivos.find(x => x.id === id);
    if (activoEncontrado) {
        abrirModalInventario(activoEncontrado);
    }
}

/**
 * Procesa la acción del formulario hacia la API RESTful de Flask
 */
async function guardarActivoInventario(event) {
    event.preventDefault();

    const idEdicion = document.getElementById('activo-id').value;
    const baseAPI = window.API || '/api';

    const payload = {
        nombre: document.getElementById('activo-nombre').value.trim(),
        categoria: document.getElementById('activo-select-cat').value,
        numero_serie: document.getElementById('activo-serie').value.trim(),
        marca: document.getElementById('activo-marca').value.trim(),
        ubicacion_fisica: document.getElementById('activo-ubicacion').value.trim(),
        estado: idEdicion ? listadoActivos.find(x => x.id == idEdicion)?.estado : 'Disponible',
        usuario_id: usuarioActivo.id
    };

    try {
        // Alerta de procesamiento asíncrono
        Swal.fire({
            title: 'Guardando activo...',
            text: 'Sincronizando información de hardware.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); },
            background: '#111827',
            color: '#f3f4f6'
        });

        const urlFinal = idEdicion ? `${baseAPI}/activos/${idEdicion}` : `${baseAPI}/activos`;
        const metodoHTTP = idEdicion ? 'PUT' : 'POST';

        const respuesta = await fetch(urlFinal, {
            method: metodoHTTP,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (respuesta.ok) {
            cerrarModalInventario();
            await cargarModuloActivos();
            
            Swal.fire({
                title: '¡Éxito!',
                text: idEdicion ? 'Activo actualizado correctamente.' : 'Nuevo activo registrado en el inventario.',
                icon: 'success',
                confirmButtonColor: '#3b82f6',
                background: '#111827',
                color: '#f3f4f6'
            });
        } else {
            Swal.fire({
                title: 'Error Operacional',
                text: 'El servidor denegó la inserción o actualización de la pieza.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
                background: '#111827',
                color: '#f3f4f6'
            });
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        Swal.fire({
            title: 'Error de Enlace',
            text: 'Fallo de conexión crítico con el backend de Flask.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
            background: '#111827',
            color: '#f3f4f6'
        });
    }
}

/**
 * Ejecuta la baja lógica de un activo usando SweetAlert2 (Modo Oscuro Oficial)
 */
async function eliminarActivo(id) {
    const activoEncontrado = listadoActivos.find(x => x.id === id);
    const nombreActivo = activoEncontrado ? activoEncontrado.nombre : `ID #${id}`;

    const resultado = await Swal.fire({
        title: '⚠️ ¿Procesar baja física?',
        text: `¿Deseas dar de baja el activo "${nombreActivo}" de los estantes del laboratorio de la universidad?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444', 
        cancelButtonColor: '#4b5563',
        confirmButtonText: 'Sí, confirmar baja',
        cancelButtonText: 'Conservar activo',
        background: '#111827',
        color: '#f3f4f6'
    });

    if (!resultado.isConfirmed) return;

    try {
        Swal.fire({
            title: 'Dando de baja...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); },
            background: '#111827',
            color: '#f3f4f6'
        });

        const baseAPI = window.API || '/api';
        const respuesta = await fetch(`${baseAPI}/activos/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario_id: usuarioActivo.id })
        });

        if (respuesta.ok) {
            await cargarModuloActivos();
            
            Swal.fire({
                title: 'Baja Registrada',
                text: 'El estado del activo se ha actualizado a "Dado de Baja" y se guardó en la caja negra.',
                icon: 'success',
                confirmButtonColor: '#3b82f6',
                background: '#111827',
                color: '#f3f4f6'
            });
        } else {
            Swal.fire({
                title: 'Acción Denegada',
                text: 'El servidor rechazó procesar la baja del activo seleccionado.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
                background: '#111827',
                color: '#f3f4f6'
            });
        }
    } catch (error) {
        Swal.fire({
            title: 'Fallo de Red',
            text: 'Error de conexión al procesar la remoción de hardware.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
            background: '#111827',
            color: '#f3f4f6'
        });
    }
}

/**
 * Carga las categorías del backend para mantener consistencia de catálogo
 */
async function cargarCategoriasDinamicas() {
    const selectCat = document.getElementById('activo-select-cat');
    if (!selectCat) return;

    try {
        const baseAPI = window.API || '/api';
        const respuesta = await fetch(`${baseAPI}/activos/categorias`);
        const categories = await respuesta.json();
        if (categories && categories.length > 0) {
            selectCat.innerHTML = categories.map(cat => `
                <option value="${cat.toLowerCase()}">${cat}</option>
            `).join('');
        }
    } catch (error) {
        console.warn("Cargando catálogo por defecto.");
    }
}

function manejarCambioCSV(evento) {
    const archivo = evento.target.files[0];
    if (archivo) {
        procesarArchivoCSV(archivo);
        evento.target.value = '';
    }
}

function procesarArchivoCSV(archivo) {
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = async function (e) {
        const lineas = e.target.result.split('\n');
        const nuevosActivos = [];
        const seriesDuplicadasLocal = new Set();

        for (let i = 1; i < lineas.length; i++) {
            const lineaLimpia = lineas[i].trim();
            if (!lineaLimpia) continue;

            const columnas = lineaLimpia.split(',');
            if (columnas.length < 4) continue;
            
            const activo = {
                nombre: columnas[0].trim(),
                categoria: columnas[1].trim(),
                numero_serie: columnas[2].trim(),
                ubicacion_fisica: columnas[3].trim(),
                estado: 'Disponible',
                usuario_id: usuarioActivo.id
            };

            if (listadoActivos.some(a => a.numero_serie === activo.numero_serie) || seriesDuplicadasLocal.has(activo.numero_serie)) {
                continue;
            }

            seriesDuplicadasLocal.add(activo.numero_serie);
            nuevosActivos.push(activo);
        }

        if (nuevosActivos.length === 0) {
            Swal.fire({
                title: 'Sin Registros',
                text: 'No se encontraron registros nuevos o válidos en el CSV.',
                icon: 'info',
                confirmButtonColor: '#3b82f6',
                background: '#111827',
                color: '#f3f4f6'
            });
            return;
        }

        try {
            const baseAPI = window.API || '/api';
            const respuesta = await fetch(`${baseAPI}/activos/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevosActivos)
            });
            if (respuesta.ok) {
                Swal.fire({
                    title: '¡Lote Procesado!',
                    text: `Se inyectaron ${nuevosActivos.length} activos al almacén con éxito.`,
                    icon: 'success',
                    confirmButtonColor: '#3b82f6',
                    background: '#111827',
                    color: '#f3f4f6'
                });
                await cargarModuloActivos();
            }
        } catch (err) {
            Swal.fire({
                title: 'Error de Bloque',
                text: 'Error de red al intentar enviar el bloque CSV.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
                background: '#111827',
                color: '#f3f4f6'
            });
        }
    };
    lector.readAsText(archivo);
}

// Registrar funciones en el entorno de ejecución global del navegador
window.inicializarModuloInventario = inicializarModuloInventario;
window.abrirModalInventario = abrirModalInventario;
window.cerrarModalInventario = cerrarModalInventario;
window.guardarActivoInventario = guardarActivoInventario;
window.editarActivo = editarActivo;
window.eliminarActivo = eliminarActivo;
window.filtrarInventarioLocal = filtrarInventarioLocal;
window.manejarCambioCSV = manejarCambioCSV;