```markdown
# 📦 Sistema de Gestión y Trazabilidad de Activos

## 🎯 Descripción General

Sistema Integral de Gestión de Inventario de Activos con trazabilidad completa, auditoría de movimientos y control de préstamos[cite: 1]. Diseñado para mantener un control riguroso sobre el inventario de equipos, dispositivos y activos en laboratorios o centros de recursos[cite: 1].

### Características Principales
- **Control de Inventario**: Gestión CRUD de activos con estados dinámicos[cite: 1].
- **Sistema de Préstamos**: Registro y control de préstamos de activos con devoluciones[cite: 1].
- **Auditoría en Tiempo Real**: Seguimiento de movimientos con registro de usuario, IP y ubicación[cite: 1].
- **Dashboard Analítico**: KPIs y métricas de disponibilidad y utilización de activos[cite: 1].
- **Multi-rol e Importación Masiva**: Roles diferenciados (Admin/Operadores) y carga batch mediante CSV/JSON[cite: 1].
- **Catálogo Público**: Visualización del inventario disponible sin requerir autenticación[cite: 1].

---

## 🏗️ Stack Tecnológico

- **Backend:** Python con **Flask 3.0.2** (API REST), **Gunicorn** (Servidor WSGI) y **psycopg2-binary**[cite: 1].
- **Base de Datos:** **PostgreSQL 15** con triggers automáticos de auditoría[cite: 1].
- **Frontend:** HTML5, CSS3 (diseño responsive) y **JavaScript Vanilla** (Estructura SPA sin frameworks externos)[cite: 1].
- **Infraestructura:** **Docker Compose** para la orquestación multi-servicio y **Nginx** como Reverse Proxy/Gateway[cite: 1].

---

## 📁 Estructura del Proyecto

```text
proyecto/
│
├── backend/                          # 🔧 Aplicación Flask (API REST)
│   ├── app.py                        # Punto de entrada, configuración Flask
│   ├── config.py                     # Conexión a PostgreSQL y inicialización BD
│   ├── requirements.txt              # Dependencias Python
│   ├── Dockerfile                    # Imagen Docker para backend
│   │
│   ├── controladores/                # Blueprints: Lógica de rutas y negocio
│   │   ├── __init__.py
│   │   ├── auth_controller.py        # Login, registro, validación de usuarios
│   │   ├── activos_controller.py     # CRUD de activos, bulk upload
│   │   ├── prestamos_controller.py   # Crear/gestionar préstamos y devoluciones
│   │   ├── dashboard_controller.py   # KPIs, estadísticas, gráficas
│   │   ├── auditoria_controller.py   # Logs de movimientos, filtros
│   │   └── importacion_controller.py # Carga masiva de archivos
│   │
│   └── modelos/                      # Clases de dominio (entidades)
│       ├── __init__.py
│       ├── usuario.py                # Modelo Usuario con hasheo de contraseña
│       ├── activo.py                 # Modelo Activo individual
│       ├── prestamo.py               # Modelo Préstamo con estados
│       ├── auditoria.py              # Modelo Auditoría movimientos
│       └── mantenimiento.py          # Modelo Mantenimiento preventivo
│
├── frontend/                         # 💻 Interfaz web (HTML/CSS/JS)
│   ├── Dockerfile                    # Imagen Nginx servir estáticos
│   ├── estructura.txt                # Mapa de estructura del frontend
│   │
│   ├── vistas/                       # Plantillas HTML (fragmentos SPA)
│   │   ├── index.html                # 🌐 Catálogo público (sin login)
│   │   ├── login.html                # 🚪 Puerta de acceso (modal)
│   │   ├── admin.html                # 🏢 Frame maestro Admin (con sidebar)
│   │   ├── operator.html             # 🏪 Frame maestro Operador
│   │   │
│   │   ├── admin/                    # Vistas módulares inyectadas en admin.html
│   │   │   ├── vista1_dashboard.html     # KPIs: Activos disponibles, más solicitados
│   │   │   ├── vista2_inventario.html    # CRUD maestro: Crear, editar, eliminar activos
│   │   │   ├── vista3_usuarios.html      # Bandeja de operadores para aprobar
│   │   │   ├── vista4_auditoria.html     # Timeline de movimientos (Caja Negra)
│   │   │   └── vista5_importacion.html   # Carga masiva CSV/JSON
│   │   │
│   │   └── oper/                    # Vistas módulares inyectadas en operator.html
│   │       ├── vista1_dashboard.html     # Dashboard operador: Gráficos disponibilidad
│   │       ├── vista2_transito.html      # Tabla de préstamos activos
│   │       ├── vista3_salida.html        # Formulario nuevo préstamo
│   │       └── vista4_incidentes.html    # Reporte de activos dañados/reparación
│   │
│   ├── css/                          # Estilos (Cascada organizada)
│   │   ├── variables.css             # 🎨 Paleta de colores, tipografía global
│   │   ├── componentes.css           # Botones, tarjetas, modales, alertas
│   │   ├── navbar_premium.css        # Sidebar fijo (navegación lateral)
│   │   ├── dashboard.css             # KPIs, contenedores gráficas
│   │   ├── activos.css               # Tabla CRUD, búsqueda, filtros
│   │   ├── prestamos.css             # Formulario préstamos
│   │   ├── usuarios.css              # Gestión de operadores
│   │   ├── auditoria.css             # Timeline cronológico
│   │   ├── catalogo.css              # Vitrinas catálogo público
│   │   ├── login.css                 # Formularios de autenticación
│   │   ├── operador.css              # Específicos del panel operador
│   │   ├── importar.css              # Estilos de carga masiva
│   │   ├── salida.css                # Estilos de salida/préstamo
│   │   └── retorno.css               # Estilos de devolución
│   │
│   └── js/                           # Lógica cliente-side
│       ├── auth.js                   # Intercepta login, sesión, redirección rol
│       ├── admin_main.js             # Router SPA: lee hash, inyecta vistas admin
│       ├── oper_main.js              # Router SPA: lee hash, inyecta vistas operador
│       ├── dashboard.js              # Renderiza gráficas (Chart.js o Canvas)
│       ├── activos.js                # CRUD modal, buscar, editar, eliminar
│       ├── prestamos.js              # Lógica préstamos y devoluciones
│       ├── importar.js               # Upload y procesamiento CSV/JSON
│       ├── oper_dashboard.js         # Dashboard operador específico
│       ├── oper_incidencias.js       # Reporte de incidencias/reparaciones
│       ├── oper_salida.js            # Salida de activos
│       ├── oper_transito.js          # Estado de tránsito de activos
│       ├── auditoria.js              # Carga logs y aplica filtros
│       ├── usuarios.js               # Aprobación de operadores
│       ├── mantenimiento.js          # Gestión mantenimiento
│       └── carrusel3d.js             # Física/matemática carrusel 3D del catálogo
│
├── database/                         # 🗄️ Esquema y datos iniciales
│   └── schema_postgres.sql           # DDL completo + triggers de auditoría
│
├── gateway/                          # 🚪 Punto de entrada (Nginx Reverse Proxy)
│   ├── Dockerfile                    # Imagen Nginx
│   └── nginx.conf                    # Configuración enrutamiento
│
├── docker-compose.yml                # Orquestación de 4 servicios
├── .env                              # Variables confidenciales (git ignored)
├── README.md                         # Este archivo
├── API_DOCUMENTATION.md              # Documentacion de las API para uso externo
├── DATABASE.md                       # Documentacion de la estructura de la base de datos
└── DEVELOPMENT.md                    # Documentacion de la guia de desarrollo e implementacion
 
```

---

## 🔄 Flujo de Datos Principal (Resumen)

1. **Autenticación:** El cliente envía credenciales mediante `POST /api/auth/login`. El backend valida contra la BD, registra el evento en auditoría y responde con un token que se almacena en `sessionStorage`.


2. **Préstamos (Transacción Atómica):** Cuando un operador registra una salida, el sistema ejecuta una transacción SQL (`BEGIN...COMMIT`) que inserta el préstamo, actualiza el estado del activo a `en_prestamo` y genera el log de auditoría automáticamente.


3. **Auditoría Inteligente:** Cualquier cambio de estado, login o alteración del inventario guarda de forma obligatoria e inmutable la IP origen (`request.remote_addr`), usuario y detalles del cambio.



---

## ⚙️ Requisitos Previos

Asegúrate de tener instalado en tu sistema local:

* **Docker Engine** (v20.10+) y **Docker Compose** (v2.x+).


* **Git** (para control de versiones).



---

## 🚀 Instalación y Configuración Rápida

### 1. Clonar el repositorio

```bash
git clone <URL_REPOSITORIO> proyecto
cd proyecto

```

### 2. Configurar variables de entorno

Crea tu archivo `.env` a partir de la plantilla:

```bash
cp .env.example .env

```

(Nota: Para entornos locales, los valores por defecto del archivo `.env.example` son completamente funcionales. Para entornos de producción, asegúrate de cambiar las contraseñas de PostgreSQL y la clave secreta `JWT_SECRET_KEY`).

### 3. Construir e Iniciar los contenedores con Docker

Ejecuta el siguiente comando en la raíz del proyecto para descargar las dependencias, compilar las imágenes e iniciar la arquitectura completa (Base de datos, Backend, Frontend y Gateway):

```bash
docker-compose up --build -d

```

### 4. Verificar el estado de los servicios

Comprueba que los 4 contenedores estén en estado `Up`:

```bash
docker-compose ps

```

---

## 📱 Acceso a la Aplicación

Una vez que los contenedores estén corriendo, abre tu navegador web e ingresa a las siguientes direcciones locales:

* **Catálogo Público / Aplicación:** `http://localhost` (Puerto 80 gestionado por el Gateway).


* **Backend API (Health Check):** `http://localhost:5000/api/health`.



### 🔐 Credenciales de Prueba

```text
┌──────────────────────────────────────────────────────────┐
│ ADMIN (Acceso total, gráficas y gestión)                 │
│ ├─ Usuario: admin                                        │
│ └─ Contraseña: admin123                                  │
├──────────────────────────────────────────────────────────┤
│ OPERADOR (Gestión de ventanilla, préstamos y retornos)   │
│ ├─ Usuario: oper1                                        │
│ └─ Contraseña: oper123                                   │
└──────────────────────────────────────────────────────────┘

```

---

## 🔧 Comandos Útiles de Mantenimiento

```bash
# Ver los logs combinados en tiempo real
docker-compose logs -f

# Detener los servicios sin borrar datos
docker-compose down

# Detener los servicios eliminando la base de datos (Reset Completo)
docker-compose down -v

# Entrar a la terminal interactiva de la Base de Datos PostgreSQL
docker-compose exec database_service psql -U appuser -d trazabilidad_assets

```

---

**Última actualización**: 2026-07-01 | **Versión**: 1.0


```markdown
---
## 📚 Documentación Avanzada
- Para consultar el diseño detallado de la Base de Datos, ingresa a [DATABASE.md](./DATABASE.md).
- Para guías de desarrollo local, flujos internos y solución de problemas, ingresa a [DEVELOPMENT.md](./DEVELOPMENT.md).

```