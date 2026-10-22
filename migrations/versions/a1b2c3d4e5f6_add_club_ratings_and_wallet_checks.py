"""add_club_ratings_and_wallet_checks

Revision ID: a1b2c3d4e5f6
Revises: 521066babd26
Create Date: 2026-10-22 19:22:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '521066babd26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clubs', sa.Column('attack_rating', sa.Float(), server_default='1.0', nullable=False))
    op.add_column('clubs', sa.Column('defense_rating', sa.Float(), server_default='1.0', nullable=False))
    op.create_check_constraint(
        'ck_wallets_available_non_negative',
        'wallets',
        'available_minor >= 0',
    )
    op.create_check_constraint(
        'ck_wallets_reserved_non_negative',
        'wallets',
        'reserved_minor >= 0',
    )


def downgrade() -> None:
    op.drop_constraint('ck_wallets_reserved_non_negative', 'wallets', type_='check')
    op.drop_constraint('ck_wallets_available_non_negative', 'wallets', type_='check')
    op.drop_column('clubs', 'defense_rating')
    op.drop_column('clubs', 'attack_rating')
