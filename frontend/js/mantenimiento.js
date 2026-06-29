// frontend/js/mantenimiento.js

const operadorTaller = {
    id: localStorage.getItem("user_id") || 1,
    rol: localStorage.getItem("user_rol"),
    nombre: localStorage.getItem("user_nombre")
};

let listaActivosDisponibles = [];

// 🚀 FUNCIÓN DESPERTADOR PARA MAIN.JS
function inicializarModuloMantenimiento() {
    console.log("🔧 Inicializador del módulo de Mantenimiento invocado.");
    cargarModuloMantenimiento();
}

// MOTOR DE CONSUMO DE API: Carga mantenimientos y filtra los activos disponibles
async function cargarModuloMantenimiento() {
    try {
        // 🚀 CORREGIDO: Se cambia /mantenimiento por /mantenimientos en plural
        const mantenimientosRes = await fetch(`${window.API}/mantenimientos`);
        
        if (!mantenimientosRes.ok) {
            throw new Error(`El backend respondió con estado ${mantenimientosRes.status}`);
        }
        const datosMantenimiento = await mantenimientosRes.json();

        // Consultamos los activos para llenar el formulario modal
        const activosRes = await fetch(`${window.API}/activos`);
        if (activosRes.ok) {
            const datosActivos = await activosRes.json();
            // Filtramos los que están listos para mandarse a reparar
            listaActivosDisponibles = datosActivos.filter(a => a.estado === 'disponible');
        }

        renderizarTablaMantenimiento(datosMantenimiento);
    } catch (error) {
        console.error("[ERROR] mantenimiento.cargarModuloMantenimiento:", error);
        const contenedor = document.getElementById('tablaWrap');
        if (contenedor) {
            contenedor.innerHTML = `<div class="loading" style="color:var(--danger)">Error al sincronizar con el taller: ${error.message}</div>`;
        }
    }
}

// RENDERIZADOR DE TABLA EN INTERFAZ
function renderizarTablaMantenimiento(datos) {
    const contenedor = document.getElementById('tablaWrap');
    if (!contenedor) return;

    if (!Array.isArray(datos)) {
        console.error("Se esperaba un arreglo pero se recibió:", datos);
        contenedor.innerHTML = '<div class="loading" style="color:var(--danger)">Formato de datos inválido de la API.</div>';
        return;
    }

    if (datos.length === 0) {
        contenedor.innerHTML = '<div class="loading" style="color:var(--text-muted)">No hay equipos registrados en el taller de mantenimiento.</div>';
        return;
    }

    // Mapeo exacto con los nombres de columna devueltos por tu query SQL
    const rows = datos.map(m => `
        <tr>
            <td>#${m.mantenimiento_id}</td>
            <td><strong>${m.activo_nombre}</strong></td>
            <td><span style="font-family:monospace; font-size:12px;">${m.numero_series || m.numero_serie || 'N/A'}</span></td>
            <td>${m.tecnico_responsable}</td>
            <td style="color: var(--warn, #f59e0b); font-size:12px;">${m.descripcion_falla}</td>
            <td>$${parseFloat(m.costo || 0).toFixed(2)}</td>
            <td><span class="badge abierto">En Taller</span></td>
            <td>
                <button class="btn-finalize" onclick="abrirCerrarMantenimiento(${m.mantenimiento_id})">Finalizar</button>
            </td>
        </tr>
    `).join('');

    contenedor.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Orden</th>
                    <th>Activo Tecnológico</th>
                    <th>N/S Equipo</th>
                    <th>Técnico Responsable</th>
                    <th>Reporte de Falla</th>
                    <th>Costo Estimado</th>
                    <th>Estado</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>`;
}

// CONTROL DE MODAL: NUEVA ORDEN
function abrirModalMantenimiento() {
    const modal = document.getElementById('overlayRegistrar');
    modal.style.display = 'flex';
    document.getElementById('msgModal').textContent = '';
    
    const selectActivos = document.getElementById('fActivo');
    if (listaActivosDisponibles.length === 0) {
        selectActivos.innerHTML = '<option value="">No hay equipos disponibles para reparar</option>';
        return;
    }

    selectActivos.innerHTML = listaActivosDisponibles.map(a => `
        <option value="${a.id || a.activo_id}">${a.nombre} [${a.numero_serie || 'S/N'}]</option>
    `).join('');
}

function cerrarModalMantenimiento() {
    document.getElementById('overlayRegistrar').style.display = 'none';
    document.getElementById('formMantenimiento').reset();
}

// PROCESAR GUARDADO DE ORDEN (POST)
async function guardarOrdenMantenimiento(evento) {
    evento.preventDefault();
    const idActivo = document.getElementById('fActivo').value;
    const msg = document.getElementById('msgModal');

    if (!idActivo) {
        msg.style.color = 'var(--danger, #ef4444)';
        msg.textContent = 'No seleccionaste ningún activo válido.';
        return;
    }

    // 🚀 CORREGIDO: cambiamos 'costo_estimado' por 'costo' para que coincida con data['costo'] de tu Flask
    const payload = {
        activo_id: parseInt(idActivo),
        descripcion_falla: document.getElementById('fFalla').value.trim(),
        tecnico_responsable: document.getElementById('fTecnico').value.trim(),
        costo: parseFloat(document.getElementById('fCosto').value) || 0
    };

    try {
        // 🚀 CORREGIDO: Ruta en plural /mantenimientos
        const res = await fetch(`${window.API}/mantenimientos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Error transaccional en el servidor.');
        const data = await res.json();

        msg.style.color = '#34d399';
        msg.textContent = 'Equipo ingresado al taller correctamente.';
        
        setTimeout(() => {
            document.getElementById('overlayRegistrar').style.display = 'none';
            document.getElementById('formMantenimiento').reset();
            cargarModuloMantenimiento();
        }, 750);

    } catch (error) {
        console.error('[ERROR] guardarOrdenMantenimiento:', error);
        msg.style.color = 'var(--danger, #ef4444)';
        msg.textContent = 'Error crítico de comunicación con el servidor.';
    }
}

// CONTROL DE MODAL: CIERRE / FINALIZAR REPARACIÓN
function abrirCerrarMantenimiento(idMantenimiento) {
    document.getElementById('cerrarId').value = idMantenimiento;
    document.getElementById('msgCerrar').textContent = '';
    document.getElementById('fCostoFinal').value = '0';
    document.getElementById('overlayCerrar').style.display = 'flex';
}

function cerrarModalCerrar() {
    document.getElementById('overlayCerrar').style.display = 'none';
}

// PROCESAR ACCIÓN DEL BOTÓN LIBERAR (PUT)
async function guardarCerrarMantenimiento() {
    const idMaint = document.getElementById('cerrarId').value;
    const msg = document.getElementById('msgCerrar');
    
    const payload = {
        costo_final: parseFloat(document.getElementById('fCostoFinal').value) || 0
    };

    try {
        // 🚀 CORREGIDO: Ruta en plural y mapeo correcto a /mantenimientos/cerrar/<id>
        const res = await fetch(`${window.API}/mantenimientos/cerrar/${idMaint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('No se pudo completar el cierre en la Base de Datos.');
        const data = await res.json();

        msg.style.color = '#34d399';
        msg.textContent = 'Orden cerrada. Equipo devuelto al inventario.';
        
        setTimeout(() => {
            document.getElementById('overlayCerrar').style.display = 'none';
            cargarModuloMantenimiento();
        }, 750);

    } catch (error) {
        console.error('[ERROR] guardarCerrarMantenimiento:', error);
        msg.style.color = 'var(--danger, #ef4444)';
        msg.textContent = 'Fallo de conexión al cerrar la orden.';
    }
}