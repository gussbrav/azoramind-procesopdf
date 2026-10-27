-- =============================================================================
-- Seed: Plantilla "Claro Internet" — Transaltisa
-- Fuente: CLARO INTERNET.xlsx (tab Plantilla) — subtotal referencia 7,423.33
-- RUC Claro Perú: 20461299255
-- =============================================================================

BEGIN;

INSERT INTO plantillas (nombre, proveedor_ruc, descripcion, usar_porcentaje, subtotal_referencia, activa)
VALUES (
    'Claro Internet',
    '20461299255',
    'Distribución de costos Internet Corporativo Claro — 30 centros de costo',
    FALSE,
    7423.33,
    TRUE
)
ON CONFLICT DO NOTHING;

-- Capturar el ID recién insertado (o existente si ya fue cargado)
DO $$
DECLARE
    v_pid INT;
BEGIN
    SELECT id INTO v_pid FROM plantillas WHERE nombre = 'Claro Internet';

    -- Limpiar filas previas para permitir re-ejecución idempotente
    DELETE FROM plantilla_filas WHERE plantilla_id = v_pid;

    INSERT INTO plantilla_filas
        (plantilla_id, orden, placa, sede_planta, cuenta, centro_costos,
         linea_negocio_servicio, proyecto, descripcion, etl_terceros,
         costo_unitario_referencia)
    VALUES
        (v_pid,  1, '-', '001', '913650101', '41070', '000000', '000022', 'Internet Transaltisa', '-', 24.75),
        (v_pid,  2, '-', '001', '913650101', '41070', '000000', '000019', 'Internet Transaltisa', '-', 470.15),
        (v_pid,  3, '-', '001', '913650101', '41070', '000000', '000022', 'Internet Transaltisa', '-', 24.75),
        (v_pid,  4, '-', '001', '913650101', '41070', '000000', '000019', 'Internet Transaltisa', '-', 470.15),
        (v_pid,  5, '-', '001', '913650101', '41010', '000000', '000030', 'Internet Transaltisa', '-', 4.94),
        (v_pid,  6, '-', '001', '913650101', '41010', '000000', '000007', 'Internet Transaltisa', '-', 64.33),
        (v_pid,  7, '-', '001', '913650101', '41010', '000000', '000026', 'Internet Transaltisa', '-', 29.69),
        (v_pid,  8, '-', '001', '913650101', '41010', '000000', '000032', 'Internet Transaltisa', '-', 44.54),
        (v_pid,  9, '-', '001', '913650101', '41010', '000000', '000003', 'Internet Transaltisa', '-', 94.02),
        (v_pid, 10, '-', '001', '913650101', '41010', '000000', '000016', 'Internet Transaltisa', '-', 84.14),
        (v_pid, 11, '-', '001', '913650101', '41010', '000000', '000018', 'Internet Transaltisa', '-', 173.22),
        (v_pid, 12, '-', '001', '913650101', '41070', '000000', '000019', 'Internet Transaltisa', '-', 494.90),
        (v_pid, 13, '-', '001', '913650101', '41070', '000000', '000022', 'Internet Transaltisa', '-', 494.90),
        (v_pid, 14, '-', '001', '913650101', '41070', '000000', '000022', 'Internet Transaltisa', '-', 24.75),
        (v_pid, 15, '-', '001', '913650101', '41070', '000000', '000019', 'Internet Transaltisa', '-', 470.15),
        (v_pid, 16, '-', '001', '913650101', '41070', '000000', '000022', 'Internet Transaltisa', '-', 24.75),
        (v_pid, 17, '-', '001', '913650101', '41070', '000000', '000019', 'Internet Transaltisa', '-', 470.15),
        (v_pid, 18, '-', '001', '913650101', '41073', '000000', '000024', 'Internet Transaltisa', '-', 494.90),
        (v_pid, 19, '-', '001', '943650101', '11200', '000000', '000000', 'Internet Transaltisa', '-', 494.90),
        (v_pid, 20, '-', '001', '913650101', '41080', '000000', '000025', 'Internet Transaltisa', '-', 494.90),
        (v_pid, 21, '-', '001', '943650101', '11200', '000000', '000000', 'Internet Transaltisa', '-', 494.90),
        (v_pid, 22, '-', '001', '943650101', '11200', '000000', '000000', 'Internet Transaltisa', '-', 494.90),
        (v_pid, 23, '-', '001', '953650101', '44010', '000000', '000021', 'Internet Transaltisa', '-', 103.93),
        (v_pid, 24, '-', '001', '953650101', '44010', '000000', '000025', 'Internet Transaltisa', '-', 257.35),
        (v_pid, 25, '-', '001', '953650101', '44010', '000000', '000012', 'Internet Transaltisa', '-', 133.62),
        (v_pid, 26, '-', '001', '953650101', '44020', '000000', '000007', 'Internet Transaltisa', '-', 89.08),
        (v_pid, 27, '-', '001', '953650101', '44020', '000000', '000032', 'Internet Transaltisa', '-', 59.38),
        (v_pid, 28, '-', '001', '953650101', '44020', '000000', '000003', 'Internet Transaltisa', '-', 123.72),
        (v_pid, 29, '-', '001', '953650101', '44020', '000000', '000018', 'Internet Transaltisa', '-', 222.70),
        (v_pid, 30, '-', '001', '953650101', '44040', '000000', '000019', 'Internet Transaltisa', '-', 494.77);

    RAISE NOTICE 'Plantilla "Claro Internet" (id=%) cargada con 30 filas. Suma=%',
        v_pid,
        (SELECT SUM(costo_unitario_referencia) FROM plantilla_filas WHERE plantilla_id = v_pid);
END $$;

COMMIT;
