"""add due date to issues

Revision ID: 838ea0d64b85
Revises: 7d3f9a1c5e2b
Create Date: 2026-08-01 12:56:47.086345

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "838ea0d64b85"
down_revision = "7d3f9a1c5e2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "issue",
        sa.Column("due_date", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("issue", "due_date")
