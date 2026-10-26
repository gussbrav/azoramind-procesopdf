"""
Router para configuración general del sistema (SMTP, branding, integraciones, etc.).
Persiste los ajustes en la tabla gestordocumentos.app_settings (key-value JSONB).
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.audit import list_recent_audit_events, log_audit_event
from app.auth.jwt import TokenData, get_current_user, require_admin
from app.config import settings
from app.security import validate_logo_dataurl

router = APIRouter(prefix="/api/settings", tags=["Settings"])

# Defaults de branding (cuando no hay nada en BD o estamos en modo demo)
BRANDING_DEFAULTS = {
    "nombre_empresa": "Sistema Jurídico",
    "subtitulo": "Estudio de Abogados",
    "logo_url": "",  # data URL base64 o URL externa; vacío = usar icono Scale
    "color_primario": "#2563eb",  # tailwind blue-600
}

# DDL para la tabla de configuración (se crea automáticamente si no existe)
_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS gestordocumentos.app_settings (
    key         TEXT PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
"""


def _ensure_table(conn):
    with conn.cursor() as cur:
        cur.execute(_CREATE_TABLE_SQL)
    conn.commit()


class SmtpConfig(BaseModel):
    from_address: str | None = ""
    smtp_server: str | None = ""
    from_domain: str | None = ""
    smtp_port: int | None = 587
    username: str | None = ""
    password: str | None = ""
    use_ssl: bool | None = False
    ignore_tls_errors: bool | None = False
    reject_unauthorized: bool | None = True


@router.get("/smtp")
def get_smtp_config(current_user: TokenData = Depends(get_current_user)):
    """Retorna la configuración SMTP actual."""
    if settings.demo_mode:
        return SmtpConfig().model_dump()

    from psycopg2.extras import RealDictCursor

    from app.database import get_db

    with get_db() as conn:
        _ensure_table(conn)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT value FROM gestordocumentos.app_settings WHERE key = 'smtp_config'"
            )
            row = cur.fetchone()
            if row:
                return row["value"]
    return SmtpConfig().model_dump()


@router.put("/smtp")
def save_smtp_config(
    config: SmtpConfig,
    request: Request,
    current_user: TokenData = Depends(get_current_user),
):
    """Guarda (upsert) la configuración SMTP."""
    if settings.demo_mode:
        return {"ok": True, "demo": True}

    import json

    from app.database import get_db

    with get_db() as conn:
        _ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO gestordocumentos.app_settings (key, value, updated_at)
                VALUES ('smtp_config', %s::jsonb, NOW())
                ON CONFLICT (key) DO UPDATE
                    SET value = EXCLUDED.value,
                        updated_at = NOW()
                """,
                (json.dumps(config.model_dump()),),
            )
        conn.commit()
    log_audit_event(
        event="settings.smtp.updated",
        actor=current_user.username,
        request=request,
        details={"smtp_server": config.smtp_server, "from_address": config.from_address},
    )
    return {"ok": True}


class SmtpTestRequest(BaseModel):
    to: str


@router.post("/smtp/test")
def test_smtp(
    data: SmtpTestRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Envía un email de prueba para verificar la configuración SMTP."""
    from app.services.email_service import send_email

    result = send_email(
        to=data.to,
        subject="Prueba SMTP — Sistema Juridico",
        html_body="""
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Prueba de correo</h2>
          <p>Si recibes este mensaje, la configuración SMTP está funcionando correctamente.</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
            Sistema Juridico — Desarrollado por Azoramind
          </p>
        </div>
        """,
    )
    if result["success"]:
        return {"ok": True, "message": f"Email de prueba enviado a {data.to}"}
    else:
        raise HTTPException(status_code=400, detail=f"Error SMTP: {result['error']}")


# ---------------------------------------------------------------------------
# Branding (logo, nombre de empresa, color) — personalizable por el cliente
# ---------------------------------------------------------------------------

# Tamaño máximo de logo en data URL base64 (~300KB de payload total)
MAX_LOGO_DATAURL_LEN = 400_000


class BrandingConfig(BaseModel):
    nombre_empresa: str | None = BRANDING_DEFAULTS["nombre_empresa"]
    subtitulo: str | None = BRANDING_DEFAULTS["subtitulo"]
    logo_url: str | None = BRANDING_DEFAULTS["logo_url"]
    color_primario: str | None = BRANDING_DEFAULTS["color_primario"]


def _load_branding_from_db() -> dict:
    """Carga branding desde app_settings, fusionando con defaults."""
    from psycopg2.extras import RealDictCursor

    from app.database import get_db

    with get_db() as conn:
        _ensure_table(conn)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT value FROM gestordocumentos.app_settings WHERE key = 'branding_config'"
            )
            row = cur.fetchone()
            if row and isinstance(row["value"], dict):
                return {**BRANDING_DEFAULTS, **row["value"]}
    return dict(BRANDING_DEFAULTS)


@router.get("/branding")
def get_branding():
    """
    Retorna la configuración de branding actual.

    **Endpoint público** — sin autenticación, para que la página de Login
    pueda mostrar el logo y nombre de la empresa antes de que el usuario
    inicie sesión.
    """
    if settings.demo_mode:
        return dict(BRANDING_DEFAULTS)
    try:
        return _load_branding_from_db()
    except Exception:
        # Si la BD falla, devolvemos defaults para no romper el login
        return dict(BRANDING_DEFAULTS)


@router.put("/branding")
def save_branding(
    config: BrandingConfig,
    request: Request,
    admin: TokenData = Depends(require_admin),
):
    """Guarda (upsert) la configuración de branding. Solo admin."""
    # Validación robusta del logo: tamaño + magic bytes + anti-XSS para SVG
    if config.logo_url:
        err = validate_logo_dataurl(config.logo_url)
        if err:
            raise HTTPException(status_code=400, detail=err)

    # Validar formato hex del color (acepta #rgb o #rrggbb)
    if config.color_primario:
        c = config.color_primario.strip()
        if not (c.startswith("#") and len(c) in (4, 7) and all(ch in "0123456789abcdefABCDEF" for ch in c[1:])):
            raise HTTPException(
                status_code=400,
                detail=f"Color primario inválido: '{c}'. Debe ser un código hex (#rrggbb).",
            )

    if settings.demo_mode:
        return {"ok": True, "demo": True, "branding": config.model_dump()}

    import json

    from app.database import get_db

    with get_db() as conn:
        _ensure_table(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO gestordocumentos.app_settings (key, value, updated_at)
                VALUES ('branding_config', %s::jsonb, NOW())
                ON CONFLICT (key) DO UPDATE
                    SET value = EXCLUDED.value,
                        updated_at = NOW()
                """,
                (json.dumps(config.model_dump()),),
            )
        conn.commit()

    log_audit_event(
        event="settings.branding.updated",
        actor=admin.username,
        request=request,
        details={
            "nombre_empresa": config.nombre_empresa,
            "color_primario": config.color_primario,
            "logo_changed": bool(config.logo_url),
        },
    )
    return {"ok": True, "branding": config.model_dump()}


# ---------------------------------------------------------------------------
# Audit log (admin only)
# ---------------------------------------------------------------------------

@router.get("/audit")
def get_audit_events(
    limit: int = 100,
    admin: TokenData = Depends(require_admin),
):
    """Lista los últimos eventos de auditoría. Solo admin."""
    return list_recent_audit_events(limit=limit)
