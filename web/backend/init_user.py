"""
Script de inicialización del usuario Carlos.

Uso:
    cd web/backend
    pip install -r requirements.txt
    cp .env.example .env   # y editar con los valores reales
    python init_user.py

Este script:
1. Crea la tabla gestordocumentos.web_users si no existe
2. Solicita una contraseña interactivamente
3. Genera el hash bcrypt y actualiza el registro del usuario 'carlos'
"""
import sys
import getpass
import bcrypt
import psycopg2
from dotenv import load_dotenv
import os

# Cargar variables de entorno desde .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL no está definido en el archivo .env")
    sys.exit(1)


def main():
    print("=== Inicialización de Usuario — Sistema Jurídico ===\n")

    # Solicitar contraseña de forma segura (no se muestra en pantalla)
    password = getpass.getpass("Ingresa la contraseña para el usuario 'carlos': ")
    if len(password) < 6:
        print("ERROR: La contraseña debe tener al menos 6 caracteres.")
        sys.exit(1)

    confirm = getpass.getpass("Confirma la contraseña: ")
    if password != confirm:
        print("ERROR: Las contraseñas no coinciden.")
        sys.exit(1)

    # Generar hash bcrypt
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    # Conectar a la base de datos y actualizar el usuario
    try:
        conn = psycopg2.connect(DATABASE_URL)
        with conn:
            with conn.cursor() as cur:
                # Crear schema y tabla si no existen
                cur.execute("CREATE SCHEMA IF NOT EXISTS gestordocumentos;")
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS gestordocumentos.web_users (
                        id            SERIAL PRIMARY KEY,
                        username      TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at    TIMESTAMPTZ DEFAULT NOW()
                    );
                """)

                # Insertar o actualizar el usuario 'carlos'
                cur.execute("""
                    INSERT INTO gestordocumentos.web_users (username, password_hash)
                    VALUES ('carlos', %s)
                    ON CONFLICT (username)
                    DO UPDATE SET password_hash = EXCLUDED.password_hash;
                """, (password_hash,))

        conn.close()
        print("\nUsuario 'carlos' configurado correctamente.")
        print("Ahora puedes iniciar el servidor: uvicorn app.main:app --reload")

    except Exception as e:
        print(f"\nERROR al conectar a la base de datos: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
