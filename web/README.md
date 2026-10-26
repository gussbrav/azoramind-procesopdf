# Sistema Jurídico — Portal Web
## Estudio de Abogados | Carlos | Desarrollado por Azoramind

Portal web para gestión de documentos y expedientes judiciales peruanos.

---

## Requisitos Previos

- Python 3.13
- Node.js 20 + npm 10
- PostgreSQL con schema `carlos` y tabla `m_expediente`

---

## Setup Local — Backend

```bash
cd web/backend

# 1. Crear entorno virtual e instalar dependencias
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

pip install -r requirements.txt

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con los datos reales de la base de datos

# 3. Inicializar usuario Carlos (primera vez)
python init_user.py
# Sigue las instrucciones para crear la contraseña

# 4. Ejecutar el servidor de desarrollo
uvicorn app.main:app --reload --port 8000
```

La API estará disponible en: http://localhost:8000
Documentación interactiva: http://localhost:8000/docs

---

## Setup Local — Frontend

```bash
cd web/frontend

# 1. Instalar dependencias
npm install

# 2. Configurar variable de entorno
cp .env.example .env
# Por defecto apunta a http://localhost:8000

# 3. Ejecutar en modo desarrollo
npm run dev
```

La aplicación estará disponible en: http://localhost:5173

---

## Cómo inicializar el usuario Carlos

El sistema tiene un único usuario: `carlos`. Para establecer su contraseña:

```bash
cd web/backend
python init_user.py
```

El script pedirá la contraseña de forma segura (sin mostrarse en pantalla) y actualizará el hash en la base de datos. Esto puede ejecutarse las veces que sea necesario para cambiar la contraseña.

---

## Variables de Entorno

### Backend (`web/backend/.env`)
| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL |
| `SECRET_KEY` | Clave secreta para JWT (min. 32 caracteres) |
| `ALGORITHM` | Algoritmo JWT (default: HS256) |
| `ACCESS_TOKEN_EXPIRE_HOURS` | Expiración del token (default: 8) |
| `N8N_WEBHOOK_BASE` | URL base del servidor n8n |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos (separados por coma) |

### Frontend (`web/frontend/.env`)
| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL del backend FastAPI |

---

## Endpoints de la API

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/api/health` | Estado del servidor y DB | No |
| POST | `/auth/login` | Login, retorna JWT | No |
| GET | `/api/documentos` | Lista paginada de documentos | JWT |

---

## Estructura del Proyecto

```
web/
├── backend/           # FastAPI + psycopg2
│   ├── app/
│   │   ├── main.py         # App FastAPI + CORS + routers
│   │   ├── config.py       # Settings (pydantic-settings)
│   │   ├── database.py     # Pool de conexiones PostgreSQL
│   │   ├── auth/           # JWT + login endpoint
│   │   └── routers/        # health + documentos
│   ├── migrations/         # DDL SQL versionado
│   ├── init_user.py        # Script para crear usuario inicial
│   └── requirements.txt
├── frontend/          # React + Vite + Tailwind CSS
│   └── src/
│       ├── components/     # UI components + layout
│       ├── pages/          # Login, Dashboard, Documentos
│       ├── store/          # Zustand (auth)
│       └── lib/            # api.js (axios) + utils.js
├── docker-compose.yml
└── .gitignore
```

---

## Fase 1 — Funcionalidades Implementadas

- Autenticación JWT de un solo usuario (Carlos)
- Login con contraseña hasheada en bcrypt
- Rutas protegidas en el frontend
- Sidebar de navegación con estructura completa
- Dashboard con tarjetas de resumen
- Tabla de documentos con filtros y paginación
- Manejo de errores y estados de carga

## Próximas Fases

- **Fase 2**: Subida de PDFs, integración con n8n webhooks
- **Fase 3**: Vista detalle de expediente + entidades extraídas por IA
- **Fase 4**: Calendario de audiencias, alertas de plazos
