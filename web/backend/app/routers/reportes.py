"""
Router para generación de reportes Excel de distribución contable.
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
    factura_id: Optional[int] = Query(default=None, description="Exportar una factura específica"),
    fecha_desde: Optional[date] = Query(default=None),
    fecha_hasta: Optional[date] = Query(default=None),
    proveedor_ruc: Optional[str] = Query(default=None),
    numero_factura: Optional[str] = Query(default=None),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Genera y descarga el Excel de distribución contable.

    Si se pasa `factura_id`, exporta solo esa factura.
    Si no, exporta todas las facturas que cumplan los filtros.
    """
    filas = _fetch_distribucion(
        factura_id=factura_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        proveedor_ruc=proveedor_ruc,
        numero_factura=numero_factura,
    )

    if not filas:
        raise HTTPException(
            status_code=404,
            detail="No hay distribución calculada para los filtros indicados. "
                   "Verifique que las facturas están procesadas y tienen plantilla asignada.",
        )

    maestros = _fetch_maestros()
    nombre = _nombre_reporte(factura_id, fecha_desde, fecha_hasta)
    excel_bytes = generar_excel(filas, maestros=maestros, nombre_reporte=nombre)

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nombre}.xlsx"'},
    )


@router.get("/stats")
def obtener_stats(
    current_user: TokenData = Depends(get_current_user),
):
    """Estadísticas de resumen del lote de facturas procesadas."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*)                                                     AS total_facturas,
                    COUNT(*) FILTER (WHERE estado = 'procesado')                AS procesadas,
                    COUNT(*) FILTER (WHERE estado = 'pendiente')                AS pendientes,
                    COUNT(*) FILTER (WHERE estado = 'error')                    AS con_error,
                    (SELECT COUNT(DISTINCT factura_id) FROM distribucion_facturas) AS con_distribucion,
                    SUM(subtotal)                                                AS monto_total,
                    AVG(confianza_ia)                                            AS confianza_promedio
                FROM facturas
            """)
            stats = dict(cur.fetchone())

    return stats


@router.get("/preview/{factura_id}")
def preview_distribucion(
    factura_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """
    Retorna las filas de distribución contable de una factura en JSON.
    Útil para previsualizar antes de descargar el Excel.
    """
    filas = _fetch_distribucion(factura_id=factura_id)
    if not filas:
        raise HTTPException(
            status_code=404,
            detail="Sin distribución para esta factura. ¿Tiene plantilla asignada?",
        )
    return {"factura_id": factura_id, "total_filas": len(filas), "filas": filas}


def _fetch_distribucion(
    factura_id: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    proveedor_ruc: Optional[str] = None,
    numero_factura: Optional[str] = None,
) -> list[dict]:
    """Consulta las filas de distribución aplicando filtros."""
    conditions = []
    params: list = []

    if factura_id:
        conditions.append("d.factura_id = %s")
        params.append(factura_id)
    if fecha_desde:
        conditions.append("f.fecha_emision >= %s")
        params.append(fecha_desde)
    if fecha_hasta:
        conditions.append("f.fecha_emision <= %s")
        params.append(fecha_hasta)
    if proveedor_ruc:
        conditions.append("f.proveedor_ruc = %s")
        params.append(proveedor_ruc)
    if numero_factura:
        conditions.append("f.numero_factura ILIKE %s")
        params.append(f"%{numero_factura}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT d.*
                FROM distribucion_facturas d
                JOIN facturas f ON f.id = d.factura_id
                {where}
                ORDER BY f.fecha_emision DESC, d.factura_id, d.id
                """,
                params,
            )
            return [dict(r) for r in cur.fetchall()]


def _fetch_maestros() -> dict:
    """Carga los catálogos maestro para las hojas de referencia del Excel."""
    with get_db() as conn:
        with conn.cursor() as cur:
            def fetch(table):
                try:
                    cur.execute(f"SELECT * FROM {table} ORDER BY 1")
                    return [dict(r) for r in cur.fetchall()]
                except Exception:
                    return []

            return {
                "sedes":         fetch("maestro_sedes"),
                "centros_costos": fetch("maestro_centros_costos"),
                "proyectos":     fetch("maestro_proyectos"),
                "cuentas":       fetch("maestro_cuentas_contables"),
                "lineas_negocio": fetch("maestro_lineas_negocio"),
                "etl":           [],
            }


def _nombre_reporte(
    factura_id: Optional[int],
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
) -> str:
    if factura_id:
        return f"Distribucion_Factura_{factura_id}"
    partes = ["Distribucion_Facturas"]
    if fecha_desde:
        partes.append(str(fecha_desde))
    if fecha_hasta:
        partes.append(str(fecha_hasta))
    return "_".join(partes)
