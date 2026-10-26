"""
Esquemas Pydantic para autenticación.
"""
from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    """Datos recibidos en el endpoint de login."""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Respuesta del endpoint de login con el token JWT."""
    access_token: str
    token_type: str = "bearer"
    role: str = "abogado"
    nombre_completo: Optional[str] = None


class TokenData(BaseModel):
    """Datos decodificados del payload del token JWT."""
    username: Optional[str] = None
    role: str = "abogado"


class RegisterRequest(BaseModel):
    """Datos para registrar un nuevo usuario (solo admin)."""
    username: str
    password: str
    role: str = "abogado"  # admin | abogado | asistente
    nombre_completo: Optional[str] = None


class UserResponse(BaseModel):
    """Datos de un usuario para listar."""
    id: int
    username: str
    role: str
    nombre_completo: Optional[str] = None
    created_at: Optional[str] = None
