-- =========================================================================
-- 1. TIPOS ENUM Y CONFIGURACIÓN INICIAL
-- =========================================================================
DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('administrador', 'operador');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_activo AS ENUM ('disponible', 'prestado', 'mantenimiento', 'baja');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================
-- 2. TABLA: USUARIOS (Con pasarela de aprobación integrada)
-- =========================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id         SERIAL PRIMARY KEY,
    usuario    VARCHAR(50)  NOT NULL UNIQUE,
    nombre     VARCHAR(100) NOT NULL,
    password   VARCHAR(255) NOT NULL,
    rol        rol_usuario  NOT NULL,
    aprobado   BOOLEAN      DEFAULT FALSE, -- FALSE requiere autorización del Admin, TRUE puede logearse
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 3. TABLA: MODELOS_ACTIVOS (Catálogo general con soporte visual para el carrusel)
-- =========================================================================
CREATE TABLE IF NOT EXISTS modelos_activos (
    id               SERIAL PRIMARY KEY,
    nombre           VARCHAR(100) NOT NULL UNIQUE, -- Ej: "Impresora 3D Creality Ender 3"
    categoria        VARCHAR(50)  NOT NULL,        -- Ej: "Impresión 3D"
    ubicacion_fisica VARCHAR(100) NOT NULL,        -- Ej: "Laboratorio B"
    imagen_url       TEXT         DEFAULT 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=400',
    created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 4. TABLA: ACTIVOS_INDIVIDUALES (Existencias reales con S/N)
-- =========================================================================
CREATE TABLE IF NOT EXISTS activos_individuales (
    id           SERIAL PRIMARY KEY,
    modelo_id    INT          NOT NULL,
    numero_serie VARCHAR(100) NOT NULL UNIQUE,
    estado       estado_activo DEFAULT 'disponible',
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (modelo_id) REFERENCES modelos_activos(id) ON DELETE RESTRICT
);

-- Trigger para mantener actualizado updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_activos_updated_at ON activos_individuales;
CREATE TRIGGER trigger_activos_updated_at
BEFORE UPDATE ON activos_individuales
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================================================================
-- 5. TABLA: PRESTAMOS
-- =========================================================================
CREATE TABLE IF NOT EXISTS prestamos (
    id                        SERIAL PRIMARY KEY,
    activo_individual_id      INT          NOT NULL,
    usuario_operador_id       INT          NOT NULL,
    solicitante_matricula     VARCHAR(50)  NOT NULL,
    fecha_prestamo            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    fecha_devolucion_prevista TIMESTAMP    NOT NULL,
    fecha_devolucion_real     TIMESTAMP    NULL,
    estado_retorno            TEXT         NULL,
    FOREIGN KEY (activo_individual_id) REFERENCES activos_individuales(id) ON DELETE RESTRICT,
    FOREIGN KEY (usuario_operador_id)   REFERENCES usuarios(id)  ON DELETE RESTRICT
);

-- =========================================================================
-- 6. TABLA: MANTENIMIENTOS
-- =========================================================================
CREATE TABLE IF NOT EXISTS mantenimientos (
    id                    SERIAL PRIMARY KEY,
    activo_individual_id  INT           NOT NULL,
    descripcion_falla     TEXT          NOT NULL,
    tecnico_responsable   VARCHAR(100)  NOT NULL,
    fecha_inicio          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    fecha_fin             TIMESTAMP     NULL,
    costo                 DECIMAL(10,2) NULL DEFAULT 0.00,
    FOREIGN KEY (activo_individual_id) REFERENCES activos_individuales(id) ON DELETE RESTRICT
);

-- =========================================================================
-- 7. TABLA: AUDITORIA_MOVIMIENTOS (Caja Negra con Soporte de Red y Ubicación)
-- =========================================================================
CREATE TABLE IF NOT EXISTS auditoria_movimientos (
    id                   SERIAL PRIMARY KEY,
    activo_individual_id INT           NULL,
    usuario_id           INT           NULL, -- Quién lo hizo (Nulo si es automático del sistema)
    accion               VARCHAR(50)   NOT NULL, -- Ej: 'REGISTRO_ACTIVO', 'BAJA_HARDWARE'
    detalles             TEXT          NOT NULL, -- Descripción breve del acontecimiento
    ubicacion            VARCHAR(100)  DEFAULT 'No especificada', -- El lugar
    ip_origen            VARCHAR(45)   DEFAULT '127.0.0.1',       -- La IP de origen
    fecha_registro       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP  -- Hora y fecha automáticas
);

-- =========================================================================
-- 8. TRIGGER DE AUDITORÍA AUTOMÁTICA ADAPTADO
-- =========================================================================
CREATE OR REPLACE FUNCTION log_cambios_activos_individuales()
RETURNS TRIGGER AS $$
DECLARE
    v_ubicacion VARCHAR(100);
BEGIN
    -- Intentamos recuperar el laboratorio o lugar mapeado en el catálogo para el activo
    SELECT m.ubicacion_fisica INTO v_ubicacion
    FROM modelos_activos m
    WHERE m.id = COALESCE(NEW.modelo_id, OLD.modelo_id)
    LIMIT 1;

    IF v_ubicacion IS NULL THEN
        v_ubicacion := 'Laboratorio / Almacén Central';
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO auditoria_movimientos (activo_individual_id, accion, detalles, ubicacion, ip_origen)
        VALUES (NEW.id, 'DB_ALTA_SERIAL', 'Se ingresó un nuevo número de serie: ' || NEW.numero_serie, v_ubicacion, '127.0.0.1');
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.estado <> NEW.estado) THEN
            INSERT INTO auditoria_movimientos (activo_individual_id, accion, detalles, ubicacion, ip_origen)
            VALUES (NEW.id, 'DB_CAMBIO_ESTADO', 'El activo S/N: ' || NEW.numero_serie || ' cambió su estado de "' || OLD.estado || '" a "' || NEW.estado || '"', v_ubicacion, '127.0.0.1');
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO auditoria_movimientos (activo_individual_id, accion, detalles, ubicacion, ip_origen)
        VALUES (NULL, 'DB_BAJA_FISICA', 'Se eliminó permanentemente del inventario el S/N: ' || OLD.numero_serie, v_ubicacion, '127.0.0.1');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditoria_individuales ON activos_individuales;
CREATE TRIGGER trg_auditoria_individuales
AFTER INSERT OR UPDATE OR DELETE ON activos_individuales
FOR EACH ROW EXECUTE FUNCTION log_cambios_activos_individuales();

-- =========================================================================
-- 9. DATOS INICIALES SEMILLA (Por defecto, el Admin entra aprobado)
-- =========================================================================
INSERT INTO usuarios (usuario, nombre, password, rol, aprobado) VALUES
('admin', 'Gerardo Silva (Administrador)', 'admin123', 'administrador', TRUE),
('20260001',     'Juan Pérez (Alumno Operador)',  'user123',  'operador',      TRUE)
ON CONFLICT (usuario) DO NOTHING;