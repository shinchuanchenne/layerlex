from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.routes.health import health_check
from app.core.config import get_settings
from app.schemas.health import HealthResponse


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="API for the LayerLex dual-layer vocabulary flashcard application.",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router, prefix=settings.api_v1_prefix)

    @application.get(
        "/health",
        response_model=HealthResponse,
        include_in_schema=False,
    )
    def infrastructure_health() -> HealthResponse:
        return health_check()

    return application


app = create_app()
