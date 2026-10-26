"""
Configuración central — lee variables de entorno desde .env con pydantic-settings.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Base de datos
    database_url: str = "postgresql://user:password@host:5432/transaltisa"

    # Modo demo: no requiere base de datos real
    demo_mode: bool = False

    # JWT
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_hours: int = 8

    # Claude API (Anthropic) — extracción de facturas
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"

    # OCR API (Azoramind OCR — Tesseract)
    ocr_api_url: str = "https://azoramind-ocr-api.l7weu8.easypanel.host/process"

    # CORS
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    # Seguridad
    login_rate_limit: str = "5/minute"
    password_min_length: int = 12
    logo_max_dataurl_bytes: int = 400_000
    enable_hsts: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    def get_allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


settings = Settings()
