from pathlib import Path

from alembic.config import Config
from sqlalchemy import inspect, text

from alembic import command
from app.core.database import create_database_engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
PREVIOUS_REVISION = "20260714_0001"
FLASHCARD_REVISION = "20260714_0002"


def migration_config(database_url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.attributes["database_url"] = database_url
    return config


def current_revision(database_url: str) -> str:
    engine = create_database_engine(database_url)
    try:
        with engine.connect() as connection:
            return connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    finally:
        engine.dispose()


def table_names(database_url: str) -> set[str]:
    engine = create_database_engine(database_url)
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_migration_upgrade_downgrade_and_reapply(sqlite_url: str) -> None:
    config = migration_config(sqlite_url)

    command.upgrade(config, "head")
    assert current_revision(sqlite_url) == FLASHCARD_REVISION
    assert {"alembic_version", "outer_cards", "inner_cards"} <= table_names(sqlite_url)
    command.check(config)

    engine = create_database_engine(sqlite_url)
    try:
        inspector = inspect(engine)
        outer_columns = {column["name"]: column for column in inspector.get_columns("outer_cards")}
        inner_columns = {column["name"]: column for column in inspector.get_columns("inner_cards")}
        assert str(outer_columns["id"]["type"]) == "CHAR(32)"
        assert str(inner_columns["id"]["type"]) == "CHAR(32)"
        assert str(inner_columns["outer_card_id"]["type"]) == "CHAR(32)"

        foreign_keys = inspector.get_foreign_keys("inner_cards")
        assert len(foreign_keys) == 1
        assert foreign_keys[0]["referred_table"] == "outer_cards"
        assert foreign_keys[0]["options"]["ondelete"] == "CASCADE"

        outer_indexes = {index["name"]: index for index in inspector.get_indexes("outer_cards")}
        inner_indexes = {index["name"]: index for index in inspector.get_indexes("inner_cards")}
        assert outer_indexes["ix_outer_cards_sort_order"]["column_names"] == ["sort_order"]
        assert inner_indexes["ix_inner_cards_outer_card_id_sort_order"]["column_names"] == [
            "outer_card_id",
            "sort_order",
        ]
    finally:
        engine.dispose()

    command.downgrade(config, PREVIOUS_REVISION)
    assert current_revision(sqlite_url) == PREVIOUS_REVISION
    assert "outer_cards" not in table_names(sqlite_url)
    assert "inner_cards" not in table_names(sqlite_url)

    command.upgrade(config, "head")
    assert current_revision(sqlite_url) == FLASHCARD_REVISION
    assert {"outer_cards", "inner_cards"} <= table_names(sqlite_url)
