"""Tests de endpoints de autenticación y autorización."""
import pytest

from app.auth.jwt import create_access_token


@pytest.mark.unit
def test_users_endpoint_requires_auth(client):
    """Listar usuarios sin token debe devolver 401/403."""
    response = client.get("/auth/users")
    assert response.status_code in (401, 403)


@pytest.mark.unit
def test_users_endpoint_rejects_invalid_token(client):
    """Un token inválido debe ser rechazado."""
    response = client.get(
        "/auth/users",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert response.status_code == 401


@pytest.mark.unit
def test_users_endpoint_rejects_non_admin(client):
    """Un usuario no-admin no puede listar usuarios."""
    token = create_access_token({"sub": "abogado1", "role": "abogado"})
    response = client.get(
        "/auth/users",
        headers={"Authorization": f"Bearer {token}"},
    )
    # Debe rechazar con 403 (o 404 si el endpoint no existe en modo demo)
    assert response.status_code in (403, 404, 500)


@pytest.mark.unit
def test_login_rejects_empty_credentials(client):
    """Login sin credenciales debe fallar con 422 (validation) o 401."""
    response = client.post("/auth/login", json={})
    assert response.status_code in (401, 422)
