"""Allow returned-book and fine-paid notifications."""

from typing import Sequence, Union

from alembic import op

revision: str = "019_return_and_fine_paid_types"
down_revision: Union[str, None] = "018_loan_overdue_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_notifications_type", "notifications", type_="check")
    op.create_check_constraint(
        "ck_notifications_type",
        "notifications",
        "notification_type IN ('BOOK_ISSUED', 'BOOK_RETURNED', 'RESERVATION_READY', "
        "'DUE_SOON', 'LOAN_OVERDUE', 'FINE_RECORDED', 'FINE_PAID')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_notifications_type", "notifications", type_="check")
    op.execute(
        "ALTER TABLE notifications ADD CONSTRAINT ck_notifications_type "
        "CHECK (notification_type IN ('BOOK_ISSUED', 'RESERVATION_READY', 'DUE_SOON', "
        "'LOAN_OVERDUE', 'FINE_RECORDED')) NOT VALID"
    )
