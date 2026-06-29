/* =========================================================================
   MÓDULO DE LOGICA ASÍNCRONA - FORMULARIO DE SALIDA (REPARADO Y VINCULADO)
   ========================================================================= */

/**
 * Inicializador disparado por el router maestro al cargar la vista #salida
 */
async function inicializarModuloSalida() {
    console.log("📥 [VENTANILLA] Inicializando control de asignaciones...");
    
    // 1. Configuraciones iniciales de los inputs
    configurarFechaMinimaRetorno();
    
    // 2. Carga asíncrona del catálogo de modelos desde la API
    await cargarModelosDisponibles();
    
    // 3. Activar el escuchador del primer desplegable
    configurarCambioModelo();

    // 4. SOLUCIÓN: Vincular el envío del formulario AQUÍ, justo tras asegurar su existencia en el DOM
    vincularEventoFormulario();
}

// Exponer la función al objeto global window para el Router SPA
if (typeof window.inicializarModuloSalida !== 'function') {
    window.inicializarModuloSalida = inicializarModuloSalida;
}

/**
 * Restringe las fechas de retorno para evitar registros retroactivos
 */
function configurarFechaMinimaRetorno() {
    const inputFecha = document.getElementById('reg-prestamo-retorno');
    if (!inputFecha) return;
    
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    
    inputFecha.min = `${anio}-${mes}-${dia}`;
}

/**
 * Obtiene el catálogo de activos y llena el primer desplegable
 */
async function cargarModelosDisponibles() {
    const selectModelo = document.getElementById('reg-prestamo-modelo');
    if (!selectModelo) return;

    const token = localStorage.getItem('token');

    try {
        const respuesta = await fetch('/api/activos', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!respuesta.ok) throw new Error(`Status API: ${respuesta.status}`);
        const activos = await respuesta.json();

        const modelosUnicos = [...new Set(activos
            .map(a => a.modelo_nombre || a.nombre)
            .filter(Boolean)
        )].sort();

        selectModelo.innerHTML = '<option value="" disabled selected>-- Seleccione un Dispositivo --</option>';

        if (modelosUnicos.length === 0) {
            selectModelo.innerHTML = '<option value="" disabled>⚠️ No hay equipos en inventario</option>';
            return;
        }

        modelosUnicos.forEach(modelo => {
            const opt = document.createElement('option');
            opt.value = modelo;
            opt.textContent = modelo;
            selectModelo.appendChild(opt);
        });

    } catch (error) {
        console.error("❌ Falló la carga de modelos:", error);
        selectModelo.innerHTML = '<option value="" disabled>Error al enlazar con el inventario</option>';
    }
}

/**
 * Escucha el cambio del primer selector y filtra las series
 */
function configurarCambioModelo() {
    const selectModelo = document.getElementById('reg-prestamo-modelo');
    const selectSerie = document.getElementById('reg-prestamo-serie');
    const txtStatus = document.getElementById('txt-disponibilidad-status');

    if (!selectModelo || !selectSerie) return;

    selectModelo.addEventListener('change', async () => {
        const modeloSeleccionado = selectModelo.value;
        const token = localStorage.getItem('token');

        selectSerie.disabled = true;
        selectSerie.innerHTML = '<option value="" disabled selected>Buscando números de serie...</option>';
        if (txtStatus) txtStatus.textContent = "Buscando existencias...";

        try {
            const respuesta = await fetch('/api/activos', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!respuesta.ok) throw new Error(`Status API: ${respuesta.status}`);
            const activos = await respuesta.json();

            const seriesDisponibles = activos.filter(a => 
                (a.nombre === modeloSeleccionado || a.modelo_nombre === modeloSeleccionado)
            );

            selectSerie.innerHTML = '<option value="" disabled selected>-- Seleccione un Número de Serie --</option>';

            if (seriesDisponibles.length === 0) {
                selectSerie.innerHTML = '<option value="" disabled>Sin stock en este momento</option>';
                if (txtStatus) txtStatus.textContent = "Agotado físicamente.";
                return;
            }

            seriesDisponibles.forEach(activo => {
                const opt = document.createElement('option');
                opt.value = activo.id || activo.activo_individual_id; 
                
                const ubicacionEstante = activo.ubicacion_fisica || 'General';
                const numeroSerieStr = activo.numero_serie || 'S/N';
                const estadoStr = (activo.estado || 'activo').toUpperCase();

                opt.textContent = `${numeroSerieStr} (Estante: ${ubicacionEstante}) [${estadoStr}]`;
                selectSerie.appendChild(opt);
            });

            selectSerie.disabled = false;
            if (txtStatus) txtStatus.textContent = `Se encontraron (${seriesDisponibles.length}) unidades listas para asignación.`;

        } catch (error) {
            console.error("❌ Error al procesar cambio de modelo:", error);
            selectSerie.innerHTML = '<option value="" disabled>Error al cargar stock</option>';
        }
    });
}

/**
 * Vincula los rastreadores críticos al evento submit del formulario
 */
function vincularEventoFormulario() {
    const formulario = document.getElementById('form-nuevo-prestamo');
    if (!formulario) {
        console.error("❌ CRÍTICO: No se encontró el formulario '#form-nuevo-prestamo' en el DOM.");
        return;
    }

    // Remueve listeners previos para evitar ejecuciones duplicadas
    formulario.removeAttribute('onsubmit'); 

    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        console.group("🚀 [RASTREADOR SALIDA] Iniciando proceso de envío...");

        const token = localStorage.getItem('token');
        const activoIndividualId = document.getElementById('reg-prestamo-serie').value; 
        const matricula = document.getElementById('reg-prestamo-matricula').value.trim();
        const fechaRetorno = document.getElementById('reg-prestamo-retorno').value;
        const usuarioOperadorId = localStorage.getItem('usuario_id') ? parseInt(localStorage.getItem('usuario_id')) : 1;

        // RASTREADOR 1: Estado de las variables locales antes del viaje
        console.log("📊 Datos recolectados del DOM:", {
            token_existente: !!token,
            activo_individual_id_raw: activoIndividualId,
            solicitante_matricula: matricula,
            fecha_devolucion_prevista: fechaRetorno,
            usuario_operador_id: usuarioOperadorId
        });

        // REPARACIÓN COMPONENTE: Validación de Serie Seleccionada
        if (!activoIndividualId || isNaN(parseInt(activoIndividualId))) {
            console.error("❌ CRÍTICO: El valor de la ID del activo es inválido o está vacío.");
            
            mostrarNotificacionOperador(
                'error',
                'Asignación Incompleta',
                'Por favor, seleccione un número de serie válido del catálogo antes de otorgar el préstamo.'
            );
            
            console.groupEnd();
            return;
        }

        const payload = {
            activo_individual_id: parseInt(activoIndividualId),
            usuario_operador_id: usuarioOperadorId,
            solicitante_matricula: matricula,
            fecha_devolucion_prevista: fechaRetorno
        };

        // RASTREADOR 2: Inspección del cuerpo JSON
        console.log("📦 Cuerpo JSON (Payload) a enviar:", JSON.stringify(payload));

        try {
            console.log("🌐 Conectando con: /api/prestamos ...");
            
            const respuesta = await fetch('/api/prestamos', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // RASTREADOR 3: Estado de la respuesta HTTP
            console.log(`📡 HTTP Status recibido: ${respuesta.status} (${respuesta.statusText})`);

            let data;
            try {
                data = await respuesta.json();
                console.log("📥 JSON devuelto por el servidor Flask:", data);
            } catch (jsonErr) {
                console.error("💥 El servidor no devolvió JSON puro. ¿Ocurrió un error HTML 500?", jsonErr);
                
                mostrarNotificacionOperador(
                    'error',
                    'Error del Servidor',
                    'La respuesta del servidor no tiene un formato JSON válido (Posible código 500).'
                );
                
                console.groupEnd();
                return;
            }

            // RASTREADOR 4: Validación de éxito
            if (respuesta.ok && (data.success || data.status === 'ok' || data.id)) {
                console.log("🎉 [ÉXITO] Transacción completada en la Base de Datos.");
                
                // NOTIFICACIÓN PREMIUM EXPOSITIVA DE ÉXITO
                mostrarNotificacionOperador(
                    'success',
                    '¡Préstamo Exitoso!',
                    `El activo fue asignado correctamente a la matrícula ${matricula} dentro del sistema.`
                );
                
                formulario.reset();
                document.getElementById('reg-prestamo-serie').disabled = true;
                window.location.hash = 'transito'; 
            } else {
                console.warn("⚠️ [RECHAZADO] Flask denegó la inserción del préstamo:", data.error || data);
                
                // NOTIFICACIÓN PREMIUM EXPOSITIVA DE RECHAZO (Idéntico a tu captura)
                mostrarNotificacionOperador(
                    'error',
                    'Error Operacional',
                    data.error || 'El servidor denegó la inserción o actualización de la pieza.'
                );
            }

        } catch (error) {
            // RASTREADOR 5: Fallos de infraestructura de red
            console.error("💥 [FALLO CRÍTICO DE RED] No hay conexión con el backend:", error);
            
            mostrarNotificacionOperador(
                'error',
                'Fallo de Red',
                'No se logró establecer la comunicación. Asegúrate de que el backend en Flask esté encendido.'
            );
        }

        console.groupEnd();
    });
    
    console.log("✅ Escuchador del botón 'Otorgar Préstamo' listo e inyectado.");
}