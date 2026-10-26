"""
Fixtures compartidos para todos los tests.
Configura la app en modo demo para evitar dependencias externas.
"""
import os
import sys
from pathlib import Path

# Asegurar que el backend está en el path
BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Variables de entorno mínimas antes de importar la app
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-production")
os.environ.setdefault("DEMO_MODE", "true")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Cliente HTTP de test para la app FastAPI."""
    return TestClient(app)
