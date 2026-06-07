"""Circulation schema: transactions, reservations, fines."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "003_circulation_schema"
down_revision: Union[str, None] = "002_catalog_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

transaction_status = postgresql.ENUM(
    "ISSUED",
    "RETURNED",
    name="transactionstatus",
    create_type=False,
)

reservation_status = postgresql.ENUM(
    "ACTIVE",
    "FULFILLED",
    "CANCELLED",
    "EXPIRED",
    name="reservationstatus",
    create_type=False,
)


def upgrade() -> None:
    transaction_status.create(op.get_bind(), checkfirst=True)
    reservation_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "transactions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("book_copy_id", sa.UUID(), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("issued_by", sa.UUID(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_at", sa.Date(), nullable=False),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", transaction_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["book_copy_id"], ["book_copies.id"]),
        sa.ForeignKeyConstraint(["issued_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_student_id_status", "transactions", ["student_id", "status"])
    op.create_index("ix_transactions_due_at", "transactions", ["due_at"])
    op.create_index("ix_transactions_status", "transactions", ["status"])
    op.create_index(
        "uq_transactions_one_open_loan_per_copy",
        "transactions",
        ["book_copy_id"],
        unique=True,
        postgresql_where=sa.text("status = 'ISSUED'"),
    )

    op.create_table(
        "reservations",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("student_id", sa.UUID(), nullable=False),
        sa.Column("book_id", sa.UUID(), nullable=False),
        sa.Column("reservation_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expiry_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", reservation_status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"]),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_reservations_book_id_status_date",
        "reservations",
        ["book_id", "status", "reservation_date"],
    )
    op.create_index(
        "uq_reservations_one_active_per_student_book",
        "reservations",
        ["student_id", "book_id"],
        unique=True,
        postgresql_where=sa.text("status = 'ACTIVE'"),
    )

    op.create_table(
        "fines",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("paid", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("transaction_id"),
    )
    op.create_index("ix_fines_paid", "fines", ["paid"])


def downgrade() -> None:
    op.drop_index("ix_fines_paid", table_name="fines")
    op.drop_table("fines")
    op.drop_index("uq_reservations_one_active_per_student_book", table_name="reservations")
    op.drop_index("ix_reservations_book_id_status_date", table_name="reservations")
    op.drop_table("reservations")
    op.drop_index("uq_transactions_one_open_loan_per_copy", table_name="transactions")
    op.drop_index("ix_transactions_status", table_name="transactions")
    op.drop_index("ix_transactions_due_at", table_name="transactions")
    op.drop_index("ix_transactions_student_id_status", table_name="transactions")
    op.drop_table("transactions")
    reservation_status.drop(op.get_bind(), checkfirst=True)
    transaction_status.drop(op.get_bind(), checkfirst=True)
