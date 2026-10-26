# CLAUDE.md — Sistema de Procesamiento de Facturas
## Cliente: Transaltisa
## Desarrollado por: Azoramind | Gustavo Bravo | www.azoramind.com

---

## Contexto del Proyecto

Transaltisa necesita procesar masivamente facturas en PDF (escaneadas y digitales), extraer automáticamente los datos de cada línea de detalle (descripción, cantidad, unidad de medida, precio unitario, subtotal), detectar discrepancias entre los totales declarados y los recalculados, y exportar todo a un Excel estructurado para su revisión contable.

El objetivo es eliminar la digitación manual de facturas y reducir errores de conciliación.

---

## Stack Tecnológico

| Capa              | Tecnología               | Rol                                                     |
|-------------------|--------------------------|---------------------------------------------------------|
| **Backend**       | FastAPI + Python         | API REST, orquestación del pipeline                     |
| **Base de Datos** | PostgreSQL               | Almacenamiento de facturas (PDF + datos extraídos)      |
| **OCR**           | Azoramind OCR API        | Extracción de texto de PDFs escaneados                  |
| **IA / Extracción**| Claude API (Anthropic)  | Parseo inteligente de campos de factura                 |
| **Reportes**      | openpyxl                 | Generación de Excel con detalle de ítems                |
| **Frontend**      | React + Vite + Tailwind  | Panel de carga y visualización                          |
| **Auth**          | JWT (python-jose)        | Control de acceso por roles                             |
| **Deploy**        | Docker + docker-compose  | Contenedores para backend, frontend y PostgreSQL        |

---

## Pipeline de Procesamiento

```
[PDF Factura]
      |
      v
[POST /api/facturas/upload]
  ├── Validar PDF (tipo, tamaño <= 20 MB)
  ├── Calcular SHA-256 → deduplicación
  ├── Guardar PDF en tabla facturas (pdf_data BYTEA)
  ├── Registrar estado = 'pendiente'
      |
      v (background task)
[OCR Service — ocr_service.py]
  └── Llama a Azoramind OCR API → texto limpio
      |
      v
[PDF Extractor — pdf_extractor.py]
  └── Llama a Claude API con prompt de prompts/extraccion_facturas/
  └── Parsea respuesta JSON estructurada
      |
      v
[Valor Unitario — valor_unitario.py]
  ├── Recalcula precio_unitario si falta o es inconsistente
  ├── Verifica cantidad × precio ≈ subtotal_item
  └── Calcula totales y detecta discrepancias
      |
      v
[PostgreSQL — tablas: facturas + factura_items]
      |
      v
[GET /api/reportes/excel]
  └── Excel Generator → hoja Resumen + hoja Detalle Items
  └── Descarga directa del .xlsx
```

---

## Estructura del Repositorio

```
TRANSALTISA/
├── CLAUDE.md                            # Este archivo
├── .gitignore
├── .github/
│   └── workflows/ci.yml                 # CI/CD
│
├── web/
│   ├── docker-compose.yml               # Orquestación de contenedores
│   ├── docker-compose.dev.yml           # Dev con hot reload
│   │
│   ├── backend/                         # FastAPI
│   │   ├── app/
│   │   │   ├── main.py                  # Entry point, middlewares
│   │   │   ├── config.py                # Settings (pydantic-settings)
│   │   │   ├── database.py              # Pool de conexiones PostgreSQL
│   │   │   ├── logger.py                # Loguru structured logging
│   │   │   ├── security.py              # Rate limit, validaciones
│   │   │   ├── audit.py                 # Audit log
│   │   │   ├── auth/                    # JWT auth
│   │   │   │   ├── jwt.py
│   │   │   │   ├── router.py
│   │   │   │   └── schemas.py
│   │   │   ├── routers/
│   │   │   │   ├── health.py            # GET /health
│   │   │   │   ├── facturas.py          # CRUD + upload + proceso
│   │   │   │   ├── reportes.py          # Excel export + stats
│   │   │   │   ├── settings.py          # Branding / app config
│   │   │   │   └── setup.py             # Primer usuario admin
│   │   │   └── services/
│   │   │       ├── ocr_service.py       # OCR de PDFs escaneados
│   │   │       ├── pdf_extractor.py     # Extracción IA con Claude
│   │   │       ├── valor_unitario.py    # Cálculo y validación de precios
│   │   │       └── excel_generator.py  # Generación de .xlsx con openpyxl
│   │   ├── alembic/                     # Migraciones de BD
│   │   ├── requirements.txt
│   │   ├── requirements-dev.txt
│   │   ├── pytest.ini
│   │   ├── ruff.toml
│   │   ├── .env.example
│   │   └── Dockerfile
│   │
│   └── frontend/                        # React + Vite
│       ├── src/
│       │   ├── pages/
│       │   │   ├── UploadPage.jsx       # Carga de facturas PDF
│       │   │   ├── FacturasPage.jsx     # Lista y estado de facturas
│       │   │   └── ReportesPage.jsx     # Descarga de Excel
│       │   └── ...
│       ├── package.json
│       └── Dockerfile
│
├── database/
│   ├── schema/
│   │   └── 01_schema_facturas.sql       # DDL completo
│   ├── migrations/                      # Migraciones versionadas (alembic)
│   └── seeds/                           # Datos de prueba
│
├── prompts/
│   └── extraccion_facturas/
│       └── prompt_extraccion.md         # Prompt Claude para extracción
│
├── docs/
│   └── arquitectura/                    # Diagramas y decisiones técnicas
│
├── tests/
│   └── samples/
│       └── facturas/                    # PDFs de prueba (no versionar PDFs reales)
│
└── scripts/
    ├── backup_postgres.sh
    └── restore_postgres.sh
```

---

## Modelo de Datos Principal

### `facturas`
| Campo                  | Tipo          | Descripción                               |
|------------------------|---------------|-------------------------------------------|
| `id`                   | SERIAL PK     |                                           |
| `nombre_archivo`       | TEXT          | Nombre original del PDF                   |
| `hash_sha256`          | TEXT UNIQUE   | Para deduplicación                        |
| `pdf_data`             | BYTEA         | PDF original almacenado                   |
| `numero_factura`       | TEXT          | Ej: "F001-000123"                         |
| `fecha_emision`        | DATE          |                                           |
| `proveedor_ruc`        | TEXT          | RUC de 11 dígitos                         |
| `proveedor_razon_social`| TEXT         |                                           |
| `moneda`               | TEXT          | PEN \| USD                                |
| `subtotal`             | NUMERIC(14,2) | Antes de IGV                              |
| `igv`                  | NUMERIC(14,2) |                                           |
| `total_declarado`      | NUMERIC(14,2) | Tal como aparece en el PDF                |
| `total_calculado`      | NUMERIC(14,2) | Recalculado desde ítems                   |
| `total_discrepancia`   | NUMERIC(14,2) | discrepancia (alerta si > 0.10)           |
| `estado`               | TEXT          | pendiente \| procesado \| error           |
| `confianza_ia`         | FLOAT         | Score 0-1 de la extracción                |

### `factura_items`
| Campo                       | Tipo          | Descripción                          |
|-----------------------------|---------------|--------------------------------------|
| `factura_id`                | INT FK        | Referencia a `facturas`              |
| `numero_item`               | INT           | Posición en la factura (1-based)     |
| `descripcion`               | TEXT          |                                      |
| `cantidad`                  | NUMERIC(14,4) |                                      |
| `unidad_medida`             | TEXT          | UND, KG, HRS, SRV, etc.             |
| `precio_unitario`           | NUMERIC(14,4) | Real o calculado                     |
| `precio_unitario_calculado` | BOOLEAN       | TRUE si fue calculado (no declarado) |
| `subtotal_item`             | NUMERIC(14,2) |                                      |

---

## Endpoints Principales

| Método | Ruta                     | Descripción                                  |
|--------|--------------------------|----------------------------------------------|
| POST   | `/api/facturas/upload`   | Sube PDF, inicia procesamiento en background |
| GET    | `/api/facturas`          | Lista facturas con paginación y filtros      |
| GET    | `/api/facturas/{id}`     | Detalle completo + ítems                     |
| GET    | `/api/facturas/{id}/pdf` | Descarga el PDF original                     |
| GET    | `/api/reportes/excel`    | Descarga Excel con filtros opcionales        |
| GET    | `/api/reportes/stats`    | Estadísticas de resumen del lote             |
| GET    | `/health`                | Estado de la aplicación y BD                 |

---

## Variables de Entorno (.env)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/transaltisa
SECRET_KEY=tu-clave-secreta-muy-larga
DEMO_MODE=false

# Claude API
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6

# OCR API
OCR_API_URL=https://azoramind-ocr-api.l7weu8.easypanel.host/process

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://tu-dominio.com
```

---

## Reglas de Desarrollo

- **Idioma del código:** inglés para variables/funciones; español para comentarios y docs
- **Formato de fechas:** ISO 8601 (`YYYY-MM-DD`) en BD y APIs
- **Naming PostgreSQL:** `snake_case`
- **Precisión monetaria:** `NUMERIC(14,2)` para totales; `NUMERIC(14,4)` para precios unitarios
- **Discrepancia de alerta:** diferencia > S/ 0.10 entre `total_declarado` y `total_calculado`
- **Deduplicación:** dos PDFs con el mismo SHA-256 se consideran la misma factura

---

## Estado del Proyecto

- [x] Schema de base de datos (`database/schema/01_schema_facturas.sql`)
- [x] Pipeline backend: OCR → extracción IA → valor unitario → PostgreSQL
- [x] Router facturas: upload, list, detail, PDF download
- [x] Router reportes: Excel export, stats
- [x] Prompt Claude para extracción de facturas (`prompts/extraccion_facturas/`)
- [ ] Migraciones Alembic (baseline desde schema)
- [ ] Frontend: UploadPage, FacturasPage, ReportesPage
- [ ] Tests con PDFs de muestra reales de Transaltisa
- [ ] Validación del prompt con facturas reales
- [ ] Deploy en producción

---

## Contexto Empresarial — Azoramind

- **Empresa:** Azoramind — IA, Automatización y Datos
- **Fundador:** Gustavo Roger Bravo Esquivias
- **Web:** www.azoramind.com | gussbrav@gmail.com
- **Stack preferido:** FastAPI, PostgreSQL, React/Vite, Claude API, openpyxl, Docker
