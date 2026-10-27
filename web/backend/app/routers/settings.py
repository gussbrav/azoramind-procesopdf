"""
Router para configuración de branding del sistema.
Persiste los ajustes en la tabla app_settings (key-value TEXT).
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.audit import list_recent_audit_events, log_audit_event
from app.auth.jwt import TokenData, require_admin
from app.config import settings
from app.database import get_db
from app.security import validate_logo_dataurl

router = APIRouter(prefix="/api/settings", tags=["Settings"])

BRANDING_DEFAULTS = {
    "nombre_empresa": "Transaltisa",
    "subtitulo": "Procesamiento de Facturas",
    "logo_url": "",
    "color_primario": "#2563eb",
}


class BrandingConfig(BaseModel):
    nombre_empresa: str | None = BRANDING_DEFAULTS["nombre_empresa"]
    subtitulo: str | None = BRANDING_DEFAULTS["subtitulo"]
    logo_url: str | None = BRANDING_DEFAULTS["logo_url"]
    color_primario: str | None = BRANDING_DEFAULTS["color_primario"]


def _load_branding() -> dict:
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT key, value FROM app_settings WHERE key IN ('nombre_empresa','subtitulo','logo_url','color_primario')")
                rows = cur.fetchall()
                if rows:
                    loaded = {r["key"]: r["value"] for r in rows}
                    return {**BRANDING_DEFAULTS, **loaded}
    except Exception:
        pass
    return dict(BRANDING_DEFAULTS)


@router.get("/branding")
def get_branding():
    """Endpoint público — devuelve branding para el Login sin autenticación."""
    if settings.demo_mode:
        return dict(BRANDING_DEFAULTS)
    return _load_branding()


@router.put("/branding")
def save_branding(
    config: BrandingConfig,
    request: Request,
    admin: TokenData = Depends(require_admin),
):
    """Guarda la configuración de branding. Solo admin."""
    if config.logo_url:
        err = validate_logo_dataurl(config.logo_url)
        if err:
            raise HTTPException(status_code=400, detail=err)

    if config.color_primario:
        c = config.color_primario.strip()
        if not (c.startswith("#") and len(c) in (4, 7) and all(ch in "0123456789abcdefABCDEF" for ch in c[1:])):
            raise HTTPException(status_code=400, detail=f"Color hex inválido: '{c}'")

    if settings.demo_mode:
        return {"ok": True, "demo": True, "branding": config.model_dump()}

    data = config.model_dump()
    with get_db() as conn:
        with conn.cursor() as cur:
            for key, value in data.items():
                cur.execute(
                    "INSERT INTO app_settings (key, value) VALUES (%s, %s) "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                    (key, value or ""),
                )

    log_audit_event(
        event="settings.branding.updated",
        actor=admin.username,
        request=request,
        details={"nombre_empresa": config.nombre_empresa, "color_primario": config.color_primario},
    )
    return {"ok": True, "branding": data}


@router.get("/audit")
def get_audit_events(
    limit: int = 100,
    admin: TokenData = Depends(require_admin),
):
    """Lista los últimos eventos de auditoría. Solo admin."""
    return list_recent_audit_events(limit=limit)
