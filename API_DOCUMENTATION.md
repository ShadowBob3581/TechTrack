## � Documentación de API (Consumo Externo)

La API REST está disponible en `http://localhost:5000/api/` (desarrollo) o en tu dominio producción.

### Autenticación

Todos los endpoints (excepto `/api/auth/login`, `/api/public/*` y `/api/health`) requieren autenticación.

#### Obtener Token (Login)

```http
POST /api/auth/login
Content-Type: application/json

{
  "usuario": "admin",
  "password": "admin123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "nombre": "Admin User",
  "rol": "admin",
  "id": 1,
  "token": "token_admin_1_tescha"
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Usuario o contraseña incorrectos"
}
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "message": "Tu cuenta está registrada pero aún no ha sido aprobada por un administrador."
}
```

#### Usar Token en Requests

Incluye el token en el header `Authorization`:

```bash
curl -H "Authorization: Bearer token_admin_1_tescha" \
     http://localhost:5000/api/activos
```

O en JavaScript:

```javascript
const response = await fetch('http://localhost:5000/api/activos', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

### Endpoints por Recurso

#### 🔐 AUTENTICACIÓN

##### POST `/api/auth/login`
Autentica usuario y retorna token.

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "admin",
    "password": "admin123"
  }'
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| usuario | string | ✅ | Nombre de usuario |
| password | string | ✅ | Contraseña |

**Status Codes:**
- `200 OK` - Login exitoso
- `400 Bad Request` - Campos inválidos
- `401 Unauthorized` - Credenciales incorrectas
- `403 Forbidden` - Usuario no aprobado

---

#### 📦 ACTIVOS

##### GET `/api/activos`
Lista todos los activos con paginación y filtros.

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/activos?categoria=Laptops&estado=disponible&limit=10&offset=0"
```

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| categoria | string | Filtrar por categoría |
| estado | string | Filtrar por estado: `disponible`, `en_prestamo`, `mantenimiento` |
| limit | integer | Resultados por página (default: 20, max: 100) |
| offset | integer | Desplazamiento para paginación (default: 0) |
| buscar | string | Búsqueda por nombre o serie |

**Response (200 OK):**
```json
[
  {
    "id": 1,
    "nombre": "Laptop Dell XPS",
    "numero_serie": "ABC123XYZ",
    "categoria": "Equipos Cómputo",
    "estado": "disponible",
    "ubicacion_fisica": "Laboratorio A",
    "imagen_url": "https://...",
    "fecha_creacion": "2026-06-15T10:30:00Z"
  },
  {
    "id": 2,
    "nombre": "Monitor LG 27\"",
    "numero_serie": "MON456",
    "categoria": "Periféricos",
    "estado": "en_prestamo",
    "ubicacion_fisica": "Laboratorio B",
    "imagen_url": "https://...",
    "fecha_creacion": "2026-06-10T14:22:00Z"
  }
]
```

**Status Codes:**
- `200 OK` - Éxito
- `400 Bad Request` - Parámetros inválidos
- `401 Unauthorized` - Token inválido/expirado

---

##### GET `/api/activos/<id>`
Obtiene detalle de un activo específico.

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/activos/1
```

**Response (200 OK):**
```json
{
  "id": 1,
  "nombre": "Laptop Dell XPS",
  "numero_serie": "ABC123XYZ",
  "categoria": "Equipos Cómputo",
  "estado": "disponible",
  "ubicacion_fisica": "Laboratorio A",
  "imagen_url": "https://...",
  "fecha_creacion": "2026-06-15T10:30:00Z",
  "ultimos_prestamos": [
    {
      "prestamo_id": 42,
      "solicitante": "2024-001234",
      "fecha_salida": "2026-06-20T09:00:00Z",
      "fecha_devolucion_prevista": "2026-06-27",
      "estado": "cerrado"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Éxito
- `404 Not Found` - Activo no existe

---

##### POST `/api/activos`
Crea un nuevo activo (solo Admin).

```bash
curl -X POST http://localhost:5000/api/activos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Proyector Sony",
    "categoria": "Equipos Audiovisual",
    "numero_serie": "PROJ789",
    "ubicacion_fisica": "Aula 201",
    "usuario_id": 1,
    "imagen_url": "https://ejemplo.com/imagen.jpg",
    "estado": "disponible"
  }'
```

**Body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| nombre | string | ✅ | Nombre del activo |
| categoria | string | ✅ | Categoría |
| numero_serie | string | ✅ | Serie único |
| ubicacion_fisica | string | ✅ | Ubicación |
| usuario_id | integer | ✅ | ID del usuario creador |
| imagen_url | string | ❌ | URL de imagen |
| estado | string | ❌ | Estado inicial (default: "disponible") |

**Response (201 Created):**
```json
{
  "success": true,
  "id": 123,
  "mensaje": "Activo creado exitosamente"
}
```

**Status Codes:**
- `201 Created` - Éxito
- `400 Bad Request` - Datos inválidos
- `403 Forbidden` - Solo admin
- `409 Conflict` - Número de serie duplicado

---

##### PUT `/api/activos/<id>`
Actualiza un activo existente (solo Admin).

```bash
curl -X PUT http://localhost:5000/api/activos/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Laptop Dell XPS (Reparada)",
    "estado": "disponible",
    "ubicacion_fisica": "Laboratorio A"
  }'
```

**Body:** (solo incluir campos a actualizar)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| nombre | string | Nuevo nombre |
| estado | string | Nuevo estado |
| ubicacion_fisica | string | Nueva ubicación |
| categoria | string | Nueva categoría |

**Response (200 OK):**
```json
{
  "success": true,
  "mensaje": "Activo actualizado exitosamente"
}
```

**Status Codes:**
- `200 OK` - Éxito
- `400 Bad Request` - Datos inválidos
- `403 Forbidden` - Solo admin
- `404 Not Found` - Activo no existe

---

##### DELETE `/api/activos/<id>`
Elimina un activo (solo Admin - soft delete).

```bash
curl -X DELETE http://localhost:5000/api/activos/1 \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "mensaje": "Activo eliminado exitosamente"
}
```

**Status Codes:**
- `200 OK` - Éxito
- `403 Forbidden` - Solo admin
- `404 Not Found` - Activo no existe

---

##### GET `/api/activos/categorias`
Lista todas las categorías disponibles.

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/activos/categorias
```

**Response (200 OK):**
```json
[
  "Equipos Cómputo",
  "Periféricos",
  "Equipos Audiovisual",
  "Laboratorio",
  "Mobiliario"
]
```

---

##### POST `/api/activos/bulk`
Importación masiva de activos (Batch upload).

```bash
curl -X POST http://localhost:5000/api/activos/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "nombre": "Laptop 1",
      "categoria": "Equipos",
      "numero_serie": "BULK001",
      "ubicacion_fisica": "Lab 1",
      "usuario_id": 1,
      "estado": "disponible"
    },
    {
      "nombre": "Laptop 2",
      "categoria": "Equipos",
      "numero_serie": "BULK002",
      "ubicacion_fisica": "Lab 1",
      "usuario_id": 1,
      "estado": "disponible"
    }
  ]'
```

**Body:** Array de objetos activo (mismo schema que POST individual)

**Response (201 Created):**
```json
{
  "success": true,
  "procesados": 2,
  "errores": 0,
  "mensaje": "2 activos importados exitosamente"
}
```

**Status Codes:**
- `201 Created` - Éxito (parcial o total)
- `400 Bad Request` - Array inválido
- `403 Forbidden` - Solo admin

---

#### 📋 PRÉSTAMOS

##### GET `/api/prestamos`
Lista todos los préstamos con filtros.

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/prestamos?usuario_id=5&estado=activo&limit=20"
```

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| usuario_id | integer | Filtrar por operador |
| estado | string | `activo` o `cerrado` |
| activo_id | integer | Filtrar por activo |
| limit | integer | Resultados (default: 20) |
| offset | integer | Paginación (default: 0) |

**Response (200 OK):**
```json
[
  {
    "id": 42,
    "activo_individual_id": 1,
    "activo_nombre": "Laptop Dell XPS",
    "usuario_operador_id": 5,
    "usuario_operador_nombre": "Juan Pérez",
    "solicitante_matricula": "2024-001234",
    "fecha_salida": "2026-06-20T09:00:00Z",
    "fecha_devolucion_prevista": "2026-06-27",
    "fecha_devolucion_real": null,
    "estado": "activo"
  }
]
```

---

##### GET `/api/prestamos/<id>`
Obtiene detalle de un préstamo.

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/prestamos/42
```

**Response (200 OK):**
```json
{
  "id": 42,
  "activo_individual_id": 1,
  "activo_nombre": "Laptop Dell XPS",
  "activo_numero_serie": "ABC123XYZ",
  "usuario_operador_id": 5,
  "usuario_operador_nombre": "Juan Pérez",
  "solicitante_matricula": "2024-001234",
  "fecha_salida": "2026-06-20T09:00:00Z",
  "fecha_devolucion_prevista": "2026-06-27",
  "fecha_devolucion_real": null,
  "estado": "activo",
  "dias_retraso": 0
}
```

---

##### POST `/api/prestamos`
Crea nuevo préstamo (Operador).

```bash
curl -X POST http://localhost:5000/api/prestamos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "activo_individual_id": 1,
    "usuario_operador_id": 5,
    "solicitante_matricula": "2024-001234",
    "fecha_devolucion_prevista": "2026-07-05"
  }'
```

**Body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| activo_individual_id | integer | ✅ | ID del activo |
| usuario_operador_id | integer | ✅ | ID del operador |
| solicitante_matricula | string | ✅ | Matrícula estudiante |
| fecha_devolucion_prevista | date | ✅ | Formato: YYYY-MM-DD |

**Response (201 Created):**
```json
{
  "success": true,
  "prestamo_id": 128,
  "mensaje": "Préstamo registrado exitosamente"
}
```

**Status Codes:**
- `201 Created` - Éxito
- `400 Bad Request` - Datos inválidos
- `409 Conflict` - Activo no disponible

---

##### PUT `/api/prestamos/<id>/devolver`
Registra devolución de activo.

```bash
curl -X PUT http://localhost:5000/api/prestamos/42/devolver \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "estado_devuelto": "bueno",
    "observaciones": "Sin daños"
  }'
```

**Body:**
| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| estado_devuelto | string | ✅ | `bueno` o `dañado` |
| observaciones | string | ❌ | Notas de devolución |

**Response (200 OK):**
```json
{
  "success": true,
  "mensaje": "Devolución registrada exitosamente",
  "activo_nuevo_estado": "disponible"
}
```

Si estado_devuelto es `dañado`, el activo cambia a `mantenimiento`.

**Status Codes:**
- `200 OK` - Éxito
- `400 Bad Request` - Datos inválidos
- `404 Not Found` - Préstamo no existe
- `409 Conflict` - Préstamo ya está cerrado

---

#### 📊 DASHBOARD

##### GET `/api/dashboard/kpis`
Obtiene KPIs y métricas del sistema.

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/dashboard/kpis
```

**Response (200 OK):**
```json
{
  "total_activos": 250,
  "disponibles": 180,
  "en_prestamo": 65,
  "en_mantenimiento": 5,
  "tasa_utilizacion": "26%",
  "activos_top5": [
    {
      "id": 1,
      "nombre": "Laptop Dell XPS",
      "total_prestamos": 45
    },
    {
      "id": 2,
      "nombre": "Monitor LG",
      "total_prestamos": 32
    }
  ],
  "ultimos_movimientos": [
    {
      "id": 512,
      "accion": "PRESTAMO_SALIDA",
      "usuario": "Juan Pérez",
      "activo": "Laptop",
      "fecha": "2026-07-01T10:30:00Z"
    }
  ]
}
```

---

#### 📝 AUDITORÍA

##### GET `/api/auditoria`
Lista todos los movimientos auditados.

```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:5000/api/auditoria?usuario_id=1&accion=PRESTAMO_SALIDA&fecha_desde=2026-06-01&fecha_hasta=2026-07-01&limit=50"
```

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| usuario_id | integer | Filtrar por usuario |
| accion | string | Filtrar por tipo de acción |
| activo_id | integer | Filtrar por activo |
| fecha_desde | date | Fecha inicio (YYYY-MM-DD) |
| fecha_hasta | date | Fecha fin (YYYY-MM-DD) |
| limit | integer | Resultados (default: 50) |
| offset | integer | Paginación (default: 0) |

**Response (200 OK):**
```json
[
  {
    "id": 512,
    "activo_individual_id": 1,
    "activo_nombre": "Laptop Dell XPS",
    "usuario_id": 5,
    "usuario_nombre": "Juan Pérez",
    "accion": "PRESTAMO_SALIDA",
    "detalles": "Préstamo otorgado a matrícula: 2024-001234",
    "ubicacion": "Ventanilla de Activos",
    "ip_origen": "192.168.1.105",
    "fecha_registro": "2026-06-20T09:00:00Z"
  },
  {
    "id": 513,
    "activo_individual_id": 1,
    "activo_nombre": "Laptop Dell XPS",
    "usuario_id": 5,
    "usuario_nombre": "Juan Pérez",
    "accion": "PRESTAMO_DEVOLUCION",
    "detalles": "Devolución de Laptop. Estado: bueno",
    "ubicacion": "Ventanilla de Activos",
    "ip_origen": "192.168.1.105",
    "fecha_registro": "2026-06-27T14:30:00Z"
  }
]
```

---

##### GET `/api/auditoria/<id>`
Obtiene detalle de un movimiento.

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/api/auditoria/512
```

**Response (200 OK):**
```json
{
  "id": 512,
  "activo_individual_id": 1,
  "activo_nombre": "Laptop Dell XPS",
  "activo_numero_serie": "ABC123XYZ",
  "usuario_id": 5,
  "usuario_nombre": "Juan Pérez",
  "usuario_rol": "operador",
  "accion": "PRESTAMO_SALIDA",
  "detalles": "Préstamo otorgado a matrícula: 2024-001234",
  "ubicacion": "Ventanilla de Activos",
  "ip_origen": "192.168.1.105",
  "fecha_registro": "2026-06-20T09:00:00Z"
}
```

---

#### 🌐 PÚBLICOS (Sin Autenticación)

##### GET `/api/health`
Health check del sistema.

```bash
curl http://localhost:5000/api/health
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "mensaje": "Backend corriendo correctamente"
}
```

---

##### GET `/api/public/carrusel`
Obtiene activos públicos agrupados por modelo (Catálogo).

```bash
curl http://localhost:5000/api/public/carrusel
```

**Response (200 OK):**
```json
[
  {
    "modelo_id": 1,
    "activo_nombre": "Laptop Dell XPS",
    "categoria": "Equipos Cómputo",
    "ubicacion_fisica": "Laboratorio A",
    "imagen_url": "https://...",
    "total_existencias": 10,
    "disponibles": 8
  },
  {
    "modelo_id": 2,
    "activo_nombre": "Monitor LG 27\"",
    "categoria": "Periféricos",
    "ubicacion_fisica": "Laboratorio B",
    "imagen_url": "https://...",
    "total_existencias": 15,
    "disponibles": 12
  }
]
```

---

### Códigos de Estado HTTP

| Código | Significado | Descripción |
|--------|-------------|-------------|
| 200 | OK | Solicitud exitosa |
| 201 | Created | Recurso creado exitosamente |
| 400 | Bad Request | Datos inválidos o malformados |
| 401 | Unauthorized | Falta autenticación o token inválido |
| 403 | Forbidden | Autenticado pero sin permisos |
| 404 | Not Found | Recurso no existe |
| 409 | Conflict | Conflicto (ej: serie duplicada) |
| 500 | Internal Server Error | Error en servidor |

---

### Modelos de Datos

#### Activo
```json
{
  "id": 1,
  "nombre": "Laptop Dell XPS",
  "numero_serie": "ABC123XYZ",
  "categoria": "Equipos Cómputo",
  "estado": "disponible",
  "ubicacion_fisica": "Laboratorio A",
  "imagen_url": "https://...",
  "fecha_creacion": "2026-06-15T10:30:00Z"
}
```

**Estados Válidos:**
- `disponible` - Listo para préstamo
- `en_prestamo` - En manos del usuario
- `mantenimiento` - En reparación
- `descartado` - Fuera de servicio

---

#### Préstamo
```json
{
  "id": 42,
  "activo_individual_id": 1,
  "usuario_operador_id": 5,
  "solicitante_matricula": "2024-001234",
  "fecha_salida": "2026-06-20T09:00:00Z",
  "fecha_devolucion_prevista": "2026-06-27",
  "fecha_devolucion_real": null,
  "estado": "activo"
}
```

**Estados Válidos:**
- `activo` - Préstamo en curso
- `cerrado` - Préstamo devuelto

---

#### Usuario
```json
{
  "id": 1,
  "usuario": "admin",
  "nombre": "Admin User",
  "email": "admin@institucion.edu",
  "rol": "admin",
  "aprobado": true,
  "fecha_creacion": "2026-01-01T00:00:00Z"
}
```

**Roles Válidos:**
- `admin` - Acceso completo a gestión
- `operador` - Acceso a ventanilla y préstamos

---

#### Movimiento de Auditoría
```json
{
  "id": 512,
  "activo_individual_id": 1,
  "usuario_id": 5,
  "accion": "PRESTAMO_SALIDA",
  "detalles": "Préstamo otorgado a matrícula: 2024-001234",
  "ubicacion": "Ventanilla de Activos",
  "ip_origen": "192.168.1.105",
  "fecha_registro": "2026-06-20T09:00:00Z"
}
```

---

### Ejemplos de Integración

#### JavaScript/Fetch
```javascript
// 1. LOGIN
async function login(usuario, password) {
  const response = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, password })
  });
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user_id', data.id);
    return data;
  }
  throw new Error(data.message);
}

// 2. LISTAR ACTIVOS
async function obtenerActivos(filtros = {}) {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams(filtros);
  
  const response = await fetch(`http://localhost:5000/api/activos?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

// 3. CREAR PRESTAMO
async function crearPrestamo(activoId, matricula, fechaDevolucion) {
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('user_id');
  
  const response = await fetch('http://localhost:5000/api/prestamos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      activo_individual_id: activoId,
      usuario_operador_id: userId,
      solicitante_matricula: matricula,
      fecha_devolucion_prevista: fechaDevolucion
    })
  });
  
  const data = await response.json();
  if (!data.success) throw new Error(data.mensaje);
  return data;
}

// 4. REGISTRAR DEVOLUCIÓN
async function registrarDevolucion(prestamoId, estado, observaciones) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`http://localhost:5000/api/prestamos/${prestamoId}/devolver`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      estado_devuelto: estado,
      observaciones: observaciones
    })
  });
  
  const data = await response.json();
  if (!data.success) throw new Error(data.mensaje);
  return data;
}

// USAR:
try {
  await login('admin', 'admin123');
  const activos = await obtenerActivos({ categoria: 'Equipos' });
  console.log('Activos:', activos);
} catch (error) {
  console.error('Error:', error);
}
```

---

#### Python
```python
import requests
import json
from datetime import datetime, timedelta

BASE_URL = 'http://localhost:5000/api'

class ClienteAPI:
    def __init__(self, base_url):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()
    
    def login(self, usuario, password):
        """Autentica y obtiene token"""
        response = self.session.post(
            f'{self.base_url}/auth/login',
            json={'usuario': usuario, 'password': password}
        )
        data = response.json()
        if data.get('success'):
            self.token = data['token']
            self.session.headers.update({'Authorization': f'Bearer {self.token}'})
            return data
        raise Exception(data.get('message', 'Login failed'))
    
    def listar_activos(self, categoria=None, estado=None):
        """Lista activos con filtros"""
        params = {}
        if categoria:
            params['categoria'] = categoria
        if estado:
            params['estado'] = estado
        
        response = self.session.get(f'{self.base_url}/activos', params=params)
        return response.json()
    
    def crear_prestamo(self, activo_id, usuario_operador_id, matricula, dias=7):
        """Crea nuevo préstamo"""
        fecha_devolucion = (datetime.now() + timedelta(days=dias)).strftime('%Y-%m-%d')
        
        response = self.session.post(
            f'{self.base_url}/prestamos',
            json={
                'activo_individual_id': activo_id,
                'usuario_operador_id': usuario_operador_id,
                'solicitante_matricula': matricula,
                'fecha_devolucion_prevista': fecha_devolucion
            }
        )
        return response.json()
    
    def devolver_activo(self, prestamo_id, estado='bueno', observaciones=''):
        """Registra devolución"""
        response = self.session.put(
            f'{self.base_url}/prestamos/{prestamo_id}/devolver',
            json={
                'estado_devuelto': estado,
                'observaciones': observaciones
            }
        )
        return response.json()
    
    def obtener_kpis(self):
        """Obtiene dashboard KPIs"""
        response = self.session.get(f'{self.base_url}/dashboard/kpis')
        return response.json()

# USAR:
cliente = ClienteAPI(BASE_URL)
cliente.login('admin', 'admin123')

# Listar activos
activos = cliente.listar_activos(categoria='Equipos', estado='disponible')
print(f'Activos disponibles: {len(activos)}')

# Crear préstamo
prestamo = cliente.crear_prestamo(
    activo_id=1,
    usuario_operador_id=5,
    matricula='2024-001234',
    dias=7
)
print(f'Préstamo creado: {prestamo["prestamo_id"]}')

# Devolver activo
devolucion = cliente.devolver_activo(
    prestamo_id=prestamo['prestamo_id'],
    estado='bueno'
)
print('Devolución registrada')

# Obtener KPIs
kpis = cliente.obtener_kpis()
print(f'Tasa utilización: {kpis["tasa_utilizacion"]}')
```

---

#### cURL (Bash)
```bash
#!/bin/bash

API="http://localhost:5000/api"
TOKEN=""
USER_ID=""

# 1. LOGIN
LOGIN_RESPONSE=$(curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"usuario":"admin","password":"admin123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
USER_ID=$(echo $LOGIN_RESPONSE | jq -r '.id')

echo "Token: $TOKEN"
echo "User ID: $USER_ID"

# 2. LISTAR ACTIVOS
curl -s -X GET "$API/activos?categoria=Equipos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'

# 3. CREAR PRESTAMO
PRESTAMO=$(curl -s -X POST "$API/prestamos" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "activo_individual_id": 1,
    "usuario_operador_id": 5,
    "solicitante_matricula": "2024-001234",
    "fecha_devolucion_prevista": "2026-07-05"
  }')

PRESTAMO_ID=$(echo $PRESTAMO | jq -r '.prestamo_id')
echo "Préstamo creado: $PRESTAMO_ID"

# 4. DEVOLVER ACTIVO
curl -s -X PUT "$API/prestamos/$PRESTAMO_ID/devolver" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "estado_devuelto": "bueno",
    "observaciones": "Sin daños"
  }' | jq '.'

# 5. OBTENER AUDITORÍA
curl -s -X GET "$API/auditoria?limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq '.'
  
```