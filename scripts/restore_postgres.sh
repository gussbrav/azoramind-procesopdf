#!/usr/bin/env bash
#
# restore_postgres.sh — Restauración de un backup de PostgreSQL
#
# Uso:
#   ./restore_postgres.sh backups/sistema_juridico_2026-04-05_030000.sql.gz
#
# IMPORTANTE: este script REEMPLAZA los datos de la base destino.
# Pedirá confirmación antes de proceder.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    # shellcheck disable=SC1091
    set -a; source "$PROJECT_ROOT/.env"; set +a
fi

BACKUP_FILE="${1:?ERROR: especifica el archivo de backup como primer argumento}"
DB_HOST="${DB_HOST:?ERROR: DB_HOST no definido}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:?ERROR: DB_NAME no definido}"
DB_USER="${DB_USER:?ERROR: DB_USER no definido}"
DB_PASS="${DB_PASS:?ERROR: DB_PASS no definido}"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "[ERROR] Archivo no encontrado: $BACKUP_FILE"
    exit 1
fi

echo "========================================================"
echo "  RESTAURACIÓN DE BASE DE DATOS — OPERACIÓN DESTRUCTIVA"
echo "========================================================"
echo "  Base de datos destino: $DB_NAME en $DB_HOST:$DB_PORT"
echo "  Archivo de backup:     $BACKUP_FILE"
echo ""
read -r -p "¿Continuar? Esto REEMPLAZARÁ los datos actuales [escribe 'SI' para confirmar]: " CONFIRM

if [[ "$CONFIRM" != "SI" ]]; then
    echo "Cancelado por el usuario."
    exit 0
fi

echo "[$(date -Iseconds)] Iniciando restauración..."

# Descomprimir y restaurar
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASS" psql \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --single-transaction \
    --set ON_ERROR_STOP=on

echo "[$(date -Iseconds)] Restauración completada exitosamente"
