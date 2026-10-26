from fastapi import APIRouter
from app.config import settings

router = APIRouter(tags=["Sistema"])


@router.get("/api/health")
def health_check():
    if settings.demo_mode:
        return {"status": "ok", "db": "demo_mode", "demo": True}

    from app.database import check_db_connection
    db_status = "connected" if check_db_connection() else "disconnected"
    return {"status": "ok", "db": db_status}
