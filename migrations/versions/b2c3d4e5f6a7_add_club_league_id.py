"""add_club_league_id

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-22 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clubs', sa.Column('league_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_clubs_league_id'), 'clubs', ['league_id'], unique=False)
    op.create_foreign_key(
        'fk_clubs_league_id_leagues',
        'clubs',
        'leagues',
        ['league_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_clubs_league_id_leagues', 'clubs', type_='foreignkey')
    op.drop_index(op.f('ix_clubs_league_id'), table_name='clubs')
    op.drop_column('clubs', 'league_id')
