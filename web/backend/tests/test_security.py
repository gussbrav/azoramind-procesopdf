"""
Tests del módulo app.security: validación de password y de logos.
"""
import base64

from app.security import (
    detect_image_type,
    validate_logo_dataurl,
    validate_password_strength,
)

# ─── validate_password_strength ─────────────────────────────────────────


def test_password_too_short():
    err = validate_password_strength("Ab1")
    assert err is not None
    assert "12" in err


def test_password_no_upper():
    err = validate_password_strength("abcdefghij12")
    assert err is not None
    assert "mayúscula" in err


def test_password_no_lower():
    err = validate_password_strength("ABCDEFGHIJ12")
    assert err is not None
    assert "minúscula" in err


def test_password_no_digit():
    err = validate_password_strength("AbcdefghijKL")
    assert err is not None
    assert "dígito" in err


def test_password_valid():
    assert validate_password_strength("MiPasswordSeg1") is None


# ─── detect_image_type ──────────────────────────────────────────────────


def test_detect_png():
    png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 10
    assert detect_image_type(png_header) == "image/png"


def test_detect_jpeg():
    assert detect_image_type(b"\xff\xd8\xff\xe0" + b"\x00" * 10) == "image/jpeg"


def test_detect_svg():
    assert detect_image_type(b"<svg xmlns='http://www.w3.org/2000/svg'/>") == "image/svg+xml"


def test_detect_unknown():
    assert detect_image_type(b"NOT AN IMAGE AT ALL") is None


# ─── validate_logo_dataurl ──────────────────────────────────────────────


def _png_data_url() -> str:
    raw = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
    return f"data:image/png;base64,{base64.b64encode(raw).decode()}"


def test_logo_empty_is_valid():
    # Vacío significa "volver al icono por defecto"
    assert validate_logo_dataurl("") is None
    assert validate_logo_dataurl(None) is None  # type: ignore[arg-type]


def test_logo_valid_png():
    assert validate_logo_dataurl(_png_data_url()) is None


def test_logo_invalid_format():
    err = validate_logo_dataurl("not a data url")
    assert err is not None
    assert "data URL" in err


def test_logo_mime_mismatch():
    raw = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
    bad = f"data:image/jpeg;base64,{base64.b64encode(raw).decode()}"
    err = validate_logo_dataurl(bad)
    assert err is not None
    assert "no coincide" in err


def test_logo_svg_with_script_rejected():
    svg = b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
    url = f"data:image/svg+xml;base64,{base64.b64encode(svg).decode()}"
    err = validate_logo_dataurl(url)
    assert err is not None
    assert "no permitidos" in err


def test_logo_svg_with_onclick_rejected():
    svg = b"<svg onclick='evil()' xmlns='http://www.w3.org/2000/svg'/>"
    url = f"data:image/svg+xml;base64,{base64.b64encode(svg).decode()}"
    err = validate_logo_dataurl(url)
    assert err is not None


def test_logo_svg_clean_accepted():
    svg = b"<svg xmlns='http://www.w3.org/2000/svg'><circle r='10'/></svg>"
    url = f"data:image/svg+xml;base64,{base64.b64encode(svg).decode()}"
    assert validate_logo_dataurl(url) is None


def test_logo_too_large():
    huge = b"\x89PNG\r\n\x1a\n" + b"\x00" * 600_000
    url = f"data:image/png;base64,{base64.b64encode(huge).decode()}"
    err = validate_logo_dataurl(url)
    assert err is not None
    assert "grande" in err
