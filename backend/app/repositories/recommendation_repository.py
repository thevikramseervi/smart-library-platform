"""Database queries for personalized book recommendations."""

from collections import defaultdict
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.book import Book
from app.models.book_category import BookCategory
from app.models.book_copy import BookCopy, BookCopyStatus
from app.models.book_embedding import BookEmbedding, EmbeddingStatus
from app.models.category import Category
from app.models.rating import Rating
from app.models.transaction import Transaction


class RecommendationRepository:
    """Read student preference signals and active catalog candidates."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_category_preferences(
        self, student_id: UUID
    ) -> tuple[dict[UUID, tuple[str, int]], dict[UUID, int]]:
        """Return net rating scores and borrow counts for each category."""
        rating_signal = func.sum(
            case(
                (Rating.score == 5, 2),
                (Rating.score == 4, 1),
                (Rating.score == 2, -1),
                (Rating.score == 1, -2),
                else_=0,
            )
        )
        ratings_statement = (
            select(Category.id, Category.name, rating_signal)
            .select_from(Rating)
            .join(BookCategory, BookCategory.book_id == Rating.book_id)
            .join(Category, Category.id == BookCategory.category_id)
            .where(Rating.student_id == student_id, Category.deleted_at.is_(None))
            .group_by(Category.id, Category.name)
        )
        rating_preferences = {
            category_id: (name, int(score or 0))
            for category_id, name, score in self.db.execute(ratings_statement)
        }

        borrow_signal = func.count(func.distinct(Transaction.id))
        borrow_statement = (
            select(BookCategory.category_id, borrow_signal)
            .select_from(Transaction)
            .join(BookCopy, BookCopy.id == Transaction.book_copy_id)
            .join(BookCategory, BookCategory.book_id == BookCopy.book_id)
            .join(Category, Category.id == BookCategory.category_id)
            .where(Transaction.student_id == student_id, Category.deleted_at.is_(None))
            .group_by(BookCategory.category_id)
        )
        borrow_preferences = {
            category_id: int(count) for category_id, count in self.db.execute(borrow_statement)
        }
        return rating_preferences, borrow_preferences

    def list_interacted_book_ids(self, student_id: UUID) -> set[UUID]:
        """Return books the student has rated or borrowed, to avoid repeats."""
        rated_ids = self.db.execute(
            select(Rating.book_id).where(Rating.student_id == student_id)
        ).scalars()
        borrowed_ids = self.db.execute(
            select(BookCopy.book_id)
            .join(Transaction, Transaction.book_copy_id == BookCopy.id)
            .where(Transaction.student_id == student_id)
        ).scalars()
        return set(rated_ids).union(borrowed_ids)

    def get_positive_seed_weights(self, student_id: UUID) -> dict[UUID, float]:
        """Return positive rating and borrowing signals for semantic seeds."""
        ratings = dict(
            self.db.execute(
                select(Rating.book_id, Rating.score).where(Rating.student_id == student_id)
            ).all()
        )
        weights = {
            book_id: (1.0 if score == 4 else 1.5)
            for book_id, score in ratings.items()
            if score >= 4
        }
        borrowed = self.db.execute(
            select(BookCopy.book_id, func.count(func.distinct(Transaction.id)))
            .join(Transaction, Transaction.book_copy_id == BookCopy.id)
            .where(Transaction.student_id == student_id)
            .group_by(BookCopy.book_id)
        )
        for book_id, count in borrowed:
            # A low rating is an explicit negative signal; do not use it as a seed.
            if ratings.get(book_id, 0) <= 2:
                continue
            weights[book_id] = max(weights.get(book_id, 0.0), 0.5 + min(int(count), 3) * 0.1)
        return weights

    def indexed_vectors(self, model_name: str) -> dict[UUID, list[float]]:
        """Load current-model vectors for active books without invoking inference."""
        statement = (
            select(BookEmbedding.book_id, BookEmbedding.embedding)
            .join(Book, Book.id == BookEmbedding.book_id)
            .where(
                Book.deleted_at.is_(None),
                BookEmbedding.embedding_status == EmbeddingStatus.INDEXED,
                BookEmbedding.embedding.is_not(None),
                BookEmbedding.model_name == model_name,
            )
        )
        return {
            book_id: list(vector)
            for book_id, vector in self.db.execute(statement)
            if vector is not None
        }

    def list_candidate_books(self) -> list[Book]:
        """Return active catalog books with the relations needed for ranking."""
        statement = (
            select(Book)
            .options(
                selectinload(Book.publisher),
                selectinload(Book.language),
                selectinload(Book.authors),
                selectinload(Book.categories),
            )
            .where(Book.deleted_at.is_(None))
        )
        return list(self.db.execute(statement).unique().scalars().all())

    def popularity_counts(self) -> dict[UUID, int]:
        """Count historical issues per title."""
        statement = (
            select(BookCopy.book_id, func.count(Transaction.id))
            .join(Transaction, Transaction.book_copy_id == BookCopy.id)
            .group_by(BookCopy.book_id)
        )
        return {book_id: int(count) for book_id, count in self.db.execute(statement)}

    def rating_averages(self) -> dict[UUID, float]:
        """Return average star scores for titles with ratings."""
        statement = select(Rating.book_id, func.avg(Rating.score)).group_by(Rating.book_id)
        return {book_id: float(average) for book_id, average in self.db.execute(statement)}

    def available_copy_counts(self, book_ids: list[UUID]) -> dict[UUID, int]:
        """Count available copies for a candidate batch."""
        if not book_ids:
            return defaultdict(int)
        statement = (
            select(BookCopy.book_id, func.count(BookCopy.id))
            .where(
                BookCopy.book_id.in_(book_ids),
                BookCopy.status == BookCopyStatus.AVAILABLE,
            )
            .group_by(BookCopy.book_id)
        )
        counts: defaultdict[UUID, int] = defaultdict(int)
        counts.update({book_id: int(count) for book_id, count in self.db.execute(statement)})
        return counts
