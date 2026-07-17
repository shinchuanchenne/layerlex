from collections.abc import Iterator
from pathlib import Path
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel

from app import models as app_models  # noqa: F401
from app.core.database import create_database_engine, get_session
from app.main import app
from app.models import Deck

TEST_DECK_ID = UUID("11111111-1111-4111-8111-111111111111")


@pytest.fixture
def sqlite_url(tmp_path: Path) -> str:
    return f"sqlite:///{tmp_path / 'layerlex-test.db'}"


@pytest.fixture
def sqlite_engine(sqlite_url: str) -> Iterator[Engine]:
    engine = create_database_engine(sqlite_url)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Deck(id=TEST_DECK_ID, name="Test deck"))
        session.commit()

    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def api_client(sqlite_engine: Engine) -> Iterator[TestClient]:
    def override_get_session() -> Iterator[Session]:
        with Session(sqlite_engine) as session:
            try:
                yield session
            except Exception:
                session.rollback()
                raise

    app.dependency_overrides[get_session] = override_get_session
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
