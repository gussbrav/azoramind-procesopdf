"""
Verifica que el SecurityHeadersMiddleware inyecta los headers esperados
en todas las respuestas.
"""


def test_security_headers_present(client):
    # Cualquier endpoint sirve — el middleware corre en todas las respuestas
    r = client.get("/api/settings/branding")
    assert r.status_code == 200
    h = r.headers
    assert h.get("x-frame-options") == "DENY"
    assert h.get("x-content-type-options") == "nosniff"
    assert "strict-origin" in h.get("referrer-policy", "")
    assert "geolocation=()" in h.get("permissions-policy", "")
    assert "default-src 'self'" in h.get("content-security-policy", "")
    assert "frame-ancestors 'none'" in h.get("content-security-policy", "")
