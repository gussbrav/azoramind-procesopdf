-- =============================================================================
-- Schema: Plantillas de Distribución de Costos — Transaltisa
-- Permite mapear cada tipo de factura a sus reglas de distribución contable
-- =============================================================================

-- =============================================================================
-- TABLA: plantillas
-- Define una plantilla de distribución por tipo de factura/proveedor
-- =============================================================================
CREATE TABLE IF NOT EXISTS plantillas (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,                    -- ej: "Claro Internet", "Claro RPV"
    proveedor_ruc   TEXT,                             -- RUC del proveedor para auto-matching
    descripcion     TEXT,                             -- descripcion interna del gasto
    activa          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plantillas_nombre ON plantillas (nombre);

-- =============================================================================
-- TABLA: plantilla_filas
-- Cada fila define una línea de distribución contable con su porcentaje
-- Corresponde a una fila del Excel de salida
-- =============================================================================
CREATE TABLE IF NOT EXISTS plantilla_filas (
    id                      SERIAL PRIMARY KEY,
    plantilla_id            INT NOT NULL REFERENCES plantillas (id) ON DELETE CASCADE,
    orden                   INT NOT NULL,              -- orden de aparición en el Excel

    -- Campos de contabilidad (van directamente al Excel)
    placa                   TEXT DEFAULT '-',
    sede_planta             TEXT DEFAULT '001',
    cuenta                  TEXT,                      -- ej: "913650101"
    centro_costos           TEXT,                      -- ej: "41070"
    linea_negocio_servicio  TEXT DEFAULT '000000',
    proyecto                TEXT,                      -- ej: "000022"
    descripcion             TEXT,                      -- ej: "Internet Transaltisa"
    etl_terceros            TEXT DEFAULT '-',

    -- Regla de distribución
    porcentaje              NUMERIC(10, 8) NOT NULL,   -- ej: 0.00333400 (0.3334%)

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plantilla_filas_plantilla_id ON plantilla_filas (plantilla_id);

-- =============================================================================
-- TABLA: distribucion_facturas
-- Resultado de aplicar una plantilla a una factura: una fila por línea contable
-- =============================================================================
CREATE TABLE IF NOT EXISTS distribucion_facturas (
    id                      SERIAL PRIMARY KEY,
    factura_id              INT NOT NULL REFERENCES facturas (id) ON DELETE CASCADE,
    plantilla_id            INT NOT NULL REFERENCES plantillas (id),
    plantilla_fila_id       INT NOT NULL REFERENCES plantilla_filas (id),

    -- Campos de contabilidad (copiados de la plantilla en el momento de distribución)
    placa                   TEXT,
    sede_planta             TEXT,
    cuenta                  TEXT,
    centro_costos           TEXT,
    linea_negocio_servicio  TEXT,
    proyecto                TEXT,
    descripcion             TEXT,
    cantidad                NUMERIC(14, 4) DEFAULT 1,
    etl_terceros            TEXT,

    -- Valores calculados
    porcentaje_aplicado     NUMERIC(10, 8),
    subtotal_factura        NUMERIC(14, 2),           -- subtotal del documento (excl. IGV)
    costo_unitario          NUMERIC(14, 2),           -- subtotal_factura × porcentaje
    numero_factura          TEXT,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distribucion_factura_id ON distribucion_facturas (factura_id);

-- =============================================================================
-- MAESTROS (catálogos de referencia para validación y lookups)
-- =============================================================================

CREATE TABLE IF NOT EXISTS maestro_sedes (
    codigo      TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    activa      BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS maestro_centros_costos (
    codigo      TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    activo      BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS maestro_proyectos (
    codigo      TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    activo      BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS maestro_cuentas_contables (
    cuenta      TEXT PRIMARY KEY,
    descripcion TEXT NOT NULL,
    tipo        TEXT                                  -- activo, pasivo, gasto, ingreso
);

CREATE TABLE IF NOT EXISTS maestro_lineas_negocio (
    codigo      TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL
);
