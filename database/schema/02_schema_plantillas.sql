-- =============================================================================
-- Schema: Plantillas de Distribución de Costos — Transaltisa
-- =============================================================================

CREATE TABLE IF NOT EXISTS plantillas (
    id                      SERIAL PRIMARY KEY,
    nombre                  TEXT NOT NULL,
    proveedor_ruc           TEXT,
    descripcion             TEXT,
    -- Fase 1: usar montos fijos del campo costo_unitario_referencia
    -- Fase 2 (pendiente): usar porcentajes cuando el cliente defina la fórmula
    usar_porcentaje         BOOLEAN DEFAULT FALSE,
    subtotal_referencia     NUMERIC(14, 2),   -- monto del recibo usado para calcular las referencias
    activa                  BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plantillas_nombre ON plantillas (nombre);

CREATE TABLE IF NOT EXISTS plantilla_filas (
    id                      SERIAL PRIMARY KEY,
    plantilla_id            INT NOT NULL REFERENCES plantillas (id) ON DELETE CASCADE,
    orden                   INT NOT NULL,

    -- Campos contables (van directamente al Excel)
    placa                   TEXT DEFAULT '-',
    sede_planta             TEXT DEFAULT '001',
    cuenta                  TEXT NOT NULL,
    centro_costos           TEXT NOT NULL,
    linea_negocio_servicio  TEXT DEFAULT '000000',
    proyecto                TEXT NOT NULL,
    descripcion             TEXT NOT NULL,
    etl_terceros            TEXT DEFAULT '-',

    -- Fase 1: monto fijo extraído de la Plantilla Excel de referencia
    costo_unitario_referencia NUMERIC(14, 2) NOT NULL,

    -- Fase 2: porcentaje implícito = costo_unitario_referencia / subtotal_referencia
    -- Se activa cuando plantillas.usar_porcentaje = TRUE
    porcentaje              NUMERIC(14, 8),

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plantilla_filas_pid ON plantilla_filas (plantilla_id, orden);

-- =============================================================================
-- Resultado de aplicar una plantilla a una factura
-- =============================================================================
CREATE TABLE IF NOT EXISTS distribucion_facturas (
    id                      SERIAL PRIMARY KEY,
    factura_id              INT NOT NULL REFERENCES facturas (id) ON DELETE CASCADE,
    plantilla_id            INT NOT NULL REFERENCES plantillas (id),
    plantilla_fila_id       INT NOT NULL REFERENCES plantilla_filas (id),

    -- Campos contables snapshot en el momento de distribución
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
    costo_unitario          NUMERIC(14, 2),
    subtotal_factura        NUMERIC(14, 2),   -- subtotal extraído del PDF (excl. IGV)
    numero_factura          TEXT,

    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distrib_factura_id ON distribucion_facturas (factura_id);

-- =============================================================================
-- Maestros / catálogos de referencia
-- =============================================================================
CREATE TABLE IF NOT EXISTS maestro_sedes (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    activa BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS maestro_centros_costos (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS maestro_proyectos (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS maestro_cuentas_contables (
    cuenta      TEXT PRIMARY KEY,
    descripcion TEXT NOT NULL,
    tipo        TEXT
);

CREATE TABLE IF NOT EXISTS maestro_lineas_negocio (
    codigo TEXT PRIMARY KEY,
    nombre TEXT NOT NULL
);
