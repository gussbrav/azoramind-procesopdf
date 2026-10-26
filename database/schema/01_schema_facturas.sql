-- =============================================================================
-- Schema: Sistema de Procesamiento de Facturas — Transaltisa
-- Desarrollado por: Azoramind | Gustavo Bravo | www.azoramind.com
-- =============================================================================

-- Extensión para UUID (opcional, si se prefiere UUID sobre SERIAL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLA PRINCIPAL: facturas
-- Almacena cada factura PDF recibida y su resultado de extracción IA
-- =============================================================================
CREATE TABLE IF NOT EXISTS facturas (
    id                      SERIAL PRIMARY KEY,
    nombre_archivo          TEXT NOT NULL,
    hash_sha256             TEXT UNIQUE,                  -- deduplicación
    pdf_data                BYTEA,                        -- PDF original

    -- Datos extraídos por IA
    numero_factura          TEXT,
    fecha_emision           DATE,
    proveedor_ruc           TEXT,
    proveedor_razon_social  TEXT,
    cliente_ruc             TEXT,
    cliente_razon_social    TEXT,
    moneda                  TEXT DEFAULT 'PEN',           -- PEN | USD

    -- Valores monetarios
    subtotal                NUMERIC(14, 2),
    igv                     NUMERIC(14, 2),
    total_declarado         NUMERIC(14, 2),               -- total en el PDF
    total_calculado         NUMERIC(14, 2),               -- recalculado desde ítems
    total_discrepancia      NUMERIC(14, 2) DEFAULT 0.00,  -- |declarado - calculado|

    -- Metadata de procesamiento
    estado                  TEXT DEFAULT 'pendiente',     -- pendiente | procesado | error
    error_mensaje           TEXT,
    confianza_ia            FLOAT,                        -- score 0-1 retornado por IA
    raw_json                TEXT,                         -- respuesta completa de IA

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_facturas_estado         ON facturas (estado);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha_emision  ON facturas (fecha_emision);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor_ruc  ON facturas (proveedor_ruc);
CREATE INDEX IF NOT EXISTS idx_facturas_numero         ON facturas (numero_factura);

-- =============================================================================
-- TABLA DE ÍTEMS: factura_items
-- Una fila por línea de detalle de la factura
-- =============================================================================
CREATE TABLE IF NOT EXISTS factura_items (
    id                          SERIAL PRIMARY KEY,
    factura_id                  INT NOT NULL REFERENCES facturas (id) ON DELETE CASCADE,
    numero_item                 INT NOT NULL,             -- posición en la factura (1-based)
    descripcion                 TEXT,
    cantidad                    NUMERIC(14, 4),
    unidad_medida               TEXT,                     -- UND, KG, HRS, etc.
    precio_unitario             NUMERIC(14, 4),
    precio_unitario_calculado   BOOLEAN DEFAULT FALSE,    -- TRUE si fue recalculado (no declarado)
    subtotal_item               NUMERIC(14, 2),

    created_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_factura_id ON factura_items (factura_id);

-- =============================================================================
-- TABLA: lotes_procesamiento
-- Agrupa múltiples facturas en un lote de carga para reportes conjuntos
-- =============================================================================
CREATE TABLE IF NOT EXISTS lotes_procesamiento (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    descripcion     TEXT,
    usuario_id      INT,                                  -- FK a users si aplica
    total_archivos  INT DEFAULT 0,
    procesados      INT DEFAULT 0,
    con_error       INT DEFAULT 0,
    estado          TEXT DEFAULT 'en_proceso',            -- en_proceso | completado | cancelado
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completado_at   TIMESTAMPTZ
);

-- Relación factura ↔ lote (una factura puede pertenecer a un lote)
ALTER TABLE facturas
    ADD COLUMN IF NOT EXISTS lote_id INT REFERENCES lotes_procesamiento (id);

CREATE INDEX IF NOT EXISTS idx_facturas_lote_id ON facturas (lote_id);

-- =============================================================================
-- TABLA: usuarios (gestión de acceso al sistema)
-- Compatible con el sistema de auth JWT heredado
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE,
    hashed_password TEXT NOT NULL,
    role            TEXT DEFAULT 'viewer',                -- admin | operator | viewer
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABLA: app_settings
-- Configuración de la aplicación (branding, etc.)
-- =============================================================================
CREATE TABLE IF NOT EXISTS app_settings (
    key     TEXT PRIMARY KEY,
    value   TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TRIGGER: updated_at automático
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_facturas_updated_at
    BEFORE UPDATE ON facturas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- VISTAS ÚTILES
-- =============================================================================

-- Vista resumen: una fila por factura con conteo de ítems
CREATE OR REPLACE VIEW v_facturas_resumen AS
SELECT
    f.id,
    f.nombre_archivo,
    f.numero_factura,
    f.fecha_emision,
    f.proveedor_ruc,
    f.proveedor_razon_social,
    f.moneda,
    f.total_declarado,
    f.total_calculado,
    f.total_discrepancia,
    f.estado,
    f.confianza_ia,
    COUNT(i.id) AS cantidad_items,
    f.created_at
FROM facturas f
LEFT JOIN factura_items i ON i.factura_id = f.id
GROUP BY f.id;

-- Vista de alertas: solo facturas con discrepancia significativa (> S/ 0.10)
CREATE OR REPLACE VIEW v_facturas_alerta AS
SELECT *
FROM v_facturas_resumen
WHERE total_discrepancia > 0.10
ORDER BY total_discrepancia DESC;
