from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.schemas.validation import strip_optional_string, strip_required_string


class OuterCardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deck_id: UUID
    term: str
    reading: str | None = None
    part_of_speech: str | None = None
    meaning: str
    jlpt_level: str | None = None
    notes: str | None = None
    sort_order: int = 0

    _normalise_required = field_validator("term", "meaning", mode="before")(strip_required_string)
    _normalise_optional = field_validator(
        "reading",
        "part_of_speech",
        "jlpt_level",
        "notes",
        mode="before",
    )(strip_optional_string)


class OuterCardUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deck_id: UUID | None = None
    term: str | None = None
    reading: str | None = None
    part_of_speech: str | None = None
    meaning: str | None = None
    jlpt_level: str | None = None
    notes: str | None = None
    sort_order: int | None = None

    @model_validator(mode="before")
    @classmethod
    def require_update_fields(cls, value: Any) -> Any:
        if isinstance(value, dict):
            if not value:
                raise ValueError("at least one field must be provided")
            for field_name in ("deck_id", "term", "meaning", "sort_order"):
                if field_name in value and value[field_name] is None:
                    raise ValueError(f"{field_name} cannot be null")
        return value

    _normalise_required = field_validator("term", "meaning", mode="before")(strip_required_string)
    _normalise_optional = field_validator(
        "reading",
        "part_of_speech",
        "jlpt_level",
        "notes",
        mode="before",
    )(strip_optional_string)


class OuterCardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    deck_id: UUID
    term: str
    reading: str | None
    part_of_speech: str | None
    meaning: str
    jlpt_level: str | None
    notes: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class OuterCardListResponse(BaseModel):
    items: list[OuterCardRead]
    total: int
    offset: int
    limit: int
