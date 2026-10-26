"""
Utilidades para crear y validar tokens JWT.
Usa python-jose para la codificación/decodificación.
"""
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.auth.schemas import TokenData


# Esquema de seguridad Bearer Token para los endpoints protegidos
bearer_scheme = HTTPBearer()


def create_access_token(data: dict) -> str:
    """
    Crea un token JWT con los datos proporcionados.
    Agrega la fecha de expiración según la configuración.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.access_token_expire_hours
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def verify_token(token: str) -> TokenData:
    """
    Verifica y decodifica un token JWT.
    Lanza HTTPException 401 si el token es inválido o expirado.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        username: str | None = payload.get("sub")
        role: str = payload.get("role", "abogado")
        if username is None:
            raise credentials_exception
        return TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenData:
    """
    Dependencia FastAPI que extrae y valida el usuario del token Bearer.
    Se usa como dependencia en endpoints protegidos.
    """
    return verify_token(credentials.credentials)


def require_admin(current_user: TokenData = Depends(get_current_user)) -> TokenData:
    """
    Dependencia que verifica que el usuario sea admin.
    Usar en endpoints que solo admin puede acceder.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador para esta acción",
        )
    return current_user
