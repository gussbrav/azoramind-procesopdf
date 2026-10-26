"""
Audit log de acciones sensibles.

Persiste eventos de seguridad y administración en la tabla
`gestordocumentos.audit_events` para trazabilidad y forense.

Eventos típicos:
- login.success / login.failed
- user.created / user.deleted
- invitation.created / invitation.cancelled
- settings.smtp.updated
- settings.branding.updated
- password.changed

Uso:
    from app.audit import log_audit_event
    log_audit_event(
        event="user.created",
        actor="admin@estudio.com",
        request=request,
        details={"target": "nuevo_usuario", "role": "abogado"},
    )

El módulo es defensivo: si la BD falla, NO levanta excepción — solo loggea
con loguru. Auditar nunca debe romper la operación principal.
"""
from __future__ import annotations

import json
from typing import Any

from fastapi import Request
from loguru import logger

from app.config import settings

_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS gestordocumentos.audit_events (
    id          BIGSERIAL PRIMARY KEY,
    event       TEXT NOT NULL,
    actor       TEXT,
    ip          TEXT,
    user_agent  TEXT,
    details     JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_event ON gestordocumentos.audit_events(event);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON gestordocumentos.audit_events(actor);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON gestordocumentos.audit_events(created_at DESC);
"""


def _ensure_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(_CREATE_TABLE_SQL)
    conn.commit()


def _extract_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    # Honra X-Forwarded-For si viene de un proxy (Coolify/nginx)
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


def _extract_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    return request.headers.get("user-agent", "")[:500]  # truncar para no inflar la BD


def log_audit_event(
    event: str,
    actor: str | None = None,
    request: Request | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """
    Registra un evento de auditoría.

    Args:
        event: identificador del evento (ej: "user.created", "login.failed")
        actor: usuario que ejecuta la acción (None si es anónimo)
        request: el Request de FastAPI (para extraer IP y user agent)
        details: diccionario JSON-serializable con contexto adicional

    Esta función NUNCA levanta excepciones. Si la BD falla, loggea el evento
    a través de loguru para no perder la trazabilidad.
    """
    ip = _extract_ip(request)
    user_agent = _extract_user_agent(request)
    payload = details or {}

    # Siempre loggear vía loguru (queda en el sistema de logs estructurado)
    logger.bind(audit=True).info(
        "audit | event={event} actor={actor} ip={ip} details={details}",
        event=event,
        actor=actor or "-",
        ip=ip or "-",
        details=payload,
    )

    if settings.demo_mode:
        return  # en demo no persistimos en BD

    try:
        from app.database import get_db

        with get_db() as conn:
            _ensure_table(conn)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO gestordocumentos.audit_events
                        (event, actor, ip, user_agent, details)
                    VALUES (%s, %s, %s, %s, %s::jsonb)
                    """,
                    (event, actor, ip, user_agent, json.dumps(payload)),
                )
            conn.commit()
    except Exception as exc:
        # No romper la operación principal por un fallo de auditoría
        logger.warning(
            "audit | persistencia falló | event={event} err={err}",
            event=event,
            err=str(exc),
        )


def list_recent_audit_events(limit: int = 100) -> list[dict[str, Any]]:
    """
    Devuelve los últimos N eventos de auditoría (admin only).
    Retorna lista vacía en demo o si la BD falla.
    """
    if settings.demo_mode:
        return []
    try:
        from psycopg2.extras import RealDictCursor

        from app.database import get_db

        with get_db() as conn:
            _ensure_table(conn)
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id, event, actor, ip, user_agent, details,
                           created_at::text AS created_at
                    FROM gestordocumentos.audit_events
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (max(1, min(limit, 1000)),),
                )
                return cur.fetchall()
    except Exception as exc:
        logger.warning("audit | listado falló | err={err}", err=str(exc))
        return []
