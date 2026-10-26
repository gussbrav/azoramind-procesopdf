"""
Lógica de cálculo y normalización de valores unitarios de facturas.

Responsabilidades:
  - Validar y recalcular precio_unitario desde cantidad + subtotal si falta
  - Detectar inconsistencias entre líneas (cantidad × precio ≠ subtotal)
  - Normalizar moneda y aplicar tipo de cambio si corresponde
  - Calcular totales de resumen por factura y por lote
"""
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

logger = logging.getLogger(__name__)

_DECIMALES = Decimal("0.01")


def calcular_precio_unitario(
    cantidad: Optional[float],
    subtotal_item: Optional[float],
    precio_declarado: Optional[float],
) -> Optional[float]:
    """
    Determina el precio unitario real de una línea de factura.

    Prioridad:
      1. Si precio_declarado es consistente con cantidad × precio ≈ subtotal → usar precio_declarado
      2. Si precio_declarado falta o es inconsistente → calcular desde subtotal / cantidad
      3. Si cantidad es 0 o nula → retornar None
    """
    if cantidad is None or cantidad == 0:
        return None

    if precio_declarado is not None and subtotal_item is not None:
        calculado = Decimal(str(subtotal_item)) / Decimal(str(cantidad))
        declarado_d = Decimal(str(precio_declarado))
        tolerancia = Decimal("0.05")  # 5 centavos de diferencia aceptable
        if abs(calculado - declarado_d) <= tolerancia:
            return float(declarado_d.quantize(_DECIMALES, ROUND_HALF_UP))
        logger.warning(
            f"[ValorUnitario] Inconsistencia: declarado={precio_declarado}, "
            f"calculado={float(calculado):.4f}. Se usa el calculado."
        )

    if subtotal_item is not None:
        resultado = Decimal(str(subtotal_item)) / Decimal(str(cantidad))
        return float(resultado.quantize(_DECIMALES, ROUND_HALF_UP))

    return precio_declarado


def procesar_items(items: list[dict]) -> list[dict]:
    """
    Procesa la lista de ítems de una factura:
      - Recalcula precio_unitario si es necesario
      - Agrega campo `precio_unitario_calculado` (bool) para trazabilidad
      - Redondea valores monetarios a 2 decimales
    """
    procesados = []
    for i, item in enumerate(items):
        item_out = dict(item)
        cantidad = item.get("cantidad")
        subtotal = item.get("subtotal_item")
        precio = item.get("precio_unitario")

        precio_final = calcular_precio_unitario(cantidad, subtotal, precio)
        fue_calculado = precio_final != precio and precio is not None

        item_out["precio_unitario"] = precio_final
        item_out["precio_unitario_calculado"] = fue_calculado

        # Redondear subtotal_item
        if subtotal is not None:
            item_out["subtotal_item"] = float(
                Decimal(str(subtotal)).quantize(_DECIMALES, ROUND_HALF_UP)
            )

        procesados.append(item_out)
        if fue_calculado:
            logger.info(
                f"[ValorUnitario] Ítem {i+1}: precio recalculado "
                f"{precio} → {precio_final}"
            )

    return procesados


def calcular_totales(items: list[dict], igv_rate: float = 0.18) -> dict:
    """
    Calcula subtotal, IGV y total desde los ítems procesados.
    Útil para verificar contra los totales declarados en la factura.
    """
    subtotal = sum(
        Decimal(str(it.get("subtotal_item") or 0)) for it in items
    )
    igv = (subtotal * Decimal(str(igv_rate))).quantize(_DECIMALES, ROUND_HALF_UP)
    total = subtotal + igv

    return {
        "subtotal_calculado": float(subtotal.quantize(_DECIMALES, ROUND_HALF_UP)),
        "igv_calculado": float(igv),
        "total_calculado": float(total),
    }


def enriquecer_factura(factura_data: dict) -> dict:
    """
    Punto de entrada principal: toma el dict extraído por pdf_extractor
    y retorna el dict enriquecido con valores unitarios calculados y totales verificados.
    """
    if "error" in factura_data:
        return factura_data

    items_raw = factura_data.get("items") or []
    items_procesados = procesar_items(items_raw)
    totales = calcular_totales(items_procesados)

    resultado = {
        **factura_data,
        "items": items_procesados,
        **totales,
    }

    # Marcar discrepancias entre total declarado y calculado
    total_declarado = factura_data.get("total")
    if total_declarado is not None:
        diferencia = abs(
            Decimal(str(total_declarado)) - Decimal(str(totales["total_calculado"]))
        )
        resultado["total_discrepancia"] = float(diferencia)
        if diferencia > Decimal("0.10"):
            logger.warning(
                f"[ValorUnitario] Discrepancia de total en factura "
                f"{factura_data.get('numero_factura')}: "
                f"declarado={total_declarado}, calculado={totales['total_calculado']}"
            )

    return resultado
