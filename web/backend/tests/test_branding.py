"""
Tests del endpoint público GET /api/settings/branding.
En modo demo siempre debe devolver los defaults sin requerir auth.
"""


def test_branding_public_returns_defaults(client):
    r = client.get("/api/settings/branding")
    assert r.status_code == 200
    data = r.json()
    assert "nombre_empresa" in data
    assert "color_primario" in data
    assert data["color_primario"].startswith("#")
