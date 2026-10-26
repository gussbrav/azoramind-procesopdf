"""Tests de utilidades JWT — creación, verificación, expiración."""
import pytest
from fastapi import HTTPException
from jose import jwt as jose_jwt

from app.auth.jwt import create_access_token, verify_token
from app.auth.schemas import TokenData
from app.config import settings


@pytest.mark.unit
def test_create_access_token_returns_string():
    token = create_access_token({"sub": "carlos", "role": "admin"})
    assert isinstance(token, str)
    assert len(token) > 20


@pytest.mark.unit
def test_create_access_token_encodes_username_and_role():
    token = create_access_token({"sub": "carlos", "role": "admin"})
    payload = jose_jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    assert payload["sub"] == "carlos"
    assert payload["role"] == "admin"
    assert "exp" in payload


@pytest.mark.unit
def test_verify_token_returns_token_data():
    token = create_access_token({"sub": "gustavo", "role": "abogado"})
    result = verify_token(token)
    assert isinstance(result, TokenData)
    assert result.username == "gustavo"
    assert result.role == "abogado"


@pytest.mark.unit
def test_verify_token_defaults_role_to_abogado():
    """Si el token no incluye role, se asume 'abogado'."""
    token = create_access_token({"sub": "alguien"})
    result = verify_token(token)
    assert result.role == "abogado"


@pytest.mark.unit
def test_verify_invalid_token_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        verify_token("este.token.es.invalido")
    assert exc_info.value.status_code == 401


@pytest.mark.unit
def test_verify_tampered_token_raises_401():
    """Un token con firma modificada debe ser rechazado."""
    token = create_access_token({"sub": "carlos", "role": "admin"})
    tampered = token[:-5] + "AAAAA"
    with pytest.raises(HTTPException) as exc_info:
        verify_token(tampered)
    assert exc_info.value.status_code == 401


@pytest.mark.unit
def test_verify_token_without_sub_raises_401():
    """Un token sin 'sub' (username) debe ser rechazado."""
    token = jose_jwt.encode(
        {"role": "admin", "exp": 9999999999},
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    with pytest.raises(HTTPException) as exc_info:
        verify_token(token)
    assert exc_info.value.status_code == 401
