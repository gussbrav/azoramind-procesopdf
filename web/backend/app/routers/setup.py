"""
Endpoint de setup inicial — solo funciona si no hay usuarios en la DB.
"""
import bcrypt
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from app.database import get_db

router = APIRouter(prefix="/api/setup", tags=["Setup"])


class SetupRequest(BaseModel):
    username: str
    password: str
    nombre_completo: str = ""


@router.get("/status")
def setup_status():
    """Retorna si el sistema ya fue configurado (hay al menos un usuario)."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users")
            count = cur.fetchone()[0]
    return {"needs_setup": count == 0}


@router.post("/create-admin", status_code=status.HTTP_201_CREATED)
def create_admin(data: SetupRequest):
    """Crea el primer usuario administrador. Solo funciona si no hay usuarios."""
    if len(data.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 6 caracteres",
        )

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users")
            count = cur.fetchone()[0]
            if count > 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="El sistema ya fue configurado. Usa el login normal.",
                )
            hashed_password = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
            cur.execute(
                "INSERT INTO users (username, hashed_password, role) "
                "VALUES (%s, %s, 'admin') RETURNING id",
                (data.username, hashed_password),
            )
            new_id = cur.fetchone()[0]

    return {
        "message": f"Administrador '{data.username}' creado. Ya puedes iniciar sesión.",
        "id": new_id,
    }
