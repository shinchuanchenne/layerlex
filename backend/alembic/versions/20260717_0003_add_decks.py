"""Add decks and assign every outer card to one deck.

Revision ID: 20260717_0003
Revises: 20260714_0002
Create Date: 2026-07-17
"""

from collections.abc import Sequence
from datetime import UTC, datetime
from uuid import uuid4

import sqlalchemy as sa

from alembic import context, op

revision: str = "20260717_0003"
down_revision: str | Sequence[str] | None = "20260714_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEFAULT_DECK_NAME = "Uncategorized"


def _disable_sqlite_foreign_keys_for_batch_rebuild() -> None:
    if context.is_offline_mode():
        return
    connection = op.get_bind()
    if connection.dialect.name == "sqlite":
        connection.exec_driver_sql("PRAGMA foreign_keys=OFF")


def _outer_cards_copy_table(
    *,
    deck_id_nullable: bool,
    include_deck_foreign_key: bool,
    include_deck_index: bool,
) -> sa.Table:
    metadata = sa.MetaData()
    constraints: list[sa.ForeignKeyConstraint] = []
    if include_deck_foreign_key:
        constraints.append(
            sa.ForeignKeyConstraint(
                ["deck_id"],
                ["decks.id"],
                name="fk_outer_cards_deck_id_decks",
                ondelete="RESTRICT",
            )
        )

    table = sa.Table(
        "outer_cards",
        metadata,
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("term", sa.String(), nullable=False),
        sa.Column("reading", sa.String(), nullable=True),
        sa.Column("part_of_speech", sa.String(), nullable=True),
        sa.Column("meaning", sa.Text(), nullable=False),
        sa.Column("jlpt_level", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deck_id", sa.Uuid(), nullable=deck_id_nullable),
        sa.PrimaryKeyConstraint("id"),
        *constraints,
    )
    sa.Index("ix_outer_cards_sort_order", table.c.sort_order)
    if include_deck_index:
        sa.Index(
            "ix_outer_cards_deck_id_sort_order",
            table.c.deck_id,
            table.c.sort_order,
        )
    return table


def upgrade() -> None:
    _disable_sqlite_foreign_keys_for_batch_rebuild()

    op.create_table(
        "decks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_decks_sort_order", "decks", ["sort_order"], unique=False)

    default_deck_id = uuid4()
    now = datetime.now(UTC)
    decks = sa.table(
        "decks",
        sa.column("id", sa.Uuid()),
        sa.column("name", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("sort_order", sa.Integer()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.get_bind().execute(
        decks.insert().values(
            id=default_deck_id,
            name=DEFAULT_DECK_NAME,
            description=None,
            sort_order=0,
            created_at=now,
            updated_at=now,
        )
    )

    op.add_column("outer_cards", sa.Column("deck_id", sa.Uuid(), nullable=True))
    outer_cards = sa.table(
        "outer_cards",
        sa.column("deck_id", sa.Uuid()),
    )
    op.get_bind().execute(outer_cards.update().values(deck_id=default_deck_id))

    with op.batch_alter_table(
        "outer_cards",
        recreate="always",
        copy_from=_outer_cards_copy_table(
            deck_id_nullable=True,
            include_deck_foreign_key=False,
            include_deck_index=False,
        ),
    ) as batch_op:
        batch_op.alter_column(
            "deck_id",
            existing_type=sa.Uuid(),
            nullable=False,
        )
        batch_op.create_foreign_key(
            "fk_outer_cards_deck_id_decks",
            "decks",
            ["deck_id"],
            ["id"],
            ondelete="RESTRICT",
        )
        batch_op.create_index(
            "ix_outer_cards_deck_id_sort_order",
            ["deck_id", "sort_order"],
            unique=False,
        )


def downgrade() -> None:
    _disable_sqlite_foreign_keys_for_batch_rebuild()

    with op.batch_alter_table(
        "outer_cards",
        recreate="always",
        copy_from=_outer_cards_copy_table(
            deck_id_nullable=False,
            include_deck_foreign_key=True,
            include_deck_index=True,
        ),
    ) as batch_op:
        batch_op.drop_index("ix_outer_cards_deck_id_sort_order")
        batch_op.drop_constraint(
            "fk_outer_cards_deck_id_decks",
            type_="foreignkey",
        )
        batch_op.drop_column("deck_id")

    op.drop_index("ix_decks_sort_order", table_name="decks")
    op.drop_table("decks")
