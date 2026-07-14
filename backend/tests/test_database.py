from pathlib import Path

from sqlalchemy import text

from app.core.database import create_database_engine


def test_sqlite_engine_creates_a_database_file(tmp_path: Path) -> None:
    database_path = tmp_path / "layerlex.db"
    engine = create_database_engine(f"sqlite:///{database_path}")

    try:
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT 1")) == 1
    finally:
        engine.dispose()

    assert database_path.is_file()
