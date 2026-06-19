"""Add is_sample column to state_machines

Revision ID: b1c2d3e4f5a6
Revises: ab6544076cfa
Create Date: 2026-06-19 08:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'ab6544076cfa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('state_machines', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                'is_sample',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('0'),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table('state_machines', schema=None) as batch_op:
        batch_op.drop_column('is_sample')
