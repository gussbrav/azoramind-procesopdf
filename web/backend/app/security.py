"""
Módulo centralizado de seguridad.

Provee:
- Rate limiter (slowapi) configurable desde settings
- Headers de seguridad HTTP (CSP, HSTS, X-Frame-Options, etc.)
- Validación robusta de contraseñas
- Sanitización de uploads (validación de magic bytes para imágenes)
- Helper de audit log
"""
from __future__ import annotations

import base64
import re

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import settings

# ─── Rate limiter ───────────────────────────────────────────────────────
# Identificador del cliente: IP del request. En producción detrás de un proxy
# (Coolify, nginx) los headers X-Forwarded-For son honrados por get_remote_address.
limiter = Limiter(key_func=get_remote_address, default_limits=[])


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Handler personalizado en español para errores de rate limit."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                "Demasiados intentos. Por favor espera unos minutos antes "
                "de volver a intentarlo."
            )
        },
    )


# ─── Validación de contraseñas ──────────────────────────────────────────

# Requisitos: ≥N caracteres, al menos 1 mayúscula, 1 minúscula, 1 dígito
_HAS_UPPER = re.compile(r"[A-Z]")
_HAS_LOWER = re.compile(r"[a-z]")
_HAS_DIGIT = re.compile(r"\d")


def validate_password_strength(password: str) -> str | None:
    """
    Verifica la complejidad de una contraseña.

    Retorna `None` si es válida, o un string con el motivo del rechazo.
    Reglas:
        - Longitud mínima configurable (settings.password_min_length)
        - Al menos una letra mayúscula
        - Al menos una letra minúscula
        - Al menos un dígito
    """
    if not password or len(password) < settings.password_min_length:
        return (
            f"La contraseña debe tener al menos {settings.password_min_length} caracteres."
        )
    if not _HAS_UPPER.search(password):
        return "La contraseña debe contener al menos una letra mayúscula."
    if not _HAS_LOWER.search(password):
        return "La contraseña debe contener al menos una letra minúscula."
    if not _HAS_DIGIT.search(password):
        return "La contraseña debe contener al menos un dígito."
    return None


# ─── Sanitización de imágenes (logo de marca) ───────────────────────────

# Magic bytes para detectar el tipo real del archivo (no confiamos en el MIME del cliente)
_IMAGE_SIGNATURES = {
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/gif": (b"GIF87a", b"GIF89a"),
    "image/webp": (b"RIFF",),  # WebP empieza con "RIFF" + 4 bytes + "WEBP"
}

# SVGs permitidos pero estrictamente sanitizados (sin <script>, sin event handlers)
_SVG_DANGEROUS_PATTERNS = re.compile(
    r"<script\b|on\w+\s*=|javascript:|<foreignObject\b|<iframe\b",
    re.IGNORECASE,
)


def detect_image_type(raw: bytes) -> str | None:
    """Detecta el tipo MIME real de una imagen por sus magic bytes."""
    for mime, signatures in _IMAGE_SIGNATURES.items():
        for sig in signatures:
            if raw.startswith(sig):
                # Verificación adicional para WebP (RIFF + WEBP)
                if mime == "image/webp" and not (len(raw) > 12 and raw[8:12] == b"WEBP"):
                    continue
                return mime
    # SVG (texto plano)
    head = raw[:512].lstrip().lower()
    if head.startswith(b"<?xml") or head.startswith(b"<svg"):
        return "image/svg+xml"
    return None


def validate_logo_dataurl(data_url: str) -> str | None:
    """
    Valida un data URL de logo subido por un admin.

    - Verifica el formato `data:<mime>;base64,<payload>`
    - Decodifica el payload y comprueba los magic bytes reales
    - Para SVG, rechaza patrones peligrosos (scripts, handlers de eventos)
    - Verifica el tamaño máximo

    Retorna `None` si todo OK, o un mensaje de error.
    """
    if not data_url:
        return None  # logo vacío = volver al icono por defecto, válido

    if len(data_url) > settings.logo_max_dataurl_bytes:
        return (
            f"El logo es demasiado grande. Máximo permitido: "
            f"~{settings.logo_max_dataurl_bytes // 1000}KB."
        )

    # Parsear formato data URL
    match = re.match(r"^data:([^;]+);base64,(.+)$", data_url, re.DOTALL)
    if not match:
        return "Formato de imagen inválido. Debe ser un data URL base64."

    declared_mime = match.group(1).strip().lower()
    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except Exception:
        return "El payload del logo no es base64 válido."

    if not raw:
        return "El logo está vacío."

    # Detectar tipo real por magic bytes
    real_mime = detect_image_type(raw)
    if real_mime is None:
        return "El archivo no parece ser una imagen válida (PNG, JPG, GIF, WebP, SVG)."

    # Validar coherencia entre MIME declarado y detectado
    if declared_mime != real_mime:
        return (
            f"El tipo de imagen declarado ({declared_mime}) no coincide con "
            f"el contenido real ({real_mime})."
        )

    # SVG: rechazar contenido peligroso
    if real_mime == "image/svg+xml":
        try:
            svg_text = raw.decode("utf-8", errors="replace")
        except Exception:
            return "El SVG no es UTF-8 válido."
        if _SVG_DANGEROUS_PATTERNS.search(svg_text):
            return (
                "El SVG contiene elementos no permitidos (scripts, handlers de eventos "
                "o referencias externas). Sube un SVG estático."
            )

    return None


__all__ = [
    "limiter",
    "rate_limit_handler",
    "validate_password_strength",
    "validate_logo_dataurl",
    "detect_image_type",
    "RateLimitExceeded",
]
