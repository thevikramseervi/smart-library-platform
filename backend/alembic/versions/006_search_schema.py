"""Search schema: book_embeddings, FTS search_vector, trigram indexes."""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "006_search_schema"
down_revision: Union[str, None] = "005_enable_pgvector"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

embedding_status = postgresql.ENUM(
    "PENDING",
    "INDEXED",
    "FAILED",
    name="embeddingstatus",
    create_type=False,
)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    embedding_status.create(op.get_bind(), checkfirst=True)

    op.add_column("books", sa.Column("search_vector", postgresql.TSVECTOR(), nullable=True))

    op.execute(
        """
        CREATE TABLE book_embeddings (
            book_id UUID NOT NULL PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
            embedding vector(1024),
            embedding_status embeddingstatus NOT NULL DEFAULT 'PENDING',
            content_hash CHAR(64) NOT NULL,
            model_name VARCHAR(100),
            model_version VARCHAR(50),
            last_error TEXT,
            indexed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )

    op.execute(
        """
        CREATE INDEX ix_books_search_vector
        ON books USING GIN (search_vector)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX ix_book_embeddings_embedding_hnsw
        ON book_embeddings USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )
    op.execute(
        """
        CREATE INDEX ix_book_embeddings_indexed
        ON book_embeddings (book_id)
        WHERE embedding_status = 'INDEXED' AND embedding IS NOT NULL
        """
    )
    op.execute(
        """
        CREATE INDEX ix_books_title_trgm
        ON books USING GIN (title gin_trgm_ops)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX ix_authors_name_trgm
        ON authors USING GIN (name gin_trgm_ops)
        WHERE deleted_at IS NULL
        """
    )
    op.execute(
        """
        CREATE INDEX ix_categories_name_trgm
        ON categories USING GIN (name gin_trgm_ops)
        WHERE deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_categories_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_authors_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_books_title_trgm")
    op.execute("DROP INDEX IF EXISTS ix_book_embeddings_indexed")
    op.execute("DROP INDEX IF EXISTS ix_book_embeddings_embedding_hnsw")
    op.execute("DROP INDEX IF EXISTS ix_books_search_vector")
    op.drop_table("book_embeddings")
    op.drop_column("books", "search_vector")
    embedding_status.drop(op.get_bind(), checkfirst=True)
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
