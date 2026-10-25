"""Add issue fields, comments, sharing

Revision ID: 7d3f9a1c5e2b
Revises: fe56fa70289e
Create Date: 2026-07-26 23:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '7d3f9a1c5e2b'
down_revision = 'fe56fa70289e'
branch_labels = None
depends_on = None


def upgrade():
    # Rename the generic template table to what it now represents.
    # Existing constraint/index names (e.g. item_pkey) are left as-is by
    # Postgres; they still work, just keep the old "item" prefix.
    op.rename_table('item', 'issue')

    op.add_column(
        'issue',
        sa.Column(
            'status',
            sqlmodel.sql.sqltypes.AutoString(length=20),
            nullable=False,
            server_default='Open',
        ),
    )
    op.add_column(
        'issue',
        sa.Column('priority', sa.Integer(), nullable=False, server_default='3'),
    )
    op.add_column(
        'issue',
        sa.Column('assignee_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        'issue', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.create_foreign_key(
        'issue_assignee_id_fkey',
        'issue',
        'user',
        ['assignee_id'],
        ['id'],
        ondelete='SET NULL',
    )

    # Drop the server defaults now that Alembic has backfilled existing
    # rows; the application always supplies status/priority explicitly.
    op.alter_column('issue', 'status', server_default=None)
    op.alter_column('issue', 'priority', server_default=None)

    op.create_table(
        'comment',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('issue_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            'content', sqlmodel.sql.sqltypes.AutoString(length=2000), nullable=False
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['author_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['issue_id'], ['issue.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'issueshare',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('issue_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('can_edit_status', sa.Boolean(), nullable=False),
        sa.Column('can_edit_assignee', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['issue_id'], ['issue.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('issue_id', 'user_id', name='uq_issue_user_share'),
    )


def downgrade():
    op.drop_table('issueshare')
    op.drop_table('comment')

    op.drop_constraint('issue_assignee_id_fkey', 'issue', type_='foreignkey')
    op.drop_column('issue', 'updated_at')
    op.drop_column('issue', 'assignee_id')
    op.drop_column('issue', 'priority')
    op.drop_column('issue', 'status')

    op.rename_table('issue', 'item')
