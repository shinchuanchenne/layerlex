"""Create outer and inner flashcard tables.

Revision ID: 20260714_0002
Revises: 20260714_0001
Create Date: 2026-07-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260714_0002"
down_revision: str | Sequence[str] | None = "20260714_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "outer_cards",
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_outer_cards_sort_order",
        "outer_cards",
        ["sort_order"],
        unique=False,
    )

    op.create_table(
        "inner_cards",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("outer_card_id", sa.Uuid(), nullable=False),
        sa.Column("expression", sa.Text(), nullable=False),
        sa.Column("reading", sa.String(), nullable=True),
        sa.Column("meaning", sa.Text(), nullable=False),
        sa.Column("usage_note", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["outer_card_id"],
            ["outer_cards.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_inner_cards_outer_card_id_sort_order",
        "inner_cards",
        ["outer_card_id", "sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_inner_cards_outer_card_id_sort_order", table_name="inner_cards")
    op.drop_table("inner_cards")
    op.drop_index("ix_outer_cards_sort_order", table_name="outer_cards")
    op.drop_table("outer_cards")
