"""
Router para generación y descarga de reportes Excel.
"""
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response

from app.auth.jwt import TokenData, get_current_user
from app.database import get_db
from app.services.excel_generator import generar_excel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reportes", tags=["Reportes"])


@router.get("/excel")
def exportar_excel(
    fecha_desde: Optional[date] = Query(default=None, description="Filtro fecha desde (YYYY-MM-DD)"),
    fecha_hasta: Optional[date] = Query(default=None, description="Filtro fecha hasta (YYYY-MM-DD)"),
    proveedor_ruc: Optional[str] = Query(default=None, description="Filtrar por RUC del proveedor"),
    solo_alertas: bool = Query(default=False, description="Solo facturas con discrepancia de total"),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Genera y descarga un archivo Excel con el detalle de facturas procesadas.

    Aplica los filtros opcionales y retorna el .xlsx directamente.
    """
    facturas = _fetch_facturas_para_reporte(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        proveedor_ruc=proveedor_ruc,
        solo_alertas=solo_alertas,
    )

    if not facturas:
        raise HTTPException(status_code=404, detail="No hay facturas que coincidan con los filtros")

    nombre = _generar_nombre_reporte(fecha_desde, fecha_hasta, proveedor_ruc)
    excel_bytes = generar_excel(facturas, nombre_reporte=nombre)

    filename = f"{nombre}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/stats")
def obtener_stats(
    current_user: TokenData = Depends(get_current_user),
):
    """Retorna estadísticas de resumen del lote de facturas procesadas."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) AS total_facturas,
                    COUNT(*) FILTER (WHERE estado = 'procesado') AS procesadas,
                    COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
                    COUNT(*) FILTER (WHERE estado = 'error') AS con_error,
                    COUNT(*) FILTER (WHERE total_discrepancia > 0.10) AS con_alerta,
                    SUM(total_declarado) AS monto_total,
                    AVG(confianza_ia) AS confianza_promedio
                FROM facturas
            """)
            stats = dict(cur.fetchone())

    return stats


def _fetch_facturas_para_reporte(
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
    proveedor_ruc: Optional[str],
    solo_alertas: bool,
) -> list[dict]:
    """Consulta facturas con sus ítems para construir el reporte."""
    conditions = ["f.estado = 'procesado'"]
    params: list = []

    if fecha_desde:
        conditions.append("f.fecha_emision >= %s")
        params.append(fecha_desde)
    if fecha_hasta:
        conditions.append("f.fecha_emision <= %s")
        params.append(fecha_hasta)
    if proveedor_ruc:
        conditions.append("f.proveedor_ruc = %s")
        params.append(proveedor_ruc)
    if solo_alertas:
        conditions.append("f.total_discrepancia > 0.10")

    where = " AND ".join(conditions)

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT f.*
                FROM facturas f
                WHERE {where}
                ORDER BY f.fecha_emision DESC, f.id
                """,
                params,
            )
            facturas_rows = cur.fetchall()

            resultado = []
            for row in facturas_rows:
                fdata = dict(row)
                cur.execute(
                    "SELECT * FROM factura_items WHERE factura_id = %s ORDER BY numero_item",
                    [fdata["id"]],
                )
                fdata["items"] = [dict(i) for i in cur.fetchall()]
                # Normalizar filename para el generador
                fdata.setdefault("filename", fdata.get("nombre_archivo", ""))
                resultado.append(fdata)

    return resultado


def _generar_nombre_reporte(
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
    proveedor_ruc: Optional[str],
) -> str:
    partes = ["Facturas"]
    if proveedor_ruc:
        partes.append(proveedor_ruc)
    if fecha_desde:
        partes.append(str(fecha_desde))
    if fecha_hasta:
        partes.append(str(fecha_hasta))
    return "_".join(partes)
