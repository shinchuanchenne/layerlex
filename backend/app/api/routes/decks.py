from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.api.errors import DECK_NOT_EMPTY, DECK_NOT_FOUND
from app.core.database import get_session
from app.models import Deck, OuterCard
from app.schemas.deck import DeckCreate, DeckListResponse, DeckRead, DeckUpdate

router = APIRouter(prefix="/decks", tags=["decks"])
SessionDependency = Annotated[Session, Depends(get_session)]


def _get_deck_or_404(deck_id: UUID, session: Session) -> Deck:
    deck = session.get(Deck, deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=DECK_NOT_FOUND)
    return deck


@router.post(
    "",
    response_model=DeckRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a deck",
    description="Create one persistent collection for outer flashcards.",
)
def create_deck(payload: DeckCreate, session: SessionDependency) -> Deck:
    deck = Deck(**payload.model_dump())
    session.add(deck)
    session.commit()
    session.refresh(deck)
    return deck


@router.get(
    "",
    response_model=DeckListResponse,
    summary="List decks",
    description=(
        "Return a stable, paginated deck list ordered by sort order, creation time, and ID."
    ),
)
def list_decks(
    session: SessionDependency,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> DeckListResponse:
    total = session.exec(select(func.count()).select_from(Deck)).one()
    items = session.exec(
        select(Deck)
        .order_by(
            Deck.sort_order.asc(),
            Deck.created_at.asc(),
            Deck.id.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()
    return DeckListResponse(items=items, total=total, offset=offset, limit=limit)


@router.get(
    "/{deck_id}",
    response_model=DeckRead,
    responses={status.HTTP_404_NOT_FOUND: {"description": DECK_NOT_FOUND}},
    summary="Retrieve a deck",
    description="Return one deck by UUID.",
)
def retrieve_deck(deck_id: UUID, session: SessionDependency) -> Deck:
    return _get_deck_or_404(deck_id, session)


@router.patch(
    "/{deck_id}",
    response_model=DeckRead,
    responses={status.HTTP_404_NOT_FOUND: {"description": DECK_NOT_FOUND}},
    summary="Update a deck",
    description="Partially update one deck while preserving unspecified fields.",
)
def update_deck(
    deck_id: UUID,
    payload: DeckUpdate,
    session: SessionDependency,
) -> Deck:
    deck = _get_deck_or_404(deck_id, session)
    updates = payload.model_dump(exclude_unset=True)
    changed = False

    for field_name, value in updates.items():
        if getattr(deck, field_name) != value:
            setattr(deck, field_name, value)
            changed = True

    if changed:
        session.add(deck)
        session.commit()
        session.refresh(deck)

    return deck


@router.delete(
    "/{deck_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_404_NOT_FOUND: {"description": DECK_NOT_FOUND},
        status.HTTP_409_CONFLICT: {"description": DECK_NOT_EMPTY},
    },
    summary="Delete an empty deck",
    description="Delete one deck only when it contains no outer flashcards.",
)
def delete_deck(deck_id: UUID, session: SessionDependency) -> Response:
    deck = _get_deck_or_404(deck_id, session)
    card_count = session.exec(
        select(func.count()).select_from(OuterCard).where(OuterCard.deck_id == deck_id)
    ).one()
    if card_count:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DECK_NOT_EMPTY)

    session.delete(deck)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
