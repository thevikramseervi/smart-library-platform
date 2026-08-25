"""Resize embeddings for the bge-small-en-v1.5 model (384 dimensions).

Switching from the planned BGE-M3 layout to FastEmbed's quantized ONNX
model keeps indexing inside small memory budgets. Any previously stored
vectors belong to a different model and are invalidated by definition,
so they are dropped along with their INDEXED state.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "011_embedding_384_dims"
down_revision: Union[str, None] = "010_transaction_returned_by"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_book_embeddings_embedding_hnsw")
    op.execute("UPDATE book_embeddings SET embedding = NULL")
    op.execute(
        "UPDATE book_embeddings"
        " SET embedding_status = 'PENDING', model_name = NULL,"
        " model_version = NULL, indexed_at = NULL"
    )
    op.execute("ALTER TABLE book_embeddings ALTER COLUMN embedding TYPE vector(384)")
    op.execute(
        "CREATE INDEX ix_book_embeddings_embedding_hnsw"
        " ON book_embeddings USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_book_embeddings_embedding_hnsw")
    op.execute("UPDATE book_embeddings SET embedding = NULL")
    op.execute(
        "UPDATE book_embeddings"
        " SET embedding_status = 'PENDING', model_name = NULL,"
        " model_version = NULL, indexed_at = NULL"
    )
    op.execute("ALTER TABLE book_embeddings ALTER COLUMN embedding TYPE vector(1024)")
    op.execute(
        "CREATE INDEX ix_book_embeddings_embedding_hnsw"
        " ON book_embeddings USING hnsw (embedding vector_cosine_ops)"
    )
