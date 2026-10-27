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

    Fase 1 (usar_porcentaje=False):
      costo_unitario = costo_unitario_referencia (monto fijo de la plantilla)

    Fase 2 (usar_porcentaje=True):
      costo_unitario = subtotal × porcentaje
      El último centavo de redondeo se ajusta en la última fila.

    Persiste en distribucion_facturas y retorna las filas para el Excel.
    """
    subtotal_d = Decimal(str(subtotal))
    filas = plantilla["filas"]
    plantilla_id = plantilla["id"]
    usar_porcentaje = plantilla.get("usar_porcentaje", False)

    if not filas:
        logger.warning(f"[Plantilla] Plantilla '{plantilla['nombre']}' sin filas")
        return []

    filas_calculadas = []
    suma = Decimal("0")

    for i, fila in enumerate(filas):
        if usar_porcentaje:
            # Fase 2: porcentaje × subtotal real
            porcentaje = Decimal(str(fila["porcentaje"]))
            costo = (subtotal_d * porcentaje).quantize(_DECIMALES, ROUND_HALF_UP)
            # Ajuste de redondeo en última fila
            if i == len(filas) - 1:
                costo = (subtotal_d - suma).quantize(_DECIMALES, ROUND_HALF_UP)
        else:
            # Fase 1: montos fijos de la plantilla de referencia
            costo = Decimal(str(fila["costo_unitario_referencia"])).quantize(
                _DECIMALES, ROUND_HALF_UP
            )

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
            "subtotal_factura": subtotal,
            "costo_unitario": float(costo),
            "numero_factura": numero_documento,
        })

    _guardar_distribucion(factura_id, plantilla_id, filas_calculadas)

    logger.info(
        f"[Plantilla] Factura {factura_id}: {len(filas_calculadas)} filas, "
        f"suma={float(suma):.2f}, subtotal={subtotal}, "
        f"modo={'porcentaje' if usar_porcentaje else 'monto_fijo'}"
    )
    return filas_calculadas


def _guardar_distribucion(factura_id: int, plantilla_id: int, filas: list[dict]) -> None:
    """Inserta las filas de distribución calculadas en la tabla distribucion_facturas."""
    with get_db() as conn:
        with conn.cursor() as cur:
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
                        subtotal_factura, costo_unitario, numero_factura
                    ) VALUES (
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                    )
                    """,
                    [
                        factura_id, plantilla_id, fila["plantilla_fila_id"],
                        fila["placa"], fila["sede_planta"], fila["cuenta"],
                        fila["centro_costos"], fila["linea_negocio_servicio"],
                        fila["proyecto"], fila["descripcion"],
                        fila["cantidad"], fila["etl_terceros"],
                        fila["subtotal_factura"], fila["costo_unitario"],
                        fila["numero_factura"],
                    ],
                )
