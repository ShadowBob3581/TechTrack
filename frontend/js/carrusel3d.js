// =========================================================================
//  1. CONFIGURACIÓN PRINCIPAL DE FISICAS Y ORBITA (MANTENIDA EXACTA)
// =========================================================================
const CONFIG = {
    radioHorizontal: 0.60,   
    radioVertical: 0.01,     
    profundidadZ: 350,       
    gravedad: 0.05,          
    friccionAire: 0.94,      
    sensibilidadInercia: 2 
};

// =========================================================================
//  2. CONTROL DE DATOS DINÁMICOS (TABLA DE EXISTENCIAS DE ACTIVOS)
// =========================================================================
let prestamos = []; // Una sola declaración global limpia

async function cargarPrestamosDesdeBD() {
    try {
        const respuesta = await fetch('/api/prestamos');
        
        if (respuesta.ok) {
            const datosBD = await respuesta.json();
            
            console.log("=== DATOS RECIBIDOS DESDE FLASK ===", datosBD);
            
            if (!Array.isArray(datosBD) || datosBD.length === 0) {
                console.warn("La API respondió correctamente, pero el arreglo está vacío.");
                return;
            }

            // FILTRADO CORREGIDO: Buscamos 'disponible' en sintonía con la base de datos masiva
            const disponibles = datosBD.filter(item => {
                const estadoActual = item.estado || "";
                return estadoActual.toLowerCase().trim() === 'devuelto';
            });

            console.log(`Filtrado completo: ${disponibles.length} de ${datosBD.length} activos disponibles cargados.`);

            // MAPEO ADAPTADO A TUS LLAVES REALES:
            prestamos = disponibles.map(item => ({
                titulo: item.activo_nombre || "Dispositivo sin nombre", 
                categoria: item.categoria || "Dispositivo Tech",               
                serie: item.activo_serie || "S/N",                                
                ubicacion: item.ubicacion_fisica || "Almacén de Préstamos"
            }));
            
        } else {
            console.error("El servidor Flask respondió con un código de error:", respuesta.status);
        }
    } catch (error) {
        console.error("Error crítico al conectar con el servidor Flask:", error);
    }
}

// =========================================================================
//  3. MOTOR DE ANIMACIÓN (ADAPTATIVO AUTOMÁTICO)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    
    // Esperamos la respuesta asíncrona de la Base de Datos
    await cargarPrestamosDesdeBD();

    const axis = document.getElementById('axis');
    const container = document.getElementById('container');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    // --- ADAPTACIÓN DE VOLUMEN: Evita el amontonamiento limitando la renderización ---
    const maxTarjetasVisibles = 15;
    const datosVisibles = prestamos.slice(0, maxTarjetasVisibles);
    const totalElements = datosVisibles.length;

    // Validación por si la base de datos no tiene existencias disponibles en este momento
    if (totalElements === 0) {
        console.warn("No hay elementos disponibles para renderizar en la órbita.");
        if (axis) axis.innerHTML = "<div style='color:#ff4a4a; padding:20px;'>No hay dispositivos disponibles</div>";
        return;
    }

    // --- AJUSTE DINÁMICO DEL RADIO: Modifica la amplitud si hay pocas tarjetas ---
    let factorExpansion = totalElements > 8 ? CONFIG.radioHorizontal : 0.40;
    let radiusH = window.innerWidth * factorExpansion;   
    let radiusV = window.innerHeight * CONFIG.radioVertical;  

    const physicsData = datosVisibles.map(() => ({
        angleZ: 0, velZ: 0, 
        angleX: 0, velX: 0
    }));

    // Limpiar el contenedor e inyectar únicamente el bloque controlado
    if (axis) axis.innerHTML = "";
    datosVisibles.forEach((data, index) => {
        const el = document.createElement('div');
        el.className = 'orbit-item';
        el.innerHTML = `
            <div class="card-joint">
                <div class="orbit-string"></div>
                <div class="loan-card" data-index="${index}">
                    <div style="font-size: 0.75rem; color: var(--secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
                        ${data.categoria}
                    </div>
                    <h3>${data.titulo}</h3>
                    <div class="amount" style="font-size: 1.1rem; margin: 8px 0; color: #00ff88; text-shadow: 0 0 8px rgba(0,255,136,0.3);">
                        ● Disponible
                    </div>
                    <div class="details">
                        S/N: ${data.serie}<br>
                        <span style="color: #8a99ad;">Ubicación: ${data.ubicacion}</span>
                    </div>
                </div>
            </div>
        `;
        axis.appendChild(el);
    });

    const orbitItems = document.querySelectorAll('.orbit-item');
    const loanCards = document.querySelectorAll('.loan-card');

    let isDragging = false;
    let isCentering = false; 
    let isAutoSpinning = true; 

    let startX = 0;
    let currentRotation = 0;
    let targetRotation = 0;
    let lastRotationForPhysics = 0;
    let lastVelocityForPhysics = 0;

    function updateOrbitPosition(rotation) {
        let currentVel = rotation - lastRotationForPhysics;
        let acceleration = currentVel - lastVelocityForPhysics;
        
        lastVelocityForPhysics = currentVel;
        lastRotationForPhysics = rotation;

        orbitItems.forEach((item, index) => {
            const angleDeg = (index / totalElements) * 360 + rotation;
            const angleRad = angleDeg * (Math.PI / 180);
            
            const x = Math.sin(angleRad) * radiusH;
            const z = Math.cos(angleRad) * CONFIG.profundidadZ;
            const y = Math.cos(angleRad) * radiusV; 

            const zNorm = (z + CONFIG.profundidadZ) / (2 * CONFIG.profundidadZ); 
            const scale = 0.65 + zNorm * 0.35; 
            const opacity = 0.2 + zNorm * 0.8; 

            item.style.transform = `translate3d(${x}px, ${y}px, ${z}px) scale(${scale})`;
            item.style.opacity = opacity;
            item.style.zIndex = Math.round(zNorm * 100);

            let p = physicsData[index];
            const cardJointEl = item.querySelector('.card-joint');

            const directionFactor = Math.cos(angleRad); 
            const radialFactor = Math.sin(angleRad);    

            let forceZ = -acceleration * CONFIG.sensibilidadInercia * directionFactor; 
            let forceX = acceleration * CONFIG.sensibilidadInercia * radialFactor;     

            if (isAutoSpinning && Math.abs(currentVel) > 0.005) {
                forceZ += Math.sin(Date.now() * 0.002 + index) * 0.08;
            }

            p.velZ += forceZ;
            p.velX += forceX;
            p.velZ -= p.angleZ * CONFIG.gravedad;
            p.velX -= p.angleX * CONFIG.gravedad;
            p.velZ *= CONFIG.friccionAire;
            p.velX *= CONFIG.friccionAire;
            p.angleZ += p.velZ;
            p.angleX += p.velX;

            if (cardJointEl) {
                cardJointEl.style.transform = `rotateZ(${p.angleZ * 0.2}deg) rotateX(${p.angleX * 0.3}deg)`;
            }
        });
    }

    function centerCardByIndex(index) {
        isCentering = true;
        isAutoSpinning = false; 
        
        loanCards.forEach(c => c.classList.remove('selected'));
        const targetCard = document.querySelector(`.loan-card[data-index="${index}"]`);
        if(targetCard) targetCard.classList.add('selected');

        const targetAngleForCard = -(index / totalElements) * 360;
        const currentAngleNormalized = currentRotation % 360;
        let diff = targetAngleForCard - currentAngleNormalized;
        
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        targetRotation = currentRotation + diff;
    }

    loanCards.forEach(card => {
        card.addEventListener('click', () => {
            if (Math.abs(currentRotation - lastRotationForPhysics) > 1.5) return;
            const clickedIndex = parseInt(card.getAttribute('data-index'));
            centerCardByIndex(clickedIndex);
        });
    });

    function ejecutarBusqueda() {
        const textoQuery = searchInput.value.toLowerCase().trim();
        if (textoQuery === "") return;

        // Buscar coincidencias dentro de la lista de datos actualmente visibles
        const encontradoIndex = datosVisibles.findIndex(p => 
            p.titulo.toLowerCase().includes(textoQuery)
        );

        if (encontradoIndex !== -1) {
            centerCardByIndex(encontradoIndex);
        } else {
            searchInput.style.outline = "2px solid #ff4a4a";
            setTimeout(() => searchInput.style.outline = "none", 1500);
        }
    }

    searchButton.addEventListener('click', ejecutarBusqueda);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') ejecutarBusqueda();
    });

    function startDrag(clientX) {
        isDragging = true;
        isCentering = false;
        isAutoSpinning = true; 
        loanCards.forEach(c => c.classList.remove('selected'));
        startX = clientX;
        container.style.cursor = 'grabbing';
    }

    container.addEventListener('mousedown', (e) => startDrag(e.clientX));
    container.addEventListener('touchstart', (e) => startDrag(e.touches[0].clientX));

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = startX - e.clientX;
        targetRotation = currentRotation + (deltaX * 0.05); 
    });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const deltaX = startX - e.touches[0].clientX;
        targetRotation = currentRotation + (deltaX * 0.06);
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        container.style.cursor = 'default';
    });

    window.addEventListener('touchend', () => isDragging = false);

    function animate() {
        if (isCentering) {
            let diff = targetRotation - currentRotation;
            currentRotation += diff * 0.05; 
            if (Math.abs(diff) < 0.01) {
                currentRotation = targetRotation;
                isCentering = false;
            }
        } else if (isDragging) {
            currentRotation += (targetRotation - currentRotation) * 0.5;
        } else {
            if (isAutoSpinning) {
                currentRotation += 0.015; 
                targetRotation = currentRotation; 
            }
        }

        updateOrbitPosition(currentRotation);
        requestAnimationFrame(animate);
    }

    animate();

    window.addEventListener('resize', () => {
        radiusH = window.innerWidth * factorExpansion;
        radiusV = window.innerHeight * CONFIG.radioVertical;
    });
});