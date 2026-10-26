"""
Generador de Excel con distribución contable de facturas.

Produce el archivo .xlsx con la estructura exacta requerida por Transaltisa:

Hoja1 (output contable):
  PLACA | SEDE/PLANTA | CUENTA | CENTRO COSTOS | LÍNEA NEGOCIO/SERVICIO |
  PROYECTO | DESCRIPCIÓN | CANTIDAD | COSTO UNITARIO | ETL/TERCEROS |
  SUBTOTAL DE FACTURA | NUM DE FACTURA

Hojas Maestro (catálogos de referencia):
  Maestro Sedes | Maestro Centro Costos | Maestro Linea Negocio Servicios |
  Maestro Proyectos | Maestro ETL | Cuentas Cont.
"""
import io
import logging
from datetime import datetime
from typing import Optional

import openpyxl
from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

logger = logging.getLogger(__name__)

# ── Paleta de colores ────────────────────────────────────────────────────────
_AZUL_HEADER   = "1F4E79"   # azul oscuro para headers principales
_AZUL_MEDIO    = "2E75B6"   # azul medio para sub-headers
_GRIS_CLARO    = "F2F2F2"   # fondo alternado filas
_VERDE_CLARO   = "E2EFDA"   # fila OK
_AMARILLO      = "FFEB9C"   # fila con diferencia de redondeo
_BLANCO        = "FFFFFF"

# ── Columnas de Hoja1 (output contable) ─────────────────────────────────────
_HOJA1_HEADERS = [
    "PLACA",
    "SEDE/PLANTA",
    "CUENTA",
    "CENTRO COSTOS",
    "LÍNEA NEGOCIO/SERVICIO",
    "PROYECTO",
    "DESCRIPCIÓN",
    "CANTIDAD",
    "COSTO UNITARIO",
    "ETL/TERCEROS",
    "SUBTOTAL DE FACTURA",
    "NUM DE FACTURA",
]

_HOJA1_KEYS = [
    "placa",
    "sede_planta",
    "cuenta",
    "centro_costos",
    "linea_negocio_servicio",
    "proyecto",
    "descripcion",
    "cantidad",
    "costo_unitario",
    "etl_terceros",
    "subtotal_factura",
    "numero_factura",
]

# Anchos de columna en caracteres
_HOJA1_WIDTHS = [8, 12, 14, 15, 22, 10, 24, 10, 16, 14, 20, 20]


def _font(bold: bool = False, size: int = 10, color: str = "000000") -> Font:
    return Font(name="Calibri", bold=bold, size=size, color=color)


def _fill(color: str) -> PatternFill:
    return PatternFill(start_color=color, end_color=color, fill_type="solid")


def _thin_border() -> Border:
    side = Side(style="thin", color="BFBFBF")
    return Border(left=side, right=side, top=side, bottom=side)


def _center() -> Alignment:
    return Alignment(horizontal="center", vertical="center")


def _write_hoja1(ws, filas: list[dict]) -> None:
    """Escribe Hoja1 con los datos de distribución contable."""

    # ── Fila de encabezados ──────────────────────────────────────────────────
    for col_idx, header in enumerate(_HOJA1_HEADERS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = _font(bold=True, color="FFFFFF")
        cell.fill = _fill(_AZUL_HEADER)
        cell.alignment = _center()
        cell.border = _thin_border()
        ws.column_dimensions[get_column_letter(col_idx)].width = _HOJA1_WIDTHS[col_idx - 1]

    ws.row_dimensions[1].height = 20
    ws.freeze_panes = "A2"

    # ── Filas de datos ───────────────────────────────────────────────────────
    total_costo = 0.0
    for row_idx, fila in enumerate(filas, start=2):
        bg = _GRIS_CLARO if row_idx % 2 == 0 else _BLANCO
        for col_idx, key in enumerate(_HOJA1_KEYS, start=1):
            value = fila.get(key, "")
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.font = _font(size=10)
            cell.fill = _fill(bg)
            cell.border = _thin_border()

            # Alineación según tipo de dato
            if key in ("costo_unitario", "cantidad", "subtotal_factura"):
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.number_format = '#,##0.00'
            elif key in ("placa", "sede_planta", "cuenta", "centro_costos",
                         "linea_negocio_servicio", "proyecto", "etl_terceros"):
                cell.alignment = _center()
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

        total_costo += fila.get("costo_unitario", 0)

    # ── Fila de totales ──────────────────────────────────────────────────────
    total_row = len(filas) + 2
    ws.cell(row=total_row, column=8, value="TOTAL").font = _font(bold=True)
    total_cell = ws.cell(row=total_row, column=9, value=round(total_costo, 2))
    total_cell.font = _font(bold=True)
    total_cell.number_format = '#,##0.00'
    total_cell.fill = _fill(_AZUL_MEDIO)
    total_cell.font = _font(bold=True, color="FFFFFF")


def _write_maestro(ws, titulo: str, headers: list[str], rows: list[dict], keys: list[str]) -> None:
    """Escribe una hoja de maestro/catálogo."""
    ws.cell(row=1, column=1, value=titulo).font = _font(bold=True, size=12, color=_AZUL_HEADER)
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=len(headers))

    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=2, column=col_idx, value=header)
        cell.font = _font(bold=True, color="FFFFFF")
        cell.fill = _fill(_AZUL_MEDIO)
        cell.alignment = _center()

    for row_idx, row in enumerate(rows, start=3):
        for col_idx, key in enumerate(keys, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=row.get(key, ""))
            cell.font = _font()

    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=10)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 4, 40)

    ws.freeze_panes = "A3"


def generar_excel(
    filas_distribucion: list[dict],
    maestros: Optional[dict] = None,
    nombre_reporte: str = "Distribución Facturas",
) -> bytes:
    """
    Genera el archivo Excel de distribución contable.

    Args:
        filas_distribucion: lista de dicts de distribucion_facturas
                           (output de plantilla_service.distribuir_factura)
        maestros: dict opcional con datos de tablas maestro para las hojas de catálogo
                  keys esperadas: sedes, centros_costos, proyectos, cuentas, lineas_negocio
        nombre_reporte: nombre de la primera hoja

    Returns:
        bytes del archivo .xlsx listo para descarga
    """
    wb = openpyxl.Workbook()

    # ── Hoja1: output contable ───────────────────────────────────────────────
    ws_hoja1 = wb.active
    ws_hoja1.title = "Hoja1"
    _write_hoja1(ws_hoja1, filas_distribucion)

    # ── Plantilla: referencia de porcentajes ─────────────────────────────────
    ws_plantilla = wb.create_sheet("Plantilla")
    _write_maestro(
        ws_plantilla,
        "Plantilla de Distribución",
        ["CUENTA", "CENTRO COSTOS", "LN/SERVICIO", "PROYECTO", "DESCRIPCIÓN", "PORCENTAJE %"],
        [
            {
                "cuenta": f["cuenta"],
                "centro_costos": f["centro_costos"],
                "linea_negocio_servicio": f["linea_negocio_servicio"],
                "proyecto": f["proyecto"],
                "descripcion": f["descripcion"],
                "porcentaje": f"{float(f.get('porcentaje_aplicado', 0)) * 100:.4f}%",
            }
            for f in filas_distribucion
        ],
        ["cuenta", "centro_costos", "linea_negocio_servicio", "proyecto", "descripcion", "porcentaje"],
    )

    # ── Hojas Maestro ────────────────────────────────────────────────────────
    maestros = maestros or {}

    ws_sedes = wb.create_sheet("Maestro Sedes")
    _write_maestro(
        ws_sedes, "Maestro de Sedes",
        ["CÓDIGO", "NOMBRE", "ACTIVA"],
        maestros.get("sedes", []),
        ["codigo", "nombre", "activa"],
    )

    ws_cc = wb.create_sheet("Maestro Centro Costos")
    _write_maestro(
        ws_cc, "Maestro de Centros de Costo",
        ["CÓDIGO", "NOMBRE", "ACTIVO"],
        maestros.get("centros_costos", []),
        ["codigo", "nombre", "activo"],
    )

    ws_ln = wb.create_sheet("Maestro Linea Negocio Servicios")
    _write_maestro(
        ws_ln, "Maestro de Líneas de Negocio",
        ["CÓDIGO", "NOMBRE"],
        maestros.get("lineas_negocio", []),
        ["codigo", "nombre"],
    )

    ws_proy = wb.create_sheet("Maestro Proyectos")
    _write_maestro(
        ws_proy, "Maestro de Proyectos",
        ["CÓDIGO", "NOMBRE", "ACTIVO"],
        maestros.get("proyectos", []),
        ["codigo", "nombre", "activo"],
    )

    ws_etl = wb.create_sheet("Maestro ETL")
    _write_maestro(
        ws_etl, "Maestro ETL / Terceros",
        ["CÓDIGO", "DESCRIPCIÓN"],
        maestros.get("etl", []),
        ["codigo", "descripcion"],
    )

    ws_cuentas = wb.create_sheet("Cuentas Cont.")
    _write_maestro(
        ws_cuentas, "Plan de Cuentas Contables",
        ["CUENTA", "DESCRIPCIÓN", "TIPO"],
        maestros.get("cuentas", []),
        ["cuenta", "descripcion", "tipo"],
    )

    # ── Metadatos del workbook ───────────────────────────────────────────────
    wb.properties.title = f"Distribución Facturas — Transaltisa"
    wb.properties.creator = "Azoramind"
    wb.properties.created = datetime.utcnow()

    # Ordenar hojas: Plantilla primero, luego Hoja1, luego Maestros
    # (openpyxl usa índice de posición)
    ws_plantilla.sheet_properties.tabColor = "2E75B6"
    ws_hoja1.sheet_properties.tabColor = "1F4E79"

    # Serializar a bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    logger.info(
        f"[ExcelGenerator] Generado: {len(filas_distribucion)} filas de distribución, "
        f"{wb.sheetnames}"
    )
    return buffer.getvalue()
