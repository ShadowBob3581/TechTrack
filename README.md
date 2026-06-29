# TechTrack - Sistema de Gestión y Trazabilidad de Activos Tecnológicos

**TechTrack** es una plataforma web SPA (Single Page Application) diseñada para el control físico, seguimiento de tránsito en ventanilla y mantenimiento correctivo de activos tecnológicos dentro de laboratorios institucionales. 

El sistema implementa una arquitectura robusta multicontenedor, aislando la base de datos, la API lógica y el servidor de red para eliminar conflictos de origen (CORS) y garantizar alta disponibilidad en entornos de producción.

---

## 🏗️ Arquitectura del Sistema (Multicontenedor)

La infraestructura está completamente contenerizada utilizando **Docker** y coordinada mediante **Docker Compose**, dividiendo el ecosistema en 4 servicios independientes:

1. **`db` (PostgreSQL):** Motor de base de datos relacional encargado de la persistencia física del inventario, bitácoras de auditoría y flujos de préstamos.
2. **`backend` (Flask API):** Núcleo de lógica asíncrona estructurado bajo el patrón Controlador-Modelo. Gestiona la autenticación JWT y las transacciones con la base de datos.
3. **`frontend` (Static Volume):** Contenedor ligero que empaqueta y expone la interfaz de usuario (HTML, CSS, JS) para ser consumida de forma optimizada.
4. **`gateway` (Nginx Reverse Proxy):** El punto único de acceso al ecosistema (Puerto 80). Centraliza el tráfico y redirige de forma transparente las peticiones hacia la API (`/api/`), anulando por completo las restricciones de políticas CORS en el navegador.

---

## 🗂️ Estructura del Proyecto

```text
techtrack/
├── backend/                  # 🐍 API Lógica en Flask
│    ├── controladores/       # Controladores de activos, préstamos, usuarios y auditoría
│    ├── modelos/             # Modelos ORM / Mapeo de tablas PostgreSQL
│    ├── app.py               # Punto de entrada de la API Flask
│    ├── Dockerfile           # Imagen de entorno Python 3.10-slim
│    └── requirements.txt     # Dependencias del backend (Flask, Psycopg2, etc.)
│
├── frontend/                 # 🌐 Interfaz Gráfica SPA
│    ├── css/                 # Hojas de estilo estructuradas (dashboard, componentes)
│    ├── js/                  # Lógica asíncrona de interacción y enrutamiento por hashes
│    ├── vistas/              # Fragmentos HTML puros inyectados dinámicamente
│    └── Dockerfile           # Empaquetado y distribución de la interfaz
│
├── gateway/                  # 🛡️ Proxy Inverso y Seguridad de Red
│    ├── nginx.conf           # Configuración de ruteo unificado y cabeceras de red
│    └── Dockerfile           # Servidor Nginx Alpine de producción
│
├── database/                 # 🗄️ Persistencia de Datos
│    └── schema_postgres.sql  # Esquema DDL e inyección inicial de datos
│
└── docker_compose.yml        # 🎼 Orquestador Maestro del Entorno Multicontenedor