"""
Router para gestión de facturas: upload, listado, estado y procesamiento.
"""
import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, UploadFile, HTTPException
from fastapi.responses import Response

from app.auth.jwt import TokenData, get_current_user
from app.config import settings
from app.database import get_db
from app.services.pdf_extractor import extract_invoice_data
from app.services.plantilla_service import (
    distribuir_factura,
    obtener_plantilla_por_proveedor,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/facturas", tags=["Facturas"])


@router.get("")
def list_facturas(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    estado: Optional[str] = Query(default=None),
    current_user: TokenData = Depends(get_current_user),
):
    """Lista todas las facturas con paginación y filtro opcional por estado."""
    offset = (page - 1) * limit

    with get_db() as conn:
        with conn.cursor() as cur:
            base_query = "SELECT * FROM facturas"
            params: list = []

            if estado:
                base_query += " WHERE estado = %s"
                params.append(estado)

            base_query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
            params.extend([limit, offset])

            cur.execute(base_query, params)
            rows = cur.fetchall()

            cur.execute("SELECT COUNT(*) FROM facturas" + (" WHERE estado = %s" if estado else ""), [estado] if estado else [])
            total = cur.fetchone()["count"]

    return {
        "data": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{factura_id}")
def get_factura(
    factura_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """Retorna el detalle completo de una factura incluyendo sus ítems."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM facturas WHERE id = %s", [factura_id])
            factura = cur.fetchone()
            if not factura:
                raise HTTPException(status_code=404, detail="Factura no encontrada")

            cur.execute(
                "SELECT * FROM factura_items WHERE factura_id = %s ORDER BY numero_item",
                [factura_id],
            )
            items = cur.fetchall()

    return {**dict(factura), "items": [dict(i) for i in items]}


@router.post("/upload")
async def upload_factura(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user),
):
    """
    Recibe un PDF de factura, lo almacena y dispara el procesamiento en background.
    Retorna el factura_id inmediatamente.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 20 * 1024 * 1024:  # 20 MB
        raise HTTPException(status_code=413, detail="El archivo excede el límite de 20 MB")

    sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    with get_db() as conn:
        with conn.cursor() as cur:
            # Deduplicación por hash
            cur.execute("SELECT id FROM facturas WHERE hash_sha256 = %s", [sha256])
            existente = cur.fetchone()
            if existente:
                return {
                    "factura_id": existente["id"],
                    "mensaje": "Factura ya procesada previamente",
                    "duplicado": True,
                }

            cur.execute(
                """
                INSERT INTO facturas (nombre_archivo, estado, hash_sha256, pdf_data)
                VALUES (%s, 'pendiente', %s, %s)
                RETURNING id
                """,
                [file.filename, sha256, pdf_bytes],
            )
            factura_id = cur.fetchone()["id"]

    background_tasks.add_task(_procesar_factura, factura_id, pdf_bytes, file.filename)

    return {"factura_id": factura_id, "mensaje": "Factura recibida y en proceso", "duplicado": False}


@router.get("/{factura_id}/pdf")
def get_pdf(
    factura_id: int,
    current_user: TokenData = Depends(get_current_user),
):
    """Descarga el PDF original de la factura."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT pdf_data, nombre_archivo FROM facturas WHERE id = %s", [factura_id])
            row = cur.fetchone()
            if not row or not row["pdf_data"]:
                raise HTTPException(status_code=404, detail="PDF no encontrado")

    return Response(
        content=bytes(row["pdf_data"]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{row["nombre_archivo"]}"'},
    )


async def _procesar_factura(factura_id: int, pdf_bytes: bytes, filename: str) -> None:
    """Task background: OCR → extracción IA → distribución contable → guardar."""
    logger.info(f"[Background] Procesando factura id={factura_id}")

    try:
        # Paso 1: extracción con IA (OCR + Claude)
        datos = await extract_invoice_data(pdf_bytes, filename)

        if "error" in datos:
            _actualizar_estado(factura_id, "error", str(datos["error"]))
            return

        # Paso 2: persistir cabecera de la factura
        _guardar_resultados(factura_id, datos)

        # Paso 3: distribución contable (si existe plantilla para el proveedor)
        proveedor_ruc = datos.get("proveedor_ruc")
        subtotal = datos.get("subtotal")
        numero = datos.get("numero_documento") or datos.get("numero_factura") or filename

        if proveedor_ruc and subtotal:
            plantilla = obtener_plantilla_por_proveedor(proveedor_ruc)
            if plantilla:
                distribuir_factura(
                    factura_id=factura_id,
                    subtotal=float(subtotal),
                    numero_documento=numero,
                    plantilla=plantilla,
                )
                logger.info(
                    f"[Background] Factura {factura_id}: distribución aplicada "
                    f"con plantilla '{plantilla['nombre']}'"
                )
            else:
                logger.warning(
                    f"[Background] Factura {factura_id}: sin plantilla para RUC {proveedor_ruc}. "
                    f"La factura se guarda pero no se distribuye."
                )

        logger.info(f"[Background] Factura id={factura_id} procesada OK")

    except Exception as e:
        logger.error(f"[Background] Error en factura id={factura_id}: {e}")
        _actualizar_estado(factura_id, "error", str(e))


def _actualizar_estado(factura_id: int, estado: str, mensaje_error: str = "") -> None:
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE facturas SET estado = %s, error_mensaje = %s WHERE id = %s",
                [estado, mensaje_error, factura_id],
            )


def _guardar_resultados(factura_id: int, datos: dict) -> None:
    """Persiste los datos extraídos en facturas e inserta los ítems."""
    items = datos.pop("items", [])

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE facturas SET
                    numero_factura       = %s,
                    fecha_emision        = %s,
                    proveedor_ruc        = %s,
                    proveedor_razon_social = %s,
                    cliente_ruc          = %s,
                    cliente_razon_social = %s,
                    moneda               = %s,
                    subtotal             = %s,
                    igv                  = %s,
                    total_declarado      = %s,
                    total_calculado      = %s,
                    total_discrepancia   = %s,
                    confianza_ia         = %s,
                    estado               = 'procesado',
                    raw_json             = %s
                WHERE id = %s
                """,
                [
                    datos.get("numero_factura"),
                    datos.get("fecha_emision"),
                    datos.get("proveedor_ruc"),
                    datos.get("proveedor_razon_social"),
                    datos.get("cliente_ruc"),
                    datos.get("cliente_razon_social"),
                    datos.get("moneda", "PEN"),
                    datos.get("subtotal"),
                    datos.get("igv"),
                    datos.get("total"),
                    datos.get("total_calculado"),
                    datos.get("total_discrepancia"),
                    datos.get("confianza"),
                    str(datos),
                    factura_id,
                ],
            )

            for i, item in enumerate(items, start=1):
                cur.execute(
                    """
                    INSERT INTO factura_items (
                        factura_id, numero_item, descripcion, cantidad,
                        unidad_medida, precio_unitario, precio_unitario_calculado,
                        subtotal_item
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    [
                        factura_id, i,
                        item.get("descripcion"),
                        item.get("cantidad"),
                        item.get("unidad_medida"),
                        item.get("precio_unitario"),
                        item.get("precio_unitario_calculado", False),
                        item.get("subtotal_item"),
                    ],
                )
