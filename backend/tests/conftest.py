from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy.engine import Engine
from sqlmodel import SQLModel

from app import models as app_models  # noqa: F401
from app.core.database import create_database_engine


@pytest.fixture
def sqlite_url(tmp_path: Path) -> str:
    return f"sqlite:///{tmp_path / 'layerlex-test.db'}"


@pytest.fixture
def sqlite_engine(sqlite_url: str) -> Iterator[Engine]:
    engine = create_database_engine(sqlite_url)
    SQLModel.metadata.create_all(engine)

    try:
        yield engine
    finally:
        engine.dispose()
