"""
Servicio de distribución de costos contables.

Toma el subtotal de una factura y una plantilla de distribución
y produce las filas de asignación contable (una por línea de la plantilla).

Estas filas son las que van directamente al Excel de salida (Hoja1).
"""
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from app.database import get_db

logger = logging.getLogger(__name__)

_DECIMALES = Decimal("0.01")


def obtener_plantilla_por_proveedor(proveedor_ruc: str) -> Optional[dict]:
    """
    Busca la plantilla activa asociada al RUC del proveedor.
    Retorna la plantilla con sus filas o None si no existe.
    """
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM plantillas WHERE proveedor_ruc = %s AND activa = TRUE LIMIT 1",
                [proveedor_ruc],
            )
            plantilla = cur.fetchone()
            if not plantilla:
                return None

            cur.execute(
                "SELECT * FROM plantilla_filas WHERE plantilla_id = %s ORDER BY orden",
                [plantilla["id"]],
            )
            filas = cur.fetchall()

    return {**dict(plantilla), "filas": [dict(f) for f in filas]}


def obtener_plantilla_por_nombre(nombre: str) -> Optional[dict]:
    """Busca plantilla por nombre exacto."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM plantillas WHERE nombre = %s AND activa = TRUE LIMIT 1",
                [nombre],
            )
            plantilla = cur.fetchone()
            if not plantilla:
                return None
            cur.execute(
                "SELECT * FROM plantilla_filas WHERE plantilla_id = %s ORDER BY orden",
                [plantilla["id"]],
            )
            filas = cur.fetchall()

    return {**dict(plantilla), "filas": [dict(f) for f in filas]}


def distribuir_factura(
    factura_id: int,
    subtotal: float,
    numero_documento: str,
    plantilla: dict,
) -> list[dict]:
    """
    Aplica la plantilla al subtotal de la factura.

    Calcula costo_unitario = subtotal × porcentaje para cada fila.
    Persiste en distribucion_facturas y retorna las filas para el Excel.

    El último centavo de diferencia por redondeo se ajusta en la última fila
    para garantizar que sum(costo_unitario) == subtotal.
    """
    subtotal_d = Decimal(str(subtotal))
    filas = plantilla["filas"]
    plantilla_id = plantilla["id"]

    if not filas:
        logger.warning(f"[Plantilla] Plantilla '{plantilla['nombre']}' sin filas")
        return []

    # Calcular costo_unitario por fila
    filas_calculadas = []
    suma = Decimal("0")

    for i, fila in enumerate(filas):
        porcentaje = Decimal(str(fila["porcentaje"]))
        costo = (subtotal_d * porcentaje).quantize(_DECIMALES, ROUND_HALF_UP)

        # Ajuste de redondeo en última fila
        if i == len(filas) - 1:
            costo = subtotal_d - suma
            costo = costo.quantize(_DECIMALES, ROUND_HALF_UP)

        suma += costo

        filas_calculadas.append({
            "plantilla_fila_id": fila["id"],
            "placa": fila.get("placa", "-"),
            "sede_planta": fila.get("sede_planta", "001"),
            "cuenta": fila.get("cuenta", ""),
            "centro_costos": fila.get("centro_costos", ""),
            "linea_negocio_servicio": fila.get("linea_negocio_servicio", "000000"),
            "proyecto": fila.get("proyecto", ""),
            "descripcion": fila.get("descripcion", ""),
            "cantidad": 1,
            "etl_terceros": fila.get("etl_terceros", "-"),
            "porcentaje_aplicado": float(porcentaje),
            "subtotal_factura": subtotal,
            "costo_unitario": float(costo),
            "numero_factura": numero_documento,
        })

    # Persistir en base de datos
    _guardar_distribucion(factura_id, plantilla_id, filas_calculadas)

    logger.info(
        f"[Plantilla] Factura {factura_id}: {len(filas_calculadas)} filas, "
        f"suma={float(suma):.2f}, subtotal={subtotal}"
    )
    return filas_calculadas


def _guardar_distribucion(factura_id: int, plantilla_id: int, filas: list[dict]) -> None:
    """Inserta las filas de distribución calculadas en la tabla distribucion_facturas."""
    with get_db() as conn:
        with conn.cursor() as cur:
            # Limpiar distribuciones previas si se reprocesa
            cur.execute(
                "DELETE FROM distribucion_facturas WHERE factura_id = %s",
                [factura_id],
            )
            for fila in filas:
                cur.execute(
                    """
                    INSERT INTO distribucion_facturas (
                        factura_id, plantilla_id, plantilla_fila_id,
                        placa, sede_planta, cuenta, centro_costos,
                        linea_negocio_servicio, proyecto, descripcion,
                        cantidad, etl_terceros,
                        porcentaje_aplicado, subtotal_factura, costo_unitario,
                        numero_factura
                    ) VALUES (
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                    )
                    """,
                    [
                        factura_id, plantilla_id, fila["plantilla_fila_id"],
                        fila["placa"], fila["sede_planta"], fila["cuenta"],
                        fila["centro_costos"], fila["linea_negocio_servicio"],
                        fila["proyecto"], fila["descripcion"],
                        fila["cantidad"], fila["etl_terceros"],
                        fila["porcentaje_aplicado"], fila["subtotal_factura"],
                        fila["costo_unitario"], fila["numero_factura"],
                    ],
                )
