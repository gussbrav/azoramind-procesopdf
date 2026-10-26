"""
Servicio de OCR para extracción de texto de PDFs (facturas escaneadas).

Estrategia: Azoramind OCR API (Tesseract) como método único.
"""
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


async def extract_text_ocr(pdf_bytes: bytes, filename: str) -> str:
    """Llama a la API de OCR con el PDF en formato multipart y retorna el texto."""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                settings.ocr_api_url,
                files={"file": (filename, pdf_bytes, "application/pdf")},
                data={"language": "spa", "format": "json"},
            )
            response.raise_for_status()
            data = response.json()

            if isinstance(data, dict):
                text = data.get("text") or data.get("content") or ""
                if not text and "pages" in data:
                    text = "\n".join(
                        p.get("text", "") for p in data["pages"] if p.get("text")
                    )
                return text.strip()

            return ""

    except Exception as e:
        logger.error(f"[OCR API] Error: {e}")
        return ""


async def extract_text_from_pdf(pdf_bytes: bytes, filename: str) -> str:
    """
    Pipeline de extracción de texto desde PDF.
    Retorna texto extraído (cadena vacía si falla).
    """
    logger.info(f"[OCR Pipeline] Procesando '{filename}' ({len(pdf_bytes)} bytes)")

    text = await extract_text_ocr(pdf_bytes, filename)

    if text:
        logger.info(f"[OCR Pipeline] OK — {len(text)} chars para '{filename}'")
    else:
        logger.error(f"[OCR Pipeline] Falló para '{filename}'")

    return text
