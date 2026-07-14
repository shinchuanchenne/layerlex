from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.core.database import get_session
from app.models import OuterCard
from app.schemas.outer_card import (
    OuterCardCreate,
    OuterCardListResponse,
    OuterCardRead,
    OuterCardUpdate,
)

router = APIRouter(prefix="/outer-cards", tags=["outer cards"])
SessionDependency = Annotated[Session, Depends(get_session)]
OUTER_CARD_NOT_FOUND = "Outer card not found"


def _get_outer_card_or_404(outer_card_id: UUID, session: Session) -> OuterCard:
    outer_card = session.get(OuterCard, outer_card_id)
    if outer_card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=OUTER_CARD_NOT_FOUND)
    return outer_card


@router.post(
    "",
    response_model=OuterCardRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create an outer flashcard",
    description="Create one vocabulary-word card without any inner-card content.",
)
def create_outer_card(payload: OuterCardCreate, session: SessionDependency) -> OuterCard:
    outer_card = OuterCard(**payload.model_dump())
    session.add(outer_card)
    session.commit()
    session.refresh(outer_card)
    return outer_card


@router.get(
    "",
    response_model=OuterCardListResponse,
    summary="List outer flashcards",
    description=(
        "Return a stable, paginated list ordered by sort order, creation time, and ID. "
        "Inner cards are not included."
    ),
)
def list_outer_cards(
    session: SessionDependency,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    search: str | None = None,
) -> OuterCardListResponse:
    search_value = search.strip() if search is not None else ""
    search_filter = None
    if search_value:
        pattern = f"%{search_value}%"
        search_filter = or_(
            OuterCard.term.ilike(pattern),
            OuterCard.reading.ilike(pattern),
            OuterCard.meaning.ilike(pattern),
        )

    count_statement = select(func.count()).select_from(OuterCard)
    list_statement = select(OuterCard)
    if search_filter is not None:
        count_statement = count_statement.where(search_filter)
        list_statement = list_statement.where(search_filter)

    total = session.exec(count_statement).one()
    items = session.exec(
        list_statement.order_by(
            OuterCard.sort_order.asc(),
            OuterCard.created_at.asc(),
            OuterCard.id.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()

    return OuterCardListResponse(items=items, total=total, offset=offset, limit=limit)


@router.get(
    "/{outer_card_id}",
    response_model=OuterCardRead,
    summary="Retrieve an outer flashcard",
    description="Return one outer card by UUID without loading its inner-card content.",
)
def retrieve_outer_card(outer_card_id: UUID, session: SessionDependency) -> OuterCard:
    return _get_outer_card_or_404(outer_card_id, session)


@router.patch(
    "/{outer_card_id}",
    response_model=OuterCardRead,
    summary="Update an outer flashcard",
    description="Partially update one outer card while preserving unspecified fields.",
)
def update_outer_card(
    outer_card_id: UUID,
    payload: OuterCardUpdate,
    session: SessionDependency,
) -> OuterCard:
    outer_card = _get_outer_card_or_404(outer_card_id, session)
    updates = payload.model_dump(exclude_unset=True)
    changed = False

    for field_name, value in updates.items():
        if getattr(outer_card, field_name) != value:
            setattr(outer_card, field_name, value)
            changed = True

    if changed:
        session.add(outer_card)
        session.commit()
        session.refresh(outer_card)

    return outer_card


@router.delete(
    "/{outer_card_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an outer flashcard",
    description="Delete one outer card and cascade deletion to all of its inner cards.",
)
def delete_outer_card(outer_card_id: UUID, session: SessionDependency) -> Response:
    outer_card = _get_outer_card_or_404(outer_card_id, session)
    session.delete(outer_card)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
