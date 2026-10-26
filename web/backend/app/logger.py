"""
Configuración de logging estructurado con loguru.

Reemplaza el logging estándar con un sistema más robusto:
- Salida JSON en producción para facilitar parsing (Grafana, Loki, etc.)
- Salida human-friendly con colores en desarrollo
- Rotación automática de archivos de log
- Interceptor para redirigir logs de stdlib (FastAPI, uvicorn) a loguru
"""
import logging
import sys
from pathlib import Path

from loguru import logger

from app.config import settings


class InterceptHandler(logging.Handler):
    """Redirige logs de la stdlib (FastAPI, uvicorn, httpx) hacia loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        # Busca el frame del caller original para que el log muestre el origen real
        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging() -> None:
    """
    Configura loguru como único sistema de logging.

    En producción (DEMO_MODE=false) usa formato JSON estructurado para que
    sea parseable por agregadores. En desarrollo usa formato legible con colores.
    """
    # Remover el handler por defecto de loguru
    logger.remove()

    # Formato según entorno
    if settings.demo_mode:
        # Desarrollo/demo: formato legible con colores
        log_format = (
            "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
            "<level>{message}</level>"
        )
        logger.add(
            sys.stdout,
            format=log_format,
            level="INFO",
            colorize=True,
            backtrace=True,
            diagnose=True,
        )
    else:
        # Producción: JSON estructurado para parsing
        logger.add(
            sys.stdout,
            serialize=True,  # Output JSON
            level="INFO",
            backtrace=True,
            diagnose=False,  # No incluir valores de variables en prod (seguridad)
        )

        # Archivo con rotación (solo en producción)
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        logger.add(
            log_dir / "app_{time:YYYY-MM-DD}.log",
            rotation="00:00",  # rotar cada medianoche
            retention="30 days",  # conservar 30 días
            compression="zip",
            serialize=True,
            level="INFO",
        )

    # Interceptar logs de stdlib para que todo pase por loguru
    logging.basicConfig(handlers=[InterceptHandler()], level=0, force=True)
    for logger_name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi"):
        logging.getLogger(logger_name).handlers = [InterceptHandler()]
        logging.getLogger(logger_name).propagate = False

    logger.info(
        "Logging configurado | demo_mode={demo} | format={fmt}",
        demo=settings.demo_mode,
        fmt="readable" if settings.demo_mode else "json",
    )
