from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.schemas.validation import strip_optional_string, strip_required_string


class InnerCardCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expression: str
    reading: str | None = None
    meaning: str
    usage_note: str | None = None
    notes: str | None = None
    sort_order: int = 0

    _normalise_required = field_validator("expression", "meaning", mode="before")(
        strip_required_string
    )
    _normalise_optional = field_validator(
        "reading",
        "usage_note",
        "notes",
        mode="before",
    )(strip_optional_string)


class InnerCardUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expression: str | None = None
    reading: str | None = None
    meaning: str | None = None
    usage_note: str | None = None
    notes: str | None = None
    sort_order: int | None = None

    @model_validator(mode="before")
    @classmethod
    def require_update_fields(cls, value: Any) -> Any:
        if isinstance(value, dict):
            if not value:
                raise ValueError("at least one field must be provided")
            for field_name in ("expression", "meaning", "sort_order"):
                if field_name in value and value[field_name] is None:
                    raise ValueError(f"{field_name} cannot be null")
        return value

    _normalise_required = field_validator("expression", "meaning", mode="before")(
        strip_required_string
    )
    _normalise_optional = field_validator(
        "reading",
        "usage_note",
        "notes",
        mode="before",
    )(strip_optional_string)


class InnerCardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    outer_card_id: UUID
    expression: str
    reading: str | None
    meaning: str
    usage_note: str | None
    notes: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class InnerCardListResponse(BaseModel):
    items: list[InnerCardRead]
    total: int
    offset: int
    limit: int
