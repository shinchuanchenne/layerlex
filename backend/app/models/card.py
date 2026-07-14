from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Index, Text, Uuid
from sqlmodel import Field, Relationship, SQLModel

from app.models.types import UTCDateTime, utc_now


class OuterCard(SQLModel, table=True):
    __tablename__ = "outer_cards"
    __table_args__ = (Index("ix_outer_cards_sort_order", "sort_order"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True, sa_type=Uuid)
    term: str
    reading: str | None = None
    part_of_speech: str | None = None
    meaning: str = Field(sa_type=Text)
    jlpt_level: str | None = None
    notes: str | None = Field(default=None, sa_type=Text)
    sort_order: int = Field(
        default=0,
        nullable=False,
        sa_column_kwargs={"server_default": "0"},
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        nullable=False,
        sa_type=UTCDateTime,
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        nullable=False,
        sa_type=UTCDateTime,
        sa_column_kwargs={"onupdate": utc_now},
    )

    inner_cards: list["InnerCard"] = Relationship(
        back_populates="outer_card",
        cascade_delete=True,
        passive_deletes=True,
    )


class InnerCard(SQLModel, table=True):
    __tablename__ = "inner_cards"
    __table_args__ = (
        Index("ix_inner_cards_outer_card_id_sort_order", "outer_card_id", "sort_order"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True, sa_type=Uuid)
    outer_card_id: UUID = Field(
        foreign_key="outer_cards.id",
        ondelete="CASCADE",
        nullable=False,
        sa_type=Uuid,
    )
    expression: str = Field(sa_type=Text)
    reading: str | None = None
    meaning: str = Field(sa_type=Text)
    usage_note: str | None = Field(default=None, sa_type=Text)
    notes: str | None = Field(default=None, sa_type=Text)
    sort_order: int = Field(
        default=0,
        nullable=False,
        sa_column_kwargs={"server_default": "0"},
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        nullable=False,
        sa_type=UTCDateTime,
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        nullable=False,
        sa_type=UTCDateTime,
        sa_column_kwargs={"onupdate": utc_now},
    )

    outer_card: OuterCard = Relationship(back_populates="inner_cards")
