"""
Servicio de extracción de datos de facturas usando IA (Claude API).

Pipeline:
  PDF bytes → OCR (si escaneado) → Claude API → JSON estructurado con campos de factura
"""
import json
import logging
from typing import Optional

import anthropic
from app.config import settings
from app.services.ocr_service import extract_text_from_pdf

logger = logging.getLogger(__name__)

# Cargado en runtime para evitar import costoso al arrancar
_anthropic_client: Optional[anthropic.AsyncAnthropic] = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client


async def extract_invoice_data(pdf_bytes: bytes, filename: str) -> dict:
    """
    Extrae los campos estructurados de una factura en PDF.

    Retorna un dict con la estructura definida en prompts/extraccion_facturas/prompt_extraccion.md
    o un dict vacío con error si falla.
    """
    # Paso 1: extraer texto del PDF
    texto = await extract_text_from_pdf(pdf_bytes, filename)
    if not texto:
        logger.error(f"[PDFExtractor] Sin texto extraído de '{filename}'")
        return {"error": "No se pudo extraer texto del PDF", "filename": filename}

    logger.info(f"[PDFExtractor] Texto extraído: {len(texto)} chars. Llamando a Claude...")

    # Paso 2: llamar a Claude para extracción estructurada
    try:
        with open("prompts/extraccion_facturas/prompt_extraccion.md", "r", encoding="utf-8") as f:
            system_prompt = f.read()
    except FileNotFoundError:
        system_prompt = _FALLBACK_SYSTEM_PROMPT

    client = _get_client()

    try:
        message = await client.messages.create(
            model=settings.claude_model,
            max_tokens=2048,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": f"Extrae los datos de la siguiente factura:\n\n{texto}",
                }
            ],
        )

        raw_response = message.content[0].text.strip()

        # Parsear JSON de la respuesta
        if raw_response.startswith("```"):
            raw_response = raw_response.split("```")[1]
            if raw_response.startswith("json"):
                raw_response = raw_response[4:]

        data = json.loads(raw_response)
        data["_raw_ocr_chars"] = len(texto)
        data["filename"] = filename
        logger.info(f"[PDFExtractor] Extracción exitosa para '{filename}'")
        return data

    except json.JSONDecodeError as e:
        logger.error(f"[PDFExtractor] JSON inválido de Claude: {e}")
        return {"error": "Respuesta IA no parseable", "filename": filename}
    except Exception as e:
        logger.error(f"[PDFExtractor] Error llamando Claude: {e}")
        return {"error": str(e), "filename": filename}


# Prompt de emergencia si no se encuentra el archivo
_FALLBACK_SYSTEM_PROMPT = """
Eres un extractor experto de datos de facturas comerciales.
Extrae ÚNICAMENTE en formato JSON válido, sin texto adicional, los siguientes campos:
{
  "numero_factura": "",
  "fecha_emision": "",
  "proveedor_ruc": "",
  "proveedor_razon_social": "",
  "cliente_ruc": "",
  "cliente_razon_social": "",
  "moneda": "PEN",
  "subtotal": 0.0,
  "igv": 0.0,
  "total": 0.0,
  "items": [
    {
      "descripcion": "",
      "cantidad": 0,
      "unidad_medida": "",
      "precio_unitario": 0.0,
      "subtotal_item": 0.0
    }
  ],
  "confianza": 0.0
}
Si un campo no existe en el documento, usa null.
"""
