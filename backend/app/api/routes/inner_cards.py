from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.api.errors import INNER_CARD_NOT_FOUND, OUTER_CARD_NOT_FOUND
from app.core.database import get_session
from app.models import InnerCard, OuterCard
from app.schemas.inner_card import (
    InnerCardCreate,
    InnerCardListResponse,
    InnerCardRead,
    InnerCardUpdate,
)

router = APIRouter(tags=["inner cards"])
SessionDependency = Annotated[Session, Depends(get_session)]


def _get_outer_card_or_404(outer_card_id: UUID, session: Session) -> OuterCard:
    outer_card = session.get(OuterCard, outer_card_id)
    if outer_card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=OUTER_CARD_NOT_FOUND)
    return outer_card


def _get_inner_card_or_404(inner_card_id: UUID, session: Session) -> InnerCard:
    inner_card = session.get(InnerCard, inner_card_id)
    if inner_card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=INNER_CARD_NOT_FOUND)
    return inner_card


@router.post(
    "/outer-cards/{outer_card_id}/inner-cards",
    response_model=InnerCardRead,
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_404_NOT_FOUND: {"description": OUTER_CARD_NOT_FOUND}},
    summary="Create an inner flashcard",
    description="Create one usage card belonging to an existing outer flashcard.",
)
def create_inner_card(
    outer_card_id: UUID,
    payload: InnerCardCreate,
    session: SessionDependency,
) -> InnerCard:
    _get_outer_card_or_404(outer_card_id, session)
    inner_card = InnerCard(outer_card_id=outer_card_id, **payload.model_dump())
    session.add(inner_card)
    session.commit()
    session.refresh(inner_card)
    return inner_card


@router.get(
    "/outer-cards/{outer_card_id}/inner-cards",
    response_model=InnerCardListResponse,
    responses={status.HTTP_404_NOT_FOUND: {"description": OUTER_CARD_NOT_FOUND}},
    summary="List an outer flashcard's inner cards",
    description=(
        "Return a stable, paginated list for one outer card, ordered by sort order, "
        "creation time, and ID."
    ),
)
def list_inner_cards(
    outer_card_id: UUID,
    session: SessionDependency,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    search: str | None = None,
) -> InnerCardListResponse:
    _get_outer_card_or_404(outer_card_id, session)
    search_value = search.strip() if search is not None else ""

    count_statement = (
        select(func.count()).select_from(InnerCard).where(InnerCard.outer_card_id == outer_card_id)
    )
    list_statement = select(InnerCard).where(InnerCard.outer_card_id == outer_card_id)

    if search_value:
        pattern = f"%{search_value}%"
        search_filter = or_(
            InnerCard.expression.ilike(pattern),
            InnerCard.reading.ilike(pattern),
            InnerCard.meaning.ilike(pattern),
            InnerCard.usage_note.ilike(pattern),
        )
        count_statement = count_statement.where(search_filter)
        list_statement = list_statement.where(search_filter)

    total = session.exec(count_statement).one()
    items = session.exec(
        list_statement.order_by(
            InnerCard.sort_order.asc(),
            InnerCard.created_at.asc(),
            InnerCard.id.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()

    return InnerCardListResponse(items=items, total=total, offset=offset, limit=limit)


@router.get(
    "/inner-cards",
    response_model=InnerCardListResponse,
    summary="List all inner flashcards",
    description=(
        "Return a stable, paginated collection of inner cards across all outer cards. "
        "Results are grouped by outer-card order and then ordered within each parent."
    ),
)
def list_all_inner_cards(
    session: SessionDependency,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    search: str | None = None,
) -> InnerCardListResponse:
    search_value = search.strip() if search is not None else ""

    count_statement = (
        select(func.count())
        .select_from(InnerCard)
        .join(OuterCard, InnerCard.outer_card_id == OuterCard.id)
    )
    list_statement = select(InnerCard).join(
        OuterCard,
        InnerCard.outer_card_id == OuterCard.id,
    )

    if search_value:
        pattern = f"%{search_value}%"
        search_filter = or_(
            InnerCard.expression.ilike(pattern),
            InnerCard.reading.ilike(pattern),
            InnerCard.meaning.ilike(pattern),
            InnerCard.usage_note.ilike(pattern),
        )
        count_statement = count_statement.where(search_filter)
        list_statement = list_statement.where(search_filter)

    total = session.exec(count_statement).one()
    items = session.exec(
        list_statement.order_by(
            OuterCard.sort_order.asc(),
            OuterCard.created_at.asc(),
            OuterCard.id.asc(),
            InnerCard.sort_order.asc(),
            InnerCard.created_at.asc(),
            InnerCard.id.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()

    return InnerCardListResponse(items=items, total=total, offset=offset, limit=limit)


@router.get(
    "/inner-cards/{inner_card_id}",
    response_model=InnerCardRead,
    responses={status.HTTP_404_NOT_FOUND: {"description": INNER_CARD_NOT_FOUND}},
    summary="Retrieve an inner flashcard",
    description="Return one inner card by UUID, including its outer-card UUID.",
)
def retrieve_inner_card(inner_card_id: UUID, session: SessionDependency) -> InnerCard:
    return _get_inner_card_or_404(inner_card_id, session)


@router.patch(
    "/inner-cards/{inner_card_id}",
    response_model=InnerCardRead,
    responses={status.HTTP_404_NOT_FOUND: {"description": INNER_CARD_NOT_FOUND}},
    summary="Update an inner flashcard",
    description=(
        "Partially update one inner card while preserving unspecified fields and its "
        "outer-card relationship."
    ),
)
def update_inner_card(
    inner_card_id: UUID,
    payload: InnerCardUpdate,
    session: SessionDependency,
) -> InnerCard:
    inner_card = _get_inner_card_or_404(inner_card_id, session)
    updates = payload.model_dump(exclude_unset=True)
    changed = False

    for field_name, value in updates.items():
        if getattr(inner_card, field_name) != value:
            setattr(inner_card, field_name, value)
            changed = True

    if changed:
        session.add(inner_card)
        session.commit()
        session.refresh(inner_card)

    return inner_card


@router.delete(
    "/inner-cards/{inner_card_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={status.HTTP_404_NOT_FOUND: {"description": INNER_CARD_NOT_FOUND}},
    summary="Delete an inner flashcard",
    description="Delete one inner card without deleting its outer card or siblings.",
)
def delete_inner_card(inner_card_id: UUID, session: SessionDependency) -> Response:
    inner_card = _get_inner_card_or_404(inner_card_id, session)
    session.delete(inner_card)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
