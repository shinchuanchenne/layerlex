from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, summary="Check API health")
def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="layerlex-api")
