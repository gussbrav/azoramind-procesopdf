# Scripts operativos

Scripts auxiliares para operación, mantenimiento y automatización del Sistema Jurídico.

## Backups de PostgreSQL

### `backup_postgres.sh`

Genera un dump comprimido (`.sql.gz`) de la base de datos y aplica rotación automática.

**Uso manual:**
```bash
./scripts/backup_postgres.sh
```

**Cron sugerido (diario a las 3:00 AM):**
```
0 3 * * * /opt/carlos-abogado/scripts/backup_postgres.sh >> /var/log/pg_backup.log 2>&1
```

**Variables de entorno:**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` (requeridas — se leen de `.env` si existe)
- `BACKUP_DIR` (opcional, default `./backups`)
- `RETENTION_DAYS` (opcional, default `30`)

### `restore_postgres.sh`

Restaura un backup `.sql.gz` a la base de datos configurada. **Operación destructiva** — pide confirmación explícita antes de proceder.

**Uso:**
```bash
./scripts/restore_postgres.sh backups/sistema_juridico_2026-04-05_030000.sql.gz
```

## OCR y utilidades PDF

- `ocr/` — procesamiento OCR de PDFs escaneados
- `pdf_utils/` — utilidades de manipulación de PDFs
