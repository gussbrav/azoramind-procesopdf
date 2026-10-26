"""
Router de autenticación.
- POST /auth/login — obtener token JWT
- POST /auth/register — crear usuario (solo admin)
- POST /auth/invite — invitar usuario por email (solo admin)
- POST /auth/accept-invite — aceptar invitación y crear cuenta
- GET /auth/invitations — listar invitaciones pendientes (solo admin)
- GET /auth/invite/{token} — verificar token de invitación (público)
- GET /auth/users — listar usuarios (solo admin)
- DELETE /auth/users/{user_id} — eliminar usuario (solo admin)
"""
import logging
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel

from app.audit import log_audit_event
from app.auth.jwt import create_access_token, require_admin
from app.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenData,
    TokenResponse,
    UserResponse,
)
from app.config import settings
from app.database import get_db
from app.security import limiter, validate_password_strength

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Autenticación"])

VALID_ROLES = {"admin", "abogado", "asistente"}

# Invitaciones expiran en 48 horas
INVITE_EXPIRY_HOURS = 48

# DDL para crear tabla de invitaciones si no existe
_CREATE_INVITATIONS_SQL = """
CREATE TABLE IF NOT EXISTS gestordocumentos.invitations (
    id          SERIAL PRIMARY KEY,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'abogado',
    token       TEXT NOT NULL UNIQUE,
    invited_by  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
"""


def _ensure_invitations_table(conn):
    with conn.cursor() as cur:
        cur.execute(_CREATE_INVITATIONS_SQL)
    conn.commit()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.login_rate_limit)
def login(request: Request, payload: LoginRequest):
    """
    Endpoint de login con rate limiting (5 intentos/minuto por IP por defecto).

    El parámetro `request` (FastAPI Request) es obligatorio para que slowapi
    pueda extraer la IP del cliente — no se usa directamente en la lógica.
    """
    if settings.demo_mode:
        if payload.username != "carlos" or payload.password != "demo123":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas. En modo demo usa carlos / demo123",
            )
        access_token = create_access_token(data={"sub": "carlos", "role": "admin"})
        return TokenResponse(access_token=access_token, role="admin")

    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, username, password_hash, role, nombre_completo "
                "FROM gestordocumentos.web_users WHERE username = %s",
                (payload.username,)
            )
            user = cur.fetchone()

    if not user or not verify_password(payload.password, user["password_hash"]):
        log_audit_event(
            event="login.failed",
            actor=payload.username,
            request=request,
            details={"reason": "invalid_credentials"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )

    role = user.get("role") or "abogado"
    access_token = create_access_token(data={"sub": user["username"], "role": role})
    log_audit_event(
        event="login.success",
        actor=user["username"],
        request=request,
        details={"role": role},
    )
    return TokenResponse(
        access_token=access_token,
        role=role,
        nombre_completo=user.get("nombre_completo"),
    )


# ---------------------------------------------------------------------------
# Register (admin creates user directly)
# ---------------------------------------------------------------------------

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, request: Request, admin: TokenData = Depends(require_admin)):
    """Crea un nuevo usuario. Solo admin puede registrar usuarios."""
    if data.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rol inválido. Debe ser: {', '.join(VALID_ROLES)}",
        )
    pw_error = validate_password_strength(data.password)
    if pw_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=pw_error,
        )
    if len(data.username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario debe tener al menos 3 caracteres",
        )

    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM gestordocumentos.web_users WHERE username = %s",
                (data.username,)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El usuario '{data.username}' ya existe",
                )
            cur.execute(
                "INSERT INTO gestordocumentos.web_users (username, password_hash, role, nombre_completo) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (data.username, password_hash, data.role, data.nombre_completo),
            )
            new_id = cur.fetchone()[0]
        conn.commit()

    log_audit_event(
        event="user.created",
        actor=admin.username,
        request=request,
        details={"target": data.username, "role": data.role},
    )
    return {
        "message": f"Usuario '{data.username}' creado con rol '{data.role}'",
        "id": new_id,
    }


# ---------------------------------------------------------------------------
# Invite (admin sends email invitation)
# ---------------------------------------------------------------------------

class InviteRequest(BaseModel):
    email: str
    role: str = "abogado"


class AcceptInviteRequest(BaseModel):
    token: str
    username: str
    password: str
    nombre_completo: str | None = None


@router.post("/invite", status_code=status.HTTP_201_CREATED)
def invite_user(data: InviteRequest, request: Request, admin: TokenData = Depends(require_admin)):
    """Envía invitación por email. Solo admin."""
    if data.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rol inválido. Debe ser: {', '.join(VALID_ROLES)}",
        )
    if "@" not in data.email or "." not in data.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email inválido",
        )

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(hours=INVITE_EXPIRY_HOURS)

    with get_db() as conn:
        _ensure_invitations_table(conn)
        with conn.cursor() as cur:
            # Verificar si ya hay invitación pendiente para este email
            cur.execute(
                "SELECT id FROM gestordocumentos.invitations "
                "WHERE email = %s AND accepted_at IS NULL AND expires_at > NOW()",
                (data.email,)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ya existe una invitación pendiente para {data.email}",
                )

            cur.execute(
                "INSERT INTO gestordocumentos.invitations (email, role, token, invited_by, expires_at) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (data.email, data.role, token, admin.username, expires_at),
            )
            invite_id = cur.fetchone()[0]
        conn.commit()

    # Construir URL de invitación
    # Usar Origin header o Referer para detectar el dominio del frontend
    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if origin:
        # Limpiar trailing path del referer
        origin = origin.split("//", 1)[-1].split("/")[0]
        origin = f"https://{origin}" if not origin.startswith("http") else f"https://{origin}"
    else:
        origin = "https://localhost:3000"

    invite_url = f"{origin}/invite?token={token}"

    # Enviar email
    from app.services.email_service import send_invitation_email
    email_sent = send_invitation_email(data.email, invite_url, data.role, admin.username)

    log_audit_event(
        event="invitation.created",
        actor=admin.username,
        request=request,
        details={"target": data.email, "role": data.role, "email_sent": email_sent},
    )
    return {
        "message": f"Invitación {'enviada' if email_sent else 'creada (email no enviado)'} a {data.email}",
        "id": invite_id,
        "email_sent": email_sent,
        "invite_email": data.email,
        "invite_url": invite_url if not email_sent else None,  # Solo mostrar URL si el email falló
    }


@router.get("/invite/{token}")
def verify_invite(token: str):
    """Verifica si un token de invitación es válido (público, sin auth)."""
    with get_db() as conn:
        _ensure_invitations_table(conn)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT email, role, expires_at, accepted_at "
                "FROM gestordocumentos.invitations WHERE token = %s",
                (token,)
            )
            inv = cur.fetchone()

    if not inv:
        raise HTTPException(status_code=404, detail="Invitación no encontrada")
    if inv["accepted_at"]:
        raise HTTPException(status_code=400, detail="Esta invitación ya fue utilizada")
    if inv["expires_at"].replace(tzinfo=UTC) < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Esta invitación ha expirado")

    return {
        "email": inv["email"],
        "role": inv["role"],
        "valid": True,
    }


@router.post("/accept-invite", status_code=status.HTTP_201_CREATED)
def accept_invite(data: AcceptInviteRequest):
    """Acepta invitación y crea la cuenta (público, sin auth)."""
    pw_error = validate_password_strength(data.password)
    if pw_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=pw_error,
        )
    if len(data.username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El usuario debe tener al menos 3 caracteres",
        )

    with get_db() as conn:
        _ensure_invitations_table(conn)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Validar token
            cur.execute(
                "SELECT id, email, role, expires_at, accepted_at "
                "FROM gestordocumentos.invitations WHERE token = %s",
                (data.token,)
            )
            inv = cur.fetchone()

            if not inv:
                raise HTTPException(status_code=404, detail="Invitación no encontrada")
            if inv["accepted_at"]:
                raise HTTPException(status_code=400, detail="Esta invitación ya fue utilizada")
            if inv["expires_at"].replace(tzinfo=UTC) < datetime.now(UTC):
                raise HTTPException(status_code=400, detail="Esta invitación ha expirado")

            # Verificar username no duplicado
            cur.execute(
                "SELECT id FROM gestordocumentos.web_users WHERE username = %s",
                (data.username,)
            )
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"El usuario '{data.username}' ya existe. Elige otro nombre.",
                )

            # Crear usuario
            password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
            cur.execute(
                "INSERT INTO gestordocumentos.web_users (username, password_hash, role, nombre_completo) "
                "VALUES (%s, %s, %s, %s) RETURNING id",
                (data.username, password_hash, inv["role"], data.nombre_completo),
            )
            cur.fetchone()

            # Marcar invitación como aceptada
            cur.execute(
                "UPDATE gestordocumentos.invitations SET accepted_at = NOW() WHERE id = %s",
                (inv["id"],)
            )
        conn.commit()

    logger.info(f"[Invite] Invitación aceptada: {inv['email']} → usuario '{data.username}' (rol: {inv['role']})")
    log_audit_event(
        event="invitation.accepted",
        actor=data.username,
        details={"email": inv["email"], "role": inv["role"]},
    )

    return {
        "message": f"Cuenta creada exitosamente. Ya puedes iniciar sesión como '{data.username}'.",
        "username": data.username,
        "role": inv["role"],
    }


@router.get("/invitations")
def list_invitations(admin: TokenData = Depends(require_admin)):
    """Lista invitaciones pendientes y recientes. Solo admin."""
    with get_db() as conn:
        _ensure_invitations_table(conn)
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, email, role, token, invited_by, "
                "created_at::text AS created_at, "
                "expires_at::text AS expires_at, "
                "accepted_at::text AS accepted_at "
                "FROM gestordocumentos.invitations "
                "ORDER BY created_at DESC LIMIT 50"
            )
            rows = cur.fetchall()
    return rows


@router.delete("/invitations/{invite_id}", status_code=status.HTTP_200_OK)
def cancel_invitation(invite_id: int, request: Request, admin: TokenData = Depends(require_admin)):
    """Cancela (elimina) una invitación pendiente. Solo admin."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT email, accepted_at FROM gestordocumentos.invitations WHERE id = %s",
                (invite_id,)
            )
            inv = cur.fetchone()
            if not inv:
                raise HTTPException(status_code=404, detail="Invitación no encontrada")
            if inv["accepted_at"]:
                raise HTTPException(status_code=400, detail="No se puede cancelar una invitación ya aceptada")
            cur.execute("DELETE FROM gestordocumentos.invitations WHERE id = %s", (invite_id,))
        conn.commit()

    log_audit_event(
        event="invitation.cancelled",
        actor=admin.username,
        request=request,
        details={"target": inv["email"], "invitation_id": invite_id},
    )
    return {"message": f"Invitación a {inv['email']} cancelada"}


# ---------------------------------------------------------------------------
# Users management (admin only)
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserResponse])
def list_users(admin: TokenData = Depends(require_admin)):
    """Lista todos los usuarios del sistema. Solo admin."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, username, role, nombre_completo, "
                "created_at::text AS created_at "
                "FROM gestordocumentos.web_users ORDER BY id"
            )
            rows = cur.fetchall()
    return rows


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK)
def delete_user(user_id: int, request: Request, admin: TokenData = Depends(require_admin)):
    """Elimina un usuario. No puede eliminarse a sí mismo."""
    with get_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT username FROM gestordocumentos.web_users WHERE id = %s",
                (user_id,)
            )
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            if user["username"] == admin.username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No puedes eliminar tu propio usuario",
                )
            cur.execute(
                "DELETE FROM gestordocumentos.web_users WHERE id = %s", (user_id,)
            )
        conn.commit()

    log_audit_event(
        event="user.deleted",
        actor=admin.username,
        request=request,
        details={"target": user["username"], "user_id": user_id},
    )
    return {"message": f"Usuario '{user['username']}' eliminado"}
