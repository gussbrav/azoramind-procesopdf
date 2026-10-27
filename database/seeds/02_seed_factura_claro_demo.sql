-- =============================================================================
-- Seed: Factura demo Claro SS01-01865991 + distribución contable
-- =============================================================================

BEGIN;

INSERT INTO facturas (
    nombre_archivo, numero_factura, fecha_emision,
    proveedor_ruc, proveedor_razon_social,
    cliente_ruc, cliente_razon_social,
    moneda, subtotal, igv, total_declarado, total_calculado, total_discrepancia,
    estado, confianza_ia, hash_sha256
) VALUES (
    'SS01-01865991.pdf',
    'SS01-01865991',
    '2024-11-01',
    '20461299255',
    'AMERICA MOVIL PERU S.A.C. (CLARO)',
    '20100070970',
    'TRANSALTISA S.A.',
    'PEN',
    7423.33,
    1336.20,
    8759.53,
    8759.53,
    0.00,
    'procesado',
    0.98,
    'demo-seed-ss01-01865991'
);

-- Aplicar distribución desde la plantilla Claro Internet (30 filas)
INSERT INTO distribucion_facturas (
    factura_id, plantilla_id, plantilla_fila_id,
    placa, sede_planta, cuenta, centro_costos,
    linea_negocio_servicio, proyecto, descripcion,
    cantidad, etl_terceros,
    subtotal_factura, costo_unitario, numero_factura
)
SELECT
    (SELECT id FROM facturas WHERE numero_factura = 'SS01-01865991'),
    pf.plantilla_id,
    pf.id,
    pf.placa, pf.sede_planta, pf.cuenta, pf.centro_costos,
    pf.linea_negocio_servicio, pf.proyecto, pf.descripcion,
    1,
    pf.etl_terceros,
    7423.33,
    pf.costo_unitario_referencia,
    'SS01-01865991'
FROM plantilla_filas pf
JOIN plantillas p ON p.id = pf.plantilla_id
WHERE p.nombre = 'Claro Internet'
ORDER BY pf.orden;

SELECT
    f.numero_factura,
    f.subtotal,
    COUNT(d.id)       AS filas_distribucion,
    SUM(d.costo_unitario) AS total_distribuido
FROM facturas f
JOIN distribucion_facturas d ON d.factura_id = f.id
WHERE f.numero_factura = 'SS01-01865991'
GROUP BY f.id, f.numero_factura, f.subtotal;

COMMIT;
