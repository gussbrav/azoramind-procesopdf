"""
Punto de entrada principal — Sistema de Procesamiento de Facturas Transaltisa.
"""
import os
from contextlib import asynccontextmanager

from app.logger import setup_logging

setup_logging()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from app.auth.router import router as auth_router
from app.config import settings
from app.database import close_db_pool, init_db_pool
from app.routers.facturas import router as facturas_router
from app.routers.health import router as health_router
from app.routers.reportes import router as reportes_router
from app.routers.settings import router as settings_router
from app.routers.setup import router as setup_router
from app.security import RateLimitExceeded, limiter, rate_limit_handler


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=(), payment=(), usb=()",
        )
        response.headers.setdefault(
            "Content-Security-Policy",
            (
                "default-src 'self'; "
                "img-src 'self' data: blob:; "
                "style-src 'self' 'unsafe-inline'; "
                "script-src 'self'; "
                "font-src 'self' data:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            ),
        )
        if settings.enable_hsts and not settings.demo_mode:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response


FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "static_frontend")
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not settings.demo_mode:
        try:
            init_db_pool()
            logger.info("Pool de conexiones a PostgreSQL inicializado")
        except Exception as e:
            logger.warning("No se pudo conectar a la base de datos: {err}", err=str(e))
    else:
        logger.info("DEMO_MODE=true — sin base de datos real")
    yield
    if not settings.demo_mode:
        close_db_pool()
        logger.info("Pool de conexiones cerrado")


app = FastAPI(
    title="Transaltisa — Procesamiento de Facturas",
    description="API para extracción de datos de facturas PDF y generación de reportes Excel",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(auth_router)
app.include_router(facturas_router)
app.include_router(reportes_router)
app.include_router(setup_router)
app.include_router(settings_router)

if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    _ROOT_STATIC = ["favicon.svg", "favicon.ico", "icons.svg", "robots.txt"]

    @app.get("/favicon.svg", include_in_schema=False)
    @app.get("/favicon.ico", include_in_schema=False)
    @app.get("/icons.svg", include_in_schema=False)
    def serve_root_static(request: Request):
        filename = request.url.path.lstrip("/")
        if filename in _ROOT_STATIC:
            fp = os.path.join(FRONTEND_DIR, filename)
            if os.path.isfile(fp):
                mt = "image/svg+xml" if filename.endswith(".svg") else None
                return FileResponse(fp, media_type=mt)
        from fastapi import HTTPException
        raise HTTPException(status_code=404)

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str = ""):
        if full_path.startswith(("api/", "auth/", "docs", "openapi")):
            from fastapi import HTTPException
            raise HTTPException(status_code=404)
        index = os.path.join(FRONTEND_DIR, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return {"message": "Transaltisa API v1.0.0"}
else:
    @app.get("/")
    def root():
        return {
            "message": "Transaltisa — Procesamiento de Facturas API v1.0.0",
            "docs": "/docs",
            "demo_mode": settings.demo_mode,
        }
