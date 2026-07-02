# 🛠️ Guía de Desarrollo e Integración (DEVELOPMENT.md)

Este documento detalla la arquitectura de los flujos de datos del sistema, pasos para entorno local sin Docker, testing de endpoints y resolución de problemas recurrentes.

---

## 🔄 Flujo de Datos Principal del Sistema

El sistema opera bajo una arquitectura desacoplada donde el Frontend (JS Vanilla SPA) se comunica mediante JSON con la API REST en Flask.

### 1️⃣ Flujo de Autenticación (Login)

```text
┌─────────────────────────────────────┐
│  Usuario ingresa credenciales       │
│  (login.html + auth.js)             │
└────────────────┬────────────────────┘
               │
               ▼
┌────────────────────────────┐
│ POST /api/auth/login       │
│ Payload: {usuario, pass}   │
└────────────┬───────────────┘
            │
            ▼
┌────────────────────────────────────┐
│ auth_controller.py:login()         │
│ 1. Valida credenciales              │
│ 2. Verifica hash de contraseña      │
│ 3. Valida aprobación del admin      │
│ 4. Registra en auditoría (IP+user)  │
└────────────┬───────────────────────┘
            │
            ▼
┌────────────────────────────────────┐
│ PostgreSQL Insert Audit             │
│ tabla: auditoria_movimientos        │
└────────────┬───────────────────────┘
            │
            ▼
┌────────────────────────────────────┐
│ Respuesta JSON con Token JWT       │
└────────────┬───────────────────────┘
            │
            ▼
┌────────────────────────────────────┐
│ auth.js almacena en sessionStorage  │
└────────────────────────────────────┘
```

### 2️⃣ Flujo CRUD de Activos (Inventario)
- **GET LISTA**: `GET /api/activos?categoria=Laptops` -> `activos_controller.py:listar()` -> Responde un arreglo JSON con el inventario actual.
- **CREAR ACTIVO**: `POST /api/activos` -> Inserta en `modelos_activos` -> Obtiene el ID generado -> Inserta en `activos_individuales` -> Envía registro automático a `auditoria_movimientos` con la acción `ALTA_ACTIVO`.
- **EDITAR / ELIMINAR**: Envía `PUT` o `DELETE` al endpoint `/api/activos/<id>`, actualiza las tablas físicas y dispara un log en la tabla de auditoría (`MODIFICACION_ACTIVO` / `ELIMINACION_ACTIVO`).

### 3️⃣ Flujo de Préstamos (Transacción Inteligente)
El registro e ingreso se dividen en transacciones SQL atómicas para salvaguardar la consistencia:
- **Salida (`POST /api/prestamos`)**: Abre bloque `BEGIN`. Valida que el activo esté `disponible` -> Inserta en `prestamos` -> Modifica `activos_individuales` estableciendo estado = `en_prestamo` -> Inserta log `PRESTAMO_SALIDA` -> `COMMIT`.
- **Devolución (`PUT /api/prestamos/<id>/devolver`)**: Recibe evaluación física (`bueno` o `dañado`). Modifica `prestamos` a estado `cerrado` con su fecha de retorno -> Modifica el activo de forma inteligente: si regresó `bueno` pasa a `disponible`, si regresó `dañado` pasa a `mantenimiento` -> Inserta log `PRESTAMO_DEVOLUCION` -> `COMMIT`.

### 4️⃣ Flujo de Auditoría (Sistema de Logs Inteligente)
Cada operación del backend captura los datos del token del usuario (`usuario_id`), la acción ejecutada, fecha y la propiedad `request.remote_addr` (IP origen del cliente web) guardándolos en la tabla correspondiente. Es visible de manera cronológica con filtros avanzados en `admin.html#auditoria`.

### 5️⃣ Flujo de Dashboard (KPIs y Analítica)
`GET /api/dashboard/kpis` ejecuta de manera paralela consultas de conteo (`COUNT(*)`) sobre la disponibilidad, tasas de utilización de activos, un listado histórico y el TOP 5 de modelos más pedidos para que `dashboard.js` los pinte en el cliente mediante Canvas/SVG.

### 6️⃣ Flujo de Importación Masiva
El administrador sube un archivo CSV o JSON desde la interfaz. El Frontend lo parsea y realiza una petición masiva `POST /api/importacion/bulk` hacia `importacion_controller.py:carga_masiva()`, el cual recorre el lote de objetos bajo una sola transacción masiva y retorna el conteo de elementos insertados con éxito y errores.

---

## 🛠️ Desarrollo Local (Sin Docker)

Si deseas trabajar con *hot-reload* directo en tu entorno físico de desarrollo local:

### 1. Backend (Flask)
```bash
cd backend
python -m venv venv

# Activar en Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Activar en macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
flask run --debug

```

### 2. Frontend (Live Server)

Al ser JavaScript Vanilla, levanta un servidor estático usando cualquiera de estas opciones:

* **VS Code**: Clic derecho en `index.html` -> **Open with Live Server** (Puerto 5500).
* **Python**: En la carpeta `frontend/`, ejecuta `python -m http.server 8000`.

### 3. PostgreSQL Local

Configura tu instancia local de Postgres para escuchar en el puerto `5432` y ejecuta el DDL inicial:

```bash
psql -h localhost -U appuser -d trazabilidad_assets -f database/schema_postgres.sql

```

---

## 🧪 Testing y Validación (Endpoints con cURL)

Prueba las llamadas a los controladores directamente desde la consola del sistema:

```bash
# 1. Login de prueba (Obtener Token)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usuario": "admin", "password": "admin123"}'

# 2. Listar activos
curl http://localhost:5000/api/activos

# 3. Crear nuevo activo de prueba
curl -X POST http://localhost:5000/api/activos \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Laptop Test", "categoria": "Equipos", "numero_serie": "TEST123", "ubicacion_fisica": "Lab 1", "usuario_id": 1}'

# 4. Obtener logs de auditoría y KPIs del Dashboard
curl http://localhost:5000/api/auditoria
curl http://localhost:5000/api/dashboard/kpis

```

---

## 🚨 Resolución de Problemas (Troubleshooting)

### Error: "Connection refused to database"

* **Causa**: El Backend inició más rápido que el contenedor de PostgreSQL y no encontró el puerto listo.
* **Solución**: Ejecuta `docker-compose restart backend_service`. Si estás en local, rectifica los accesos del `.env`.

### Error: "Port 80 already in use"

* **Causa**: Tienes servicios web nativos (IIS, Skype, Apache local) ocupando el puerto 80 de tu sistema operativo.
* **Solución**: Modifica los puertos expuestos del contenedor `gateway` en tu `docker-compose.yml`, cambiando de `"80:80"` a `"8080:80"`.

### Error: "CORS Error in Browser"

* **Causa**: El navegador bloquea peticiones debido al cruce de dominios/puertos diferentes entre Frontend y Backend.
* **Solución**: Verifica que en `backend/app.py` la variable `origenes_permitidos` tenga declarados los puertos locales (ejemplo: `http://localhost:5500` para Live Server) o usa `["*"]` exclusivamente en desarrollo.

---

## 📋 Tabla de Errores Comunes de la API

| Código Error | Causa Probable | Solución sugerida |
| --- | --- | --- |
| `401 Unauthorized` | Token JWT ausente, modificado o expirado | Volver a autenticarse mediante Login |
| `403 Forbidden` | Rol del usuario insuficiente para la acción | Solo usuarios con rol 'admin' tienen permisos |
| `409 Conflict` | Número de serie del activo ya registrado | Cambiar por un número de serie único |
| `404 Not Found` | El ID del recurso consultado no existe en BD | Verificar parámetros o existencia real en tablas |

```