"""
Generador de Excel con el detalle de facturas procesadas.

Produce un archivo .xlsx con:
  - Hoja "Resumen": una fila por factura (totales, proveedor, fecha, estado)
  - Hoja "Detalle Items": una fila por ítem de factura (valor unitario, cantidad, subtotal)
"""
import io
import logging
from datetime import datetime
from typing import Optional

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

logger = logging.getLogger(__name__)

# Paleta de colores Azoramind
_COLOR_HEADER = "1E3A5F"      # azul oscuro
_COLOR_SUBHEADER = "2E6DA4"   # azul medio
_COLOR_ALERTA = "FFD700"      # amarillo — discrepancia de totales
_COLOR_OK = "D4EDDA"          # verde suave — sin discrepancia


def _header_font(bold: bool = True) -> Font:
    return Font(name="Calibri", bold=bold, color="FFFFFF", size=10)


def _cell_font() -> Font:
    return Font(name="Calibri", size=10)


def _header_fill(color: str) -> PatternFill:
    return PatternFill(start_color=color, end_color=color, fill_type="solid")


def _autofit_columns(ws) -> None:
    """Ajusta el ancho de columnas al contenido."""
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            if cell.value:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max_len + 4, 50)


def _write_header_row(ws, headers: list[str], row: int = 1, color: str = _COLOR_HEADER) -> None:
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=col_idx, value=header)
        cell.font = _header_font()
        cell.fill = _header_fill(color)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def generar_excel(facturas: list[dict], nombre_reporte: Optional[str] = None) -> bytes:
    """
    Genera un archivo Excel en memoria con el detalle de facturas.

    Args:
        facturas: lista de dicts enriquecidos por valor_unitario.enriquecer_factura()
        nombre_reporte: nombre opcional para la primera hoja

    Returns:
        bytes del archivo .xlsx listo para enviar como response
    """
    wb = openpyxl.Workbook()
    ws_resumen = wb.active
    ws_resumen.title = nombre_reporte or "Resumen"
    ws_detalle = wb.create_sheet(title="Detalle Items")

    # ── Hoja Resumen ─────────────────────────────────────────────────────────
    resumen_headers = [
        "N°", "Archivo", "N° Factura", "Fecha Emisión",
        "Proveedor RUC", "Proveedor", "Cliente RUC", "Cliente",
        "Moneda", "Subtotal", "IGV", "Total Declarado",
        "Total Calculado", "Discrepancia", "Items", "Estado",
    ]
    _write_header_row(ws_resumen, resumen_headers)

    for i, factura in enumerate(facturas, start=1):
        discrepancia = factura.get("total_discrepancia", 0.0) or 0.0
        row_fill = _COLOR_ALERTA if discrepancia > 0.10 else _COLOR_OK
        fill = PatternFill(start_color=row_fill, end_color=row_fill, fill_type="solid")

        row_data = [
            i,
            factura.get("filename", ""),
            factura.get("numero_factura", ""),
            factura.get("fecha_emision", ""),
            factura.get("proveedor_ruc", ""),
            factura.get("proveedor_razon_social", ""),
            factura.get("cliente_ruc", ""),
            factura.get("cliente_razon_social", ""),
            factura.get("moneda", "PEN"),
            factura.get("subtotal", ""),
            factura.get("igv", ""),
            factura.get("total", ""),
            factura.get("total_calculado", ""),
            round(discrepancia, 2),
            len(factura.get("items") or []),
            "ALERTA" if discrepancia > 0.10 else "OK",
        ]
        row_idx = i + 1
        for col_idx, value in enumerate(row_data, start=1):
            cell = ws_resumen.cell(row=row_idx, column=col_idx, value=value)
            cell.font = _cell_font()
            cell.fill = fill
            cell.alignment = Alignment(vertical="center")

    _autofit_columns(ws_resumen)
    ws_resumen.freeze_panes = "A2"

    # ── Hoja Detalle Items ────────────────────────────────────────────────────
    detalle_headers = [
        "N° Factura", "Archivo", "# Item", "Descripción",
        "Cantidad", "Unidad", "Precio Unitario", "Precio Unitario Calculado",
        "Subtotal Item", "Moneda",
    ]
    _write_header_row(ws_detalle, detalle_headers, color=_COLOR_SUBHEADER)

    detalle_row = 2
    for factura in facturas:
        numero = factura.get("numero_factura", "")
        archivo = factura.get("filename", "")
        moneda = factura.get("moneda", "PEN")
        for j, item in enumerate(factura.get("items") or [], start=1):
            row_data = [
                numero,
                archivo,
                j,
                item.get("descripcion", ""),
                item.get("cantidad", ""),
                item.get("unidad_medida", ""),
                item.get("precio_unitario", ""),
                "SÍ" if item.get("precio_unitario_calculado") else "NO",
                item.get("subtotal_item", ""),
                moneda,
            ]
            for col_idx, value in enumerate(row_data, start=1):
                cell = ws_detalle.cell(row=detalle_row, column=col_idx, value=value)
                cell.font = _cell_font()
                cell.alignment = Alignment(vertical="center")
            detalle_row += 1

    _autofit_columns(ws_detalle)
    ws_detalle.freeze_panes = "A2"

    # ── Metadata del workbook ─────────────────────────────────────────────────
    wb.properties.title = "Reporte de Facturas — Transaltisa"
    wb.properties.creator = "Azoramind"
    wb.properties.created = datetime.utcnow()

    # Serializar a bytes en memoria
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    logger.info(
        f"[ExcelGenerator] Generado: {len(facturas)} facturas, "
        f"{detalle_row - 2} ítems"
    )
    return buffer.getvalue()
