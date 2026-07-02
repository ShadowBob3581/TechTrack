# 🗄️ Documentación del Modelo de Datos (DATABASE.md)

Este archivo contiene la especificación completa, el diseño del esquema y los comandos de mantenimiento para la base de datos de la aplicación.

---

## 📊 Estructura de Base de Datos

El sistema utiliza **PostgreSQL 15** como motor relacional, con un esquema diseñado para garantizar la integridad referencial y auditoría inmutable.

```sql
-- Principales tablas y entidades del sistema:

📋 usuarios
├─ id (SERIAL PRIMARY KEY)
├─ usuario (VARCHAR UNIQUE) -- Nombre de usuario para login
├─ password (VARCHAR hashed) -- Contraseña encriptada
├─ nombre (VARCHAR) -- Nombre completo del usuario
├─ email (VARCHAR)
├─ rol (VARCHAR: 'admin' | 'operador')
├─ aprobado (BOOLEAN) -- Estado de aprobación por el administrador
└─ fecha_creacion (TIMESTAMP)

📦 modelos_activos
├─ id (SERIAL PRIMARY KEY)
├─ nombre (VARCHAR) -- Nombre comercial/descriptivo del modelo
├─ categoria (VARCHAR) -- Categoría (Ej: Equipos Cómputo, Periféricos)
├─ descripcion (TEXT)
├─ ubicacion_fisica (VARCHAR) -- Laboratorio o almacén asignado por defecto
├─ imagen_url (VARCHAR)
└─ fecha_creacion (TIMESTAMP)

🔢 activos_individuales
├─ id (SERIAL PRIMARY KEY)
├─ modelo_id (FK → modelos_activos) -- Relación al catálogo maestro
├─ numero_serie (VARCHAR UNIQUE) -- Código de barras o número de serie único
├─ estado (VARCHAR: 'disponible' | 'en_prestamo' | 'mantenimiento' | 'descartado')
└─ fecha_creacion (TIMESTAMP)

📨 prestamos
├─ id (SERIAL PRIMARY KEY)
├─ activo_individual_id (FK → activos_individuales)
├─ usuario_operador_id (FK → usuarios) -- Operador que registró la salida
├─ solicitante_matricula (VARCHAR) -- Matrícula del estudiante/profesor
├─ fecha_salida (TIMESTAMP)
├─ fecha_devolucion_prevista (DATE)
├─ fecha_devolucion_real (DATE NULL)
└─ estado (VARCHAR: 'activo' | 'cerrado')

📝 auditoria_movimientos
├─ id (SERIAL PRIMARY KEY)
├─ activo_individual_id (FK → activos_individuales NULL)
├─ usuario_id (FK → usuarios) -- Usuario que realizó la acción
├─ accion (VARCHAR) -- Tipo de evento (LOGIN, ALTA_ACTIVO, PRESTAMO_SALIDA)
├─ detalles (TEXT) -- Descripción legible en formato JSON o texto descriptivo
├─ ubicacion (VARCHAR) -- Ventanilla, módulo o IP física
├─ ip_origen (VARCHAR) -- Dirección IP del cliente web
└─ fecha_registro (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

```

---

## 🔄 Triggers PostgreSQL Automáticos (Lógica Interna)

Para asegurar que ningún operador pueda manipular el inventario saltándose las reglas del negocio, la base de datos ejecuta las siguientes funciones automáticas heredadas de `database/schema_postgres.sql`:

* **Trigger BEFORE INSERT prestamo**: Valida que el activo esté estrictamente "disponible" antes de procesar el registro.
* **Trigger AFTER INSERT prestamo**: Cambia el estado del activo a "en_prestamo" automáticamente de forma atómica.
* **Trigger AFTER UPDATE activo**: Detecta cambios de estado manuales y los registra inmediatamente en la auditoría.
* **Trigger AFTER DELETE**: Protege el registro y genera un borrado lógico (soft delete) con logs de auditoría.

---

## 🔧 Comandos Útiles de Base de Datos (Mantenimiento)

### 1. Conectar a PostgreSQL desde el contenedor Docker

```bash
docker-compose exec database_service psql -U appuser -d trazabilidad_assets

```

### 2. Comandos esenciales dentro de `psql`

```sql
\dt                    -- Listar todas las tablas creadas
\d usuarios            -- Ver la estructura y tipos de datos de la tabla usuarios
SELECT COUNT(*) FROM usuarios; -- Contar registros de usuarios
SELECT * FROM auditoria_movimientos ORDER BY fecha_registro DESC LIMIT 5; -- Ver últimos logs
\q                     -- Salir de la CLI de PostgreSQL

```

### 3. Operaciones de Scripts y Respaldos (Backups)

```bash
# Ejecutar un script SQL de forma externa
docker-compose exec database_service psql -U appuser -d trazabilidad_assets -f /ruta/schema.sql

# Crear un respaldo completo (Backup)
docker-compose exec database_service pg_dump -U appuser trazabilidad_assets > backup.sql

# Restaurar un respaldo previo hacia el contenedor
docker-compose exec -T database_service psql -U appuser trazabilidad_assets < backup.sql

```