from fastapi import APIRouter

from app.api.routes import decks, health, inner_cards, outer_cards

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(decks.router)
api_router.include_router(outer_cards.router)
api_router.include_router(inner_cards.router)
