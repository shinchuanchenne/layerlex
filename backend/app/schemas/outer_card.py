from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


def _strip_required_string(value: Any) -> Any:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped
    return value


def _strip_optional_string(value: Any) -> Any:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


class OuterCardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str
    reading: str | None = None
    part_of_speech: str | None = None
    meaning: str
    jlpt_level: str | None = None
    notes: str | None = None
    sort_order: int = 0

    _normalise_required = field_validator("term", "meaning", mode="before")(_strip_required_string)
    _normalise_optional = field_validator(
        "reading",
        "part_of_speech",
        "jlpt_level",
        "notes",
        mode="before",
    )(_strip_optional_string)


class OuterCardUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

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
            for field_name in ("term", "meaning", "sort_order"):
                if field_name in value and value[field_name] is None:
                    raise ValueError(f"{field_name} cannot be null")
        return value

    _normalise_required = field_validator("term", "meaning", mode="before")(_strip_required_string)
    _normalise_optional = field_validator(
        "reading",
        "part_of_speech",
        "jlpt_level",
        "notes",
        mode="before",
    )(_strip_optional_string)


class OuterCardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
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
