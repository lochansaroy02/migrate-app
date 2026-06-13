# migrate-app

DataBridge — production-ready database migration platform.

Migrate data between PostgreSQL, MySQL, and SQLite with schema mapping, batch processing, and real-time progress tracking.

## Stack
- **FastAPI** + Python 3.12
- **SQLAlchemy** (async) + Alembic
- **Celery** + Redis (background workers)
- **PostgreSQL** (application database)
- **Docker** / Docker Compose

## Quick Start
```bash
cd backend
cp .env.example .env      # fill in your credentials
docker compose up --build
```

API docs → http://localhost:8000/docs
