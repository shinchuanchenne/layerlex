from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from alembic.config import Config
from sqlalchemy import inspect, text

from alembic import command
from app.core.database import create_database_engine

BACKEND_DIR = Path(__file__).resolve().parents[1]
PREVIOUS_REVISION = "20260714_0001"
FLASHCARD_REVISION = "20260714_0002"
DECK_REVISION = "20260717_0003"


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
    assert current_revision(sqlite_url) == DECK_REVISION
    assert {"alembic_version", "decks", "outer_cards", "inner_cards"} <= table_names(sqlite_url)
    command.check(config)

    engine = create_database_engine(sqlite_url)
    try:
        inspector = inspect(engine)
        outer_columns = {column["name"]: column for column in inspector.get_columns("outer_cards")}
        inner_columns = {column["name"]: column for column in inspector.get_columns("inner_cards")}
        deck_columns = {column["name"]: column for column in inspector.get_columns("decks")}
        assert str(deck_columns["id"]["type"]) == "CHAR(32)"
        assert str(outer_columns["id"]["type"]) == "CHAR(32)"
        assert str(outer_columns["deck_id"]["type"]) == "CHAR(32)"
        assert outer_columns["deck_id"]["nullable"] is False
        assert str(inner_columns["id"]["type"]) == "CHAR(32)"
        assert str(inner_columns["outer_card_id"]["type"]) == "CHAR(32)"

        inner_foreign_keys = inspector.get_foreign_keys("inner_cards")
        assert len(inner_foreign_keys) == 1
        assert inner_foreign_keys[0]["referred_table"] == "outer_cards"
        assert inner_foreign_keys[0]["options"]["ondelete"] == "CASCADE"

        outer_foreign_keys = inspector.get_foreign_keys("outer_cards")
        assert len(outer_foreign_keys) == 1
        assert outer_foreign_keys[0]["referred_table"] == "decks"
        assert outer_foreign_keys[0]["options"]["ondelete"] == "RESTRICT"

        deck_indexes = {index["name"]: index for index in inspector.get_indexes("decks")}
        outer_indexes = {index["name"]: index for index in inspector.get_indexes("outer_cards")}
        inner_indexes = {index["name"]: index for index in inspector.get_indexes("inner_cards")}
        assert deck_indexes["ix_decks_sort_order"]["column_names"] == ["sort_order"]
        assert outer_indexes["ix_outer_cards_sort_order"]["column_names"] == ["sort_order"]
        assert outer_indexes["ix_outer_cards_deck_id_sort_order"]["column_names"] == [
            "deck_id",
            "sort_order",
        ]
        assert inner_indexes["ix_inner_cards_outer_card_id_sort_order"]["column_names"] == [
            "outer_card_id",
            "sort_order",
        ]
    finally:
        engine.dispose()

    command.downgrade(config, FLASHCARD_REVISION)
    assert current_revision(sqlite_url) == FLASHCARD_REVISION
    assert "decks" not in table_names(sqlite_url)
    assert {"outer_cards", "inner_cards"} <= table_names(sqlite_url)
    downgraded_engine = create_database_engine(sqlite_url)
    try:
        assert "deck_id" not in {
            column["name"] for column in inspect(downgraded_engine).get_columns("outer_cards")
        }
    finally:
        downgraded_engine.dispose()

    command.upgrade(config, "head")
    assert current_revision(sqlite_url) == DECK_REVISION
    assert {"decks", "outer_cards", "inner_cards"} <= table_names(sqlite_url)

    command.downgrade(config, PREVIOUS_REVISION)
    assert current_revision(sqlite_url) == PREVIOUS_REVISION
    assert "decks" not in table_names(sqlite_url)
    assert "outer_cards" not in table_names(sqlite_url)
    assert "inner_cards" not in table_names(sqlite_url)


def test_existing_cards_migrate_into_default_deck_and_survive_reapply(
    sqlite_url: str,
) -> None:
    config = migration_config(sqlite_url)
    command.upgrade(config, FLASHCARD_REVISION)

    outer_id = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    inner_id = UUID("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    now = datetime(2026, 7, 17, tzinfo=UTC).isoformat()
    engine = create_database_engine(sqlite_url)
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO outer_cards (
                        id, term, reading, part_of_speech, meaning, jlpt_level,
                        notes, sort_order, created_at, updated_at
                    ) VALUES (
                        :id, :term, NULL, NULL, :meaning, NULL,
                        NULL, 0, :created_at, :updated_at
                    )
                    """
                ),
                {
                    "id": outer_id.hex,
                    "term": "既存",
                    "meaning": "existing",
                    "created_at": now,
                    "updated_at": now,
                },
            )
            connection.execute(
                text(
                    """
                    INSERT INTO inner_cards (
                        id, outer_card_id, expression, reading, meaning,
                        usage_note, notes, sort_order, created_at, updated_at
                    ) VALUES (
                        :id, :outer_card_id, :expression, NULL, :meaning,
                        NULL, NULL, 0, :created_at, :updated_at
                    )
                    """
                ),
                {
                    "id": inner_id.hex,
                    "outer_card_id": outer_id.hex,
                    "expression": "既存の例",
                    "meaning": "existing example",
                    "created_at": now,
                    "updated_at": now,
                },
            )
    finally:
        engine.dispose()

    command.upgrade(config, "head")
    assert current_revision(sqlite_url) == DECK_REVISION

    migrated_engine = create_database_engine(sqlite_url)
    try:
        with migrated_engine.connect() as connection:
            decks = (
                connection.execute(text("SELECT id, name FROM decks ORDER BY created_at, id"))
                .mappings()
                .all()
            )
            migrated_outer = (
                connection.execute(
                    text("SELECT id, deck_id FROM outer_cards WHERE id = :id"),
                    {"id": outer_id.hex},
                )
                .mappings()
                .one()
            )
            migrated_inner = (
                connection.execute(
                    text("SELECT id, outer_card_id FROM inner_cards WHERE id = :id"),
                    {"id": inner_id.hex},
                )
                .mappings()
                .one()
            )
            foreign_key_errors = connection.exec_driver_sql("PRAGMA foreign_key_check").all()

        assert len(decks) == 1
        assert decks[0]["name"] == "Uncategorized"
        assert migrated_outer["deck_id"] == decks[0]["id"]
        assert migrated_inner["outer_card_id"] == outer_id.hex
        assert foreign_key_errors == []
    finally:
        migrated_engine.dispose()

    command.downgrade(config, FLASHCARD_REVISION)
    downgraded_engine = create_database_engine(sqlite_url)
    try:
        with downgraded_engine.connect() as connection:
            assert (
                connection.execute(
                    text("SELECT term FROM outer_cards WHERE id = :id"),
                    {"id": outer_id.hex},
                ).scalar_one()
                == "既存"
            )
            assert (
                connection.execute(
                    text("SELECT expression FROM inner_cards WHERE id = :id"),
                    {"id": inner_id.hex},
                ).scalar_one()
                == "既存の例"
            )
    finally:
        downgraded_engine.dispose()

    command.upgrade(config, "head")
    assert current_revision(sqlite_url) == DECK_REVISION
    reapplied_engine = create_database_engine(sqlite_url)
    try:
        with reapplied_engine.connect() as connection:
            assert connection.execute(text("SELECT count(*) FROM decks")).scalar_one() == 1
            assert (
                connection.execute(
                    text("SELECT count(*) FROM outer_cards WHERE deck_id IS NOT NULL")
                ).scalar_one()
                == 1
            )
            assert connection.execute(text("SELECT count(*) FROM inner_cards")).scalar_one() == 1
            assert connection.exec_driver_sql("PRAGMA foreign_key_check").all() == []
    finally:
        reapplied_engine.dispose()
