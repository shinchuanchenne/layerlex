from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.schemas.validation import strip_optional_string, strip_required_string


class DeckCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str | None = None
    sort_order: int = 0

    _normalise_name = field_validator("name", mode="before")(strip_required_string)
    _normalise_description = field_validator("description", mode="before")(strip_optional_string)


class DeckUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    description: str | None = None
    sort_order: int | None = None

    @model_validator(mode="before")
    @classmethod
    def require_update_fields(cls, value: Any) -> Any:
        if isinstance(value, dict):
            if not value:
                raise ValueError("at least one field must be provided")
            for field_name in ("name", "sort_order"):
                if field_name in value and value[field_name] is None:
                    raise ValueError(f"{field_name} cannot be null")
        return value

    _normalise_name = field_validator("name", mode="before")(strip_required_string)
    _normalise_description = field_validator("description", mode="before")(strip_optional_string)


class DeckRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime


class DeckListResponse(BaseModel):
    items: list[DeckRead]
    total: int
    offset: int
    limit: int
