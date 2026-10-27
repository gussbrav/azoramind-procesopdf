"""
Router para gestión de plantillas de distribución contable.

Permite crear/ver/editar las plantillas que definen cómo se distribuye
el subtotal de cada factura entre cuentas, centros de costo y proyectos.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.jwt import TokenData, get_current_user
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/plantillas", tags=["Plantillas"])


class FilaIn(BaseModel):
    orden: int
    placa: str = "-"
    sede_planta: str = "001"
    cuenta: str
    centro_costos: str
    linea_negocio_servicio: str = "000000"
    proyecto: str
    descripcion: str
    etl_terceros: str = "-"
    costo_unitario_referencia: float  # Fase 1: monto fijo
    porcentaje: Optional[float] = None  # Fase 2: se calcula o se provee


class PlantillaIn(BaseModel):
    nombre: str
    proveedor_ruc: Optional[str] = None
    descripcion: Optional[str] = None
    usar_porcentaje: bool = False
    subtotal_referencia: Optional[float] = None
    filas: list[FilaIn]


@router.get("")
def list_plantillas(current_user: TokenData = Depends(get_current_user)):
    """Lista todas las plantillas con su cantidad de filas."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.*, COUNT(f.id) AS total_filas,
                       SUM(f.porcentaje) AS suma_porcentajes
                FROM plantillas p
                LEFT JOIN plantilla_filas f ON f.plantilla_id = p.id
                GROUP BY p.id
                ORDER BY p.nombre
            """)
            return [dict(r) for r in cur.fetchall()]


@router.get("/{plantilla_id}")
def get_plantilla(plantilla_id: int, current_user: TokenData = Depends(get_current_user)):
    """Retorna una plantilla con todas sus filas."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM plantillas WHERE id = %s", [plantilla_id])
            p = cur.fetchone()
            if not p:
                raise HTTPException(status_code=404, detail="Plantilla no encontrada")
            cur.execute(
                "SELECT * FROM plantilla_filas WHERE plantilla_id = %s ORDER BY orden",
                [plantilla_id],
            )
            filas = cur.fetchall()

    return {**dict(p), "filas": [dict(f) for f in filas]}


@router.post("", status_code=201)
def create_plantilla(body: PlantillaIn, current_user: TokenData = Depends(get_current_user)):
    """
    Crea una nueva plantilla con sus filas de distribución.

    Fase 1 (usar_porcentaje=False): cada fila provee costo_unitario_referencia.
    Fase 2 (usar_porcentaje=True): cada fila debe incluir porcentaje;
      la suma de porcentajes debe ser 1.0 ± 0.001.
    """
    if body.usar_porcentaje:
        suma = sum(f.porcentaje or 0.0 for f in body.filas)
        if abs(suma - 1.0) > 0.001:
            raise HTTPException(
                status_code=422,
                detail=f"La suma de porcentajes es {suma:.6f} (esperado 1.0 = 100%). "
                       f"Diferencia: {abs(suma - 1.0):.6f}",
            )

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO plantillas (nombre, proveedor_ruc, descripcion, usar_porcentaje, subtotal_referencia)
                VALUES (%s,%s,%s,%s,%s) RETURNING id
                """,
                [body.nombre, body.proveedor_ruc, body.descripcion,
                 body.usar_porcentaje, body.subtotal_referencia],
            )
            plantilla_id = cur.fetchone()["id"]

            for fila in body.filas:
                cur.execute(
                    """
                    INSERT INTO plantilla_filas (
                        plantilla_id, orden, placa, sede_planta, cuenta,
                        centro_costos, linea_negocio_servicio, proyecto,
                        descripcion, etl_terceros,
                        costo_unitario_referencia, porcentaje
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    [
                        plantilla_id, fila.orden, fila.placa, fila.sede_planta,
                        fila.cuenta, fila.centro_costos, fila.linea_negocio_servicio,
                        fila.proyecto, fila.descripcion, fila.etl_terceros,
                        fila.costo_unitario_referencia, fila.porcentaje,
                    ],
                )

    logger.info(f"[Plantillas] Creada plantilla id={plantilla_id} '{body.nombre}' con {len(body.filas)} filas")
    return {"plantilla_id": plantilla_id, "mensaje": f"Plantilla '{body.nombre}' creada con {len(body.filas)} filas"}


@router.delete("/{plantilla_id}", status_code=204)
def delete_plantilla(plantilla_id: int, current_user: TokenData = Depends(get_current_user)):
    """Desactiva una plantilla (no la elimina físicamente)."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE plantillas SET activa = FALSE WHERE id = %s RETURNING id",
                [plantilla_id],
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Plantilla no encontrada")
