from typing import Any


def strip_required_string(value: Any) -> Any:
    """Trim a required string and reject whitespace-only values."""

    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped
    return value


def strip_optional_string(value: Any) -> Any:
    """Trim an optional string and normalise whitespace-only values to null."""

    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value
