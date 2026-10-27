"""
Esquemas Pydantic para autenticación.
"""
from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "operador"
    nombre_completo: Optional[str] = None


class TokenData(BaseModel):
    username: Optional[str] = None
    role: str = "operador"


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "operador"  # admin | operador
    nombre_completo: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: Optional[str] = None
