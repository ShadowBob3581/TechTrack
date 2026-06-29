/**
 * LÓGICA INTERACTIVA DE LA QUINTA VISTA: IMPORTADOR MASIVO API-FLASK
 */
function inicializarModuloImportacion() {
    console.log("⚡ [MÓDULO IMPORTADOR] Inicializando listeners de ingesta masiva...");

    const dropZone = document.getElementById('import-drop-zone');
    const fileInput = document.getElementById('import-file-input');
    const fileStatusBlock = document.getElementById('file-status-block');
    const nameDisplay = document.getElementById('file-name-display');
    const sizeDisplay = document.getElementById('file-size-display');
    const btnRemove = document.getElementById('btn-remove-file');
    const btnExecute = document.getElementById('btn-execute-import');
    const progressContainer = document.getElementById('import-progress-container');
    const progressBar = document.getElementById('import-progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressDetails = document.getElementById('progress-details');
    
    // Elementos de las plantillas de ejemplo
    const btnDownloadCSV = document.getElementById('btn-download-csv');
    const btnDownloadJSON = document.getElementById('btn-download-json');
    const targetTableSelect = document.getElementById('import-target-table');

    // 🛡️ CONTROL DE INYECCIÓN CRÍTICA: Si el DOM no está listo, abortamos limpiamente sin romper el enrutador
    if (!dropZone || !fileInput || !btnDownloadCSV || !btnDownloadJSON || !targetTableSelect) {
        console.warn("⏳ [MÓDULO IMPORTADOR] Los elementos del DOM aún no están listos o falta el HTML de las plantillas.");
        return; 
    }

    let archivoSeleccionado = null;

    // Abrir examinador de archivos al hacer click en la drop-zone
    dropZone.addEventListener('click', (e) => {
        if (e.target !== fileInput) {
            fileInput.click();
        }
    });

    // Prevenciones obligatorias por defecto del navegador para arrastrar y soltar
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    // Listeners del efecto "Arrastrar y Soltar"
    dropZone.addEventListener('dragover', () => {
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            validarYProcesarArchivo(e.dataTransfer.files[0]);
        }
    });

    // Escuchar la selección manual desde explorador de archivos
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            validarYProcesarArchivo(e.target.files[0]);
        }
    });

    // Validar formato (.csv o .json)
    function validarYProcesarArchivo(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        if (extension !== 'csv' && extension !== 'json') {
            alert('❌ Formato no válido. Por favor sube únicamente archivos .CSV o .JSON');
            fileInput.value = "";
            return;
        }

        archivoSeleccionado = file;
        nameDisplay.textContent = file.name;
        sizeDisplay.textContent = `${(file.size / 1024).toFixed(1)} KB`;

        // Modificar visibilidad de bloques intermedios
        dropZone.style.display = 'none';
        fileStatusBlock.style.display = 'flex';
        btnExecute.disabled = false;
        
        // Resetear barra de progreso por si había una carga previa
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        progressBar.style.background = ''; // Resetea color de error si existía
        progressPercentage.textContent = '0%';
        progressDetails.textContent = 'Listo para iniciar la ingesta...';
        progressDetails.style.color = 'var(--secondary, #8a99ad)';
    }

    // Remover archivo seleccionado
    btnRemove.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Evita herencia de click hacia la Dropzone
        archivoSeleccionado = null;
        fileInput.value = "";
        fileStatusBlock.style.display = 'none';
        dropZone.style.display = 'block';
        btnExecute.disabled = true;
        progressContainer.style.display = 'none';
    });

    // Ejecutar el envío AJAX hacia Flask mediante FormData
    btnExecute.addEventListener('click', async () => {
        if (!archivoSeleccionado) return;

        const targetTable = targetTableSelect.value;
        const strategy = document.getElementById('import-strategy').value;

        // Construir el cuerpo de envío binario multiparte
        const formData = new FormData();
        formData.append('file', archivoSeleccionado);
        formData.append('target_table', targetTable);
        formData.append('strategy', strategy);

        // Desactivar interfaz durante la subida
        btnExecute.disabled = true;
        btnRemove.disabled = true;
        progressContainer.style.display = 'block';
        progressDetails.textContent = 'Abriendo stream y procesando buffer...';
        
        // Simular progreso de lectura local antes del envío masivo
        let dummyProgress = 0;
        const interval = setInterval(() => {
            if (dummyProgress < 85) {
                dummyProgress += 5;
                progressBar.style.width = `${dummyProgress}%`;
                progressPercentage.textContent = `${dummyProgress}%`;
            }
        }, 80);

        try {
            const token = localStorage.getItem('token');
            
            // Opción A: Ruta semántica estructurada
            const respuesta = await fetch('/api/importacion/ejecutar', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            clearInterval(interval);

            const resultado = await respuesta.json();

            if (respuesta.ok) {
                progressBar.style.width = '100%';
                progressPercentage.textContent = '100%';
                progressDetails.textContent = '¡Ingesta completada de forma exitosa!';
                progressDetails.style.color = '#00ff88';
                
                // Reporte detallado utilizando el payload real de tu importacion_controller.py
                alert(`🎉 ¡Sincronización Exitosa!\n\n` +
                      `• Registros insertados: ${resultado.registros_ingresados}\n` +
                      `• Registro omitidos/conflictos: ${resultado.registros_omitidos_o_conflictos}`);
                
                btnRemove.disabled = false;
            } else {
                throw new Error(resultado.error || `Código de respuesta: ${respuesta.status}`);
            }

        } catch (error) {
            clearInterval(interval);
            console.error("❌ [IMPORTADOR ERROR]:", error);
            
            progressBar.style.width = '100%';
            progressBar.style.background = '#ff4a4a';
            progressPercentage.textContent = 'ERR';
            progressDetails.textContent = 'Fallo crítico en la transacción SQL.';
            progressDetails.style.color = '#ff4a4a';
            
            alert(`💥 Falló la importación masiva:\n${error.message}\n\nRevisa que los Enums y las columnas coincidan con las restricciones de tu DB.`);
            btnExecute.disabled = false;
            btnRemove.disabled = false;
        }
    });

    // =====================================================================
    // 📥 LÓGICA DE GENERACIÓN Y DESCARGA DINÁMICA DE PLANTILLAS
    // =====================================================================
    
    // Asegúrate de que el value coincida con la propiedad de abajo:
    // <option value="prestamos">📋 Historial de Préstamos y Retornos</option>

    const plantillasModelo = {
        activos: {
            csv: "nombre_modelo,categoria,ubicacion_fisica,numero_serie,estado\nLenovo ThinkStation P3 Tiny,Cómputo,Laboratorio B,BRG589969K88,disponible\nImpresora 3D Creality Ender 3,Impresión 3D,Laboratorio A,CR3D884931,disponible",
            json: [
                { "nombre_modelo": "Lenovo ThinkStation P3 Tiny", "categoria": "Cómputo", "ubicacion_fisica": "Laboratorio B", "numero_serie": "BRG589969K88", "estado": "disponible" },
                { "nombre_modelo": "Impresora 3D Creality Ender 3", "categoria": "Impresión 3D", "ubicacion_fisica": "Laboratorio A", "numero_serie": "CR3D884931", "estado": "disponible" }
            ]
        },
        usuarios: {
            csv: "usuario,nombre,password,rol,aprobado\n20260002,Elena Pérez,password123,operador,true\n20260003,Carlos Mendoza,password456,operador,false",
            json: [
                { "usuario": "20260002", "nombre": "Elena Pérez", "password": "password123", "rol": "operador", "aprobado": true },
                { "usuario": "20260003", "nombre": "Carlos Mendoza", "password": "password456", "rol": "operador", "aprobado": false }
            ]
        },
        // 🔥 SOLUCIÓN: Añadimos la propiedad faltante para evitar el Undefined
        prestamos: {
            csv: "activo_individual_id,usuario_id,fecha_prestamo,fecha_devolucion,estado\n1,5,2026-06-01 10:00:00,,activo\n2,8,2026-06-15 14:20:00,2026-06-20 18:00:00,devuelto",
            json: [
                { "activo_individual_id": 1, "usuario_id": 5, "fecha_prestamo": "2026-06-01 10:00:00", "fecha_devolucion": null, "estado": "activo" },
                { "activo_individual_id": 2, "usuario_id": 8, "fecha_prestamo": "2026-06-15 14:20:00", "fecha_devolucion": "2026-06-20 18:00:00", "estado": "devuelto" }
            ]
        }
    };

    function descargarArchivoLocal(contenido, nombreArchivo, mimeType) {
        const blob = new Blob([contenido], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    btnDownloadCSV.addEventListener('click', () => {
        const entidad = targetTableSelect.value;
        const datos = plantillasModelo[entidad].csv;
        descargarArchivoLocal(datos, `plantilla_${entidad}_ejemplo.csv`, 'text/csv;charset=utf-8;');
    });

    btnDownloadJSON.addEventListener('click', () => {
        const entidad = targetTableSelect.value;
        const datos = JSON.stringify(plantillasModelo[entidad].json, null, 4);
        descargarArchivoLocal(datos, `plantilla_${entidad}_ejemplo.json`, 'application/json;charset=utf-8;');
    });
}