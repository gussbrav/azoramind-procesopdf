"""
Gestión de conexiones a PostgreSQL usando pool de psycopg2.
Provee funciones para obtener y liberar conexiones del pool.
"""
import psycopg2
from psycopg2 import pool as pg_pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Generator
from app.config import settings


# Pool de conexiones: mínimo 1, máximo 10 conexiones simultáneas
_connection_pool: pg_pool.ThreadedConnectionPool | None = None


def init_db_pool() -> None:
    """Inicializa el pool de conexiones al arrancar la aplicación."""
    global _connection_pool
    _connection_pool = pg_pool.ThreadedConnectionPool(
        minconn=1,
        maxconn=10,
        dsn=settings.database_url,
        cursor_factory=RealDictCursor,
    )


def close_db_pool() -> None:
    """Cierra todas las conexiones del pool al apagar la aplicación."""
    global _connection_pool
    if _connection_pool:
        _connection_pool.closeall()
        _connection_pool = None


@contextmanager
def get_db() -> Generator:
    """
    Context manager que entrega una conexión del pool y la devuelve al terminar.
    Hace rollback automático si ocurre un error.
    Fija la zona horaria a Lima/Perú para que ::date se interprete correctamente.
    """
    conn = _connection_pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SET TIME ZONE 'America/Lima'")
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _connection_pool.putconn(conn)


def check_db_connection() -> bool:
    """Verifica que la conexión a la base de datos esté activa."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        return True
    except Exception:
        return False
