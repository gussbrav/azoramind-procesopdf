"""Tests del endpoint /api/health."""
import pytest


@pytest.mark.unit
def test_health_returns_200(client):
    response = client.get("/api/health")
    assert response.status_code == 200


@pytest.mark.unit
def test_health_returns_ok_status(client):
    response = client.get("/api/health")
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.unit
def test_health_demo_mode_flag(client):
    """En modo demo (test), el flag debe estar presente."""
    response = client.get("/api/health")
    data = response.json()
    assert "db" in data
