#!/usr/bin/env bash
#
# backup_postgres.sh — Backup automatizado de PostgreSQL
#
# Genera un dump comprimido de la base de datos del Sistema Jurídico,
# lo guarda con timestamp y rota los backups más viejos que RETENTION_DAYS.
#
# Uso:
#   ./backup_postgres.sh                    # usa variables del entorno o .env
#   BACKUP_DIR=/mnt/backups ./backup_postgres.sh
#
# Cron sugerido (diario a las 3am):
#   0 3 * * * /opt/carlos-abogado/scripts/backup_postgres.sh >> /var/log/pg_backup.log 2>&1
#
# Variables requeridas:
#   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
#
# Variables opcionales:
#   BACKUP_DIR       (default: ./backups)
#   RETENTION_DAYS   (default: 30)
#   GPG_RECIPIENT    si está definido, cifra el backup con gpg --encrypt -r $GPG_RECIPIENT
#                    y produce un .sql.gz.gpg en lugar de .sql.gz (recomendado para
#                    almacenamiento offsite o cloud).

set -euo pipefail

# Cargar .env si existe en la raíz del proyecto
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    # shellcheck disable=SC1091
    set -a; source "$PROJECT_ROOT/.env"; set +a
fi

# Configuración con defaults
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_HOST="${DB_HOST:?ERROR: DB_HOST no definido}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:?ERROR: DB_NAME no definido}"
DB_USER="${DB_USER:?ERROR: DB_USER no definido}"
DB_PASS="${DB_PASS:?ERROR: DB_PASS no definido}"

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Nombre del archivo con timestamp ISO 8601
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[$(date -Iseconds)] Iniciando backup de $DB_NAME → $BACKUP_FILE"

# Ejecutar pg_dump con compresión gzip
# -Fc = custom format (comprimido, restaurable selectivamente)
# Usamos gzip para máxima portabilidad
PGPASSWORD="$DB_PASS" pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --no-owner \
    --no-privileges \
    --verbose \
    2> "$BACKUP_DIR/.last_backup.log" \
    | gzip -9 > "$BACKUP_FILE"

# Verificar que el archivo se creó y no está vacío
if [[ ! -s "$BACKUP_FILE" ]]; then
    echo "[ERROR] El backup está vacío — posible fallo de pg_dump"
    cat "$BACKUP_DIR/.last_backup.log" >&2
    rm -f "$BACKUP_FILE"
    exit 1
fi

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "[$(date -Iseconds)] Backup completado: $BACKUP_FILE ($BACKUP_SIZE)"

# Cifrado opcional con GPG (si GPG_RECIPIENT está definido)
if [[ -n "${GPG_RECIPIENT:-}" ]]; then
    if ! command -v gpg >/dev/null 2>&1; then
        echo "[ERROR] GPG_RECIPIENT está definido pero gpg no está instalado" >&2
        exit 2
    fi
    ENC_FILE="${BACKUP_FILE}.gpg"
    echo "[$(date -Iseconds)] Cifrando backup con GPG (recipient: $GPG_RECIPIENT)"
    gpg --batch --yes --trust-model always \
        --encrypt --recipient "$GPG_RECIPIENT" \
        --output "$ENC_FILE" \
        "$BACKUP_FILE"
    if [[ ! -s "$ENC_FILE" ]]; then
        echo "[ERROR] Cifrado GPG falló — el archivo cifrado está vacío" >&2
        exit 3
    fi
    # Borrar el dump en claro (solo dejamos el cifrado)
    rm -f "$BACKUP_FILE"
    BACKUP_FILE="$ENC_FILE"
    echo "[$(date -Iseconds)] Backup cifrado: $BACKUP_FILE"
fi

# Rotación: eliminar backups más viejos que RETENTION_DAYS (cubre .sql.gz y .sql.gz.gpg)
echo "[$(date -Iseconds)] Rotando backups más viejos que $RETENTION_DAYS días"
DELETED_COUNT=0
while IFS= read -r old_file; do
    rm -f "$old_file"
    DELETED_COUNT=$((DELETED_COUNT + 1))
    echo "  eliminado: $(basename "$old_file")"
done < <(find "$BACKUP_DIR" -maxdepth 1 \( -name "${DB_NAME}_*.sql.gz" -o -name "${DB_NAME}_*.sql.gz.gpg" \) -mtime +"$RETENTION_DAYS" -type f)

echo "[$(date -Iseconds)] Rotación completada — $DELETED_COUNT archivos eliminados"
echo "[$(date -Iseconds)] Backup finalizado exitosamente"
