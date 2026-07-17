from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, inspect
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import Deck, InnerCard, OuterCard
from tests.conftest import TEST_DECK_ID


def test_sqlite_connection_pragmas(sqlite_engine: Engine) -> None:
    with sqlite_engine.connect() as connection:
        foreign_keys = connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one()
        journal_mode = connection.exec_driver_sql("PRAGMA journal_mode").scalar_one()
        busy_timeout = connection.exec_driver_sql("PRAGMA busy_timeout").scalar_one()

    assert foreign_keys == 1
    assert journal_mode == "wal"
    assert busy_timeout == 5000


def test_deck_uuid_defaults_relationship_and_persistence(sqlite_engine: Engine) -> None:
    deck = Deck(name="Lesson 13")
    outer_card = OuterCard(
        deck_id=deck.id,
        term="経験",
        meaning="經驗",
    )
    deck.outer_cards.append(outer_card)

    assert isinstance(deck.id, UUID)
    assert deck.description is None
    assert deck.sort_order == 0
    assert deck.created_at.tzinfo is not None
    assert deck.updated_at.tzinfo is not None

    with Session(sqlite_engine) as session:
        session.add(deck)
        session.commit()
        session.expire_all()

        stored_deck = session.get(Deck, deck.id)
        assert stored_deck is not None
        assert isinstance(stored_deck.id, UUID)
        assert [card.id for card in stored_deck.outer_cards] == [outer_card.id]
        assert stored_deck.outer_cards[0].deck.id == stored_deck.id


def test_database_restricts_deleting_a_non_empty_deck(sqlite_engine: Engine) -> None:
    deck = Deck(name="Lesson 14")
    outer_card = OuterCard(
        deck_id=deck.id,
        term="予定",
        meaning="預定",
    )

    with Session(sqlite_engine) as session:
        session.add(deck)
        session.add(outer_card)
        session.commit()
        with pytest.raises(IntegrityError):
            session.execute(delete(Deck).where(Deck.id == deck.id))
            session.commit()


def test_uuid_defaults_optional_fields_and_persistence(sqlite_engine: Engine) -> None:
    outer_card = OuterCard(
        deck_id=TEST_DECK_ID,
        term="スケジュール",
        meaning="行程、計畫",
    )

    assert isinstance(outer_card.id, UUID)
    assert outer_card.sort_order == 0
    assert outer_card.reading is None
    assert outer_card.part_of_speech is None
    assert outer_card.jlpt_level is None
    assert outer_card.notes is None
    assert outer_card.created_at.utcoffset() == UTC.utcoffset(outer_card.created_at)
    assert outer_card.updated_at.utcoffset() == UTC.utcoffset(outer_card.updated_at)

    original_id = outer_card.id
    with Session(sqlite_engine) as session:
        session.add(outer_card)
        session.commit()
        session.refresh(outer_card)

        assert outer_card.id == original_id
        assert isinstance(outer_card.id, UUID)
        assert outer_card.created_at.tzinfo is not None
        assert outer_card.updated_at.tzinfo is not None


def test_inner_card_defaults_and_relationship(sqlite_engine: Engine) -> None:
    outer_card = OuterCard(deck_id=TEST_DECK_ID, term="経験", meaning="經驗")
    inner_card = InnerCard(
        outer_card_id=outer_card.id,
        expression="経験を積む",
        meaning="累積經驗",
    )
    outer_card.inner_cards.append(inner_card)
    inner_id = inner_card.id

    assert isinstance(inner_card.id, UUID)
    assert inner_card.sort_order == 0
    assert inner_card.reading is None
    assert inner_card.usage_note is None
    assert inner_card.notes is None

    with Session(sqlite_engine) as session:
        session.add(outer_card)
        session.commit()
        session.expire_all()

        stored_outer = session.get(OuterCard, outer_card.id)
        assert stored_outer is not None
        assert [card.expression for card in stored_outer.inner_cards] == ["経験を積む"]
        stored_inner = stored_outer.inner_cards[0]
        assert stored_inner.id == inner_id
        assert isinstance(stored_inner.id, UUID)
        assert stored_inner.created_at.tzinfo is not None
        assert stored_inner.updated_at.tzinfo is not None
        assert stored_inner.outer_card.id == stored_outer.id


def test_required_and_optional_database_columns(sqlite_engine: Engine) -> None:
    inspector = inspect(sqlite_engine)
    outer_columns = {column["name"]: column for column in inspector.get_columns("outer_cards")}
    inner_columns = {column["name"]: column for column in inspector.get_columns("inner_cards")}

    deck_columns = {column["name"]: column for column in inspector.get_columns("decks")}

    for column_name in ("id", "name", "sort_order", "created_at", "updated_at"):
        assert deck_columns[column_name]["nullable"] is False
    assert deck_columns["description"]["nullable"] is True

    for column_name in (
        "id",
        "deck_id",
        "term",
        "meaning",
        "sort_order",
        "created_at",
        "updated_at",
    ):
        assert outer_columns[column_name]["nullable"] is False
    for column_name in ("reading", "part_of_speech", "jlpt_level", "notes"):
        assert outer_columns[column_name]["nullable"] is True

    for column_name in (
        "id",
        "outer_card_id",
        "expression",
        "meaning",
        "sort_order",
        "created_at",
        "updated_at",
    ):
        assert inner_columns[column_name]["nullable"] is False
    for column_name in ("reading", "usage_note", "notes"):
        assert inner_columns[column_name]["nullable"] is True


def test_updated_at_changes_on_orm_update(sqlite_engine: Engine) -> None:
    outer_card = OuterCard(
        deck_id=TEST_DECK_ID,
        term="確認",
        meaning="確認",
        updated_at=datetime(2000, 1, 1, tzinfo=UTC),
    )

    with Session(sqlite_engine) as session:
        session.add(outer_card)
        session.commit()
        session.refresh(outer_card)
        old_updated_at = outer_card.updated_at

        outer_card.term = "確認する"
        session.add(outer_card)
        session.commit()
        session.refresh(outer_card)

        assert outer_card.updated_at > old_updated_at
        assert outer_card.updated_at.tzinfo is not None


def test_inner_card_requires_an_existing_outer_card(sqlite_engine: Engine) -> None:
    orphan = InnerCard(
        outer_card_id=uuid4(),
        expression="存在しない例",
        meaning="不存在的例子",
    )

    with Session(sqlite_engine) as session:
        session.add(orphan)
        with pytest.raises(IntegrityError):
            session.commit()


def test_orm_cascade_deletes_inner_cards(sqlite_engine: Engine) -> None:
    outer_card = OuterCard(deck_id=TEST_DECK_ID, term="必要", meaning="必要")
    inner_card = InnerCard(
        outer_card_id=outer_card.id,
        expression="必要になる",
        meaning="變得有必要",
    )
    outer_card.inner_cards.append(inner_card)

    with Session(sqlite_engine) as session:
        session.add(outer_card)
        session.commit()
        outer_id = outer_card.id
        inner_id = inner_card.id
        session.expire_all()

        stored_outer = session.get(OuterCard, outer_id)
        assert stored_outer is not None
        assert len(stored_outer.inner_cards) == 1
        session.delete(stored_outer)
        session.commit()

        assert session.get(InnerCard, inner_id) is None


def test_database_cascade_deletes_inner_cards(sqlite_engine: Engine) -> None:
    outer_card = OuterCard(deck_id=TEST_DECK_ID, term="予定", meaning="預定")
    inner_card = InnerCard(
        outer_card_id=outer_card.id,
        expression="予定を変更する",
        meaning="變更預定",
    )

    with Session(sqlite_engine) as session:
        session.add(outer_card)
        session.add(inner_card)
        session.commit()
        outer_id = outer_card.id
        inner_id = inner_card.id

    with sqlite_engine.begin() as connection:
        connection.execute(delete(OuterCard).where(OuterCard.id == outer_id))

    with Session(sqlite_engine) as session:
        assert session.get(InnerCard, inner_id) is None


def test_sort_order_indexes_are_non_unique(sqlite_engine: Engine) -> None:
    inspector = inspect(sqlite_engine)
    outer_indexes = {index["name"]: index for index in inspector.get_indexes("outer_cards")}
    inner_indexes = {index["name"]: index for index in inspector.get_indexes("inner_cards")}

    outer_index = outer_indexes["ix_outer_cards_sort_order"]
    assert outer_index["column_names"] == ["sort_order"]
    assert outer_index["unique"] == 0
    deck_outer_index = outer_indexes["ix_outer_cards_deck_id_sort_order"]
    assert deck_outer_index["column_names"] == ["deck_id", "sort_order"]
    assert deck_outer_index["unique"] == 0

    inner_index = inner_indexes["ix_inner_cards_outer_card_id_sort_order"]
    assert inner_index["column_names"] == ["outer_card_id", "sort_order"]
    assert inner_index["unique"] == 0


def test_relationship_query_returns_inner_cards_in_the_deck(sqlite_engine: Engine) -> None:
    outer_card = OuterCard(deck_id=TEST_DECK_ID, term="変更", meaning="變更")
    first = InnerCard(
        outer_card_id=outer_card.id,
        expression="予定を変更する",
        meaning="變更預定",
        sort_order=1,
    )
    second = InnerCard(
        outer_card_id=outer_card.id,
        expression="スケジュールを変更する",
        meaning="變更行程",
        sort_order=2,
    )

    with Session(sqlite_engine) as session:
        session.add(outer_card)
        session.add(first)
        session.add(second)
        session.commit()

        cards = session.exec(
            select(InnerCard).where(InnerCard.outer_card_id == outer_card.id)
        ).all()

    assert {card.id for card in cards} == {first.id, second.id}
