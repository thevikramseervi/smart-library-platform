"""Database queries for personalized book recommendations."""

from collections import defaultdict
from uuid import UUID

from sqlalchemy import case, delete, func, literal, select, union
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.book import Book
from app.models.book_category import BookCategory
from app.models.book_copy import BookCopy, BookCopyStatus
from app.models.book_embedding import BookEmbedding, EmbeddingStatus
from app.models.category import Category
from app.models.rating import Rating
from app.models.recommendation_feedback import RecommendationFeedback
from app.models.transaction import Transaction


class RecommendationRepository:
    """Read student preference signals and active catalog candidates."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_category_preferences(
        self, student_id: UUID
    ) -> tuple[dict[UUID, tuple[str, int]], dict[UUID, tuple[str, int]], dict[UUID, int]]:
        """Return separate category preferences from ratings, likes, and borrowing."""
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
            select(literal("ratings"), Category.id, Category.name, rating_signal)
            .select_from(Rating)
            .join(BookCategory, BookCategory.book_id == Rating.book_id)
            .join(Category, Category.id == BookCategory.category_id)
            .where(Rating.student_id == student_id, Category.deleted_at.is_(None))
            .group_by(Category.id, Category.name)
        )
        liked_category_statement = (
            select(
                literal("likes"),
                Category.id,
                Category.name,
                func.count(func.distinct(RecommendationFeedback.book_id)),
            )
            .select_from(RecommendationFeedback)
            .join(BookCategory, BookCategory.book_id == RecommendationFeedback.book_id)
            .join(Category, Category.id == BookCategory.category_id)
            .where(
                RecommendationFeedback.student_id == student_id,
                RecommendationFeedback.signal == "LIKE",
                Category.deleted_at.is_(None),
            )
            .group_by(Category.id, Category.name)
        )
        borrow_signal = func.count(func.distinct(Transaction.id))
        borrow_statement = (
            select(literal("borrowing"), Category.id, Category.name, borrow_signal)
            .select_from(Transaction)
            .join(BookCopy, BookCopy.id == Transaction.book_copy_id)
            .join(BookCategory, BookCategory.book_id == BookCopy.book_id)
            .join(Category, Category.id == BookCategory.category_id)
            .where(Transaction.student_id == student_id, Category.deleted_at.is_(None))
            .group_by(Category.id, Category.name)
        )
        rating_preferences: dict[UUID, tuple[str, int]] = {}
        like_preferences: dict[UUID, tuple[str, int]] = {}
        borrow_preferences: dict[UUID, int] = {}
        for signal, category_id, name, score in self.db.execute(
            ratings_statement.union_all(liked_category_statement, borrow_statement)
        ):
            if signal == "ratings":
                rating_preferences[category_id] = (name, int(score or 0))
            elif signal == "likes":
                like_preferences[category_id] = (name, int(score or 0))
            else:
                borrow_preferences[category_id] = int(score or 0)
        return rating_preferences, like_preferences, borrow_preferences

    def list_interacted_book_ids(self, student_id: UUID) -> set[UUID]:
        """Return rated, borrowed, or dismissed books to leave out of suggestions."""
        statement = union(
            select(Rating.book_id).where(Rating.student_id == student_id),
            select(BookCopy.book_id)
            .join(Transaction, Transaction.book_copy_id == BookCopy.id)
            .where(Transaction.student_id == student_id),
            select(RecommendationFeedback.book_id).where(
                RecommendationFeedback.student_id == student_id,
                RecommendationFeedback.signal == "DISMISS",
            ),
        )
        return set(self.db.execute(statement).scalars())

    def feedback_signals(self, student_id: UUID) -> dict[UUID, str]:
        """Return explicit feedback so the UI can show saved likes on their cards."""
        statement = select(RecommendationFeedback.book_id, RecommendationFeedback.signal).where(
            RecommendationFeedback.student_id == student_id
        )
        return dict(self.db.execute(statement).all())

    def get_positive_seed_weights(self, student_id: UUID) -> dict[UUID, float]:
        """Return combined positive rating, like, and borrowing semantic seeds."""
        by_signal = self.get_positive_seed_weights_by_signal(student_id)
        combined: dict[UUID, float] = {}
        for weights in by_signal.values():
            for book_id, weight in weights.items():
                combined[book_id] = max(combined.get(book_id, 0.0), weight)
        return combined

    def get_positive_seed_weights_by_signal(self, student_id: UUID) -> dict[str, dict[UUID, float]]:
        """Return separate semantic seed strengths for ratings, likes, and borrowing."""
        ratings_statement = select(
            literal("ratings"), Rating.book_id, Rating.score
        ).where(Rating.student_id == student_id)
        borrowing_statement = (
            select(
                literal("borrowing"),
                BookCopy.book_id,
                func.count(func.distinct(Transaction.id)),
            )
            .select_from(Transaction)
            .join(BookCopy, BookCopy.id == Transaction.book_copy_id)
            .where(Transaction.student_id == student_id)
            .group_by(BookCopy.book_id)
        )
        likes_statement = select(
            literal("likes"), RecommendationFeedback.book_id, literal(1)
        ).where(
            RecommendationFeedback.student_id == student_id,
            RecommendationFeedback.signal == "LIKE",
        )
        ratings: dict[UUID, int] = {}
        borrowed_counts: dict[UUID, int] = {}
        liked_ids: list[UUID] = []
        for signal, book_id, value in self.db.execute(
            ratings_statement.union_all(borrowing_statement, likes_statement)
        ):
            if signal == "ratings":
                ratings[book_id] = int(value)
            elif signal == "borrowing":
                borrowed_counts[book_id] = int(value)
            else:
                liked_ids.append(book_id)
        rated_weights = {
            book_id: (1.0 if score == 4 else 1.5)
            for book_id, score in ratings.items()
            if score >= 4
        }
        borrowed_weights: dict[UUID, float] = {}
        for book_id, count in borrowed_counts.items():
            # A low rating is an explicit negative signal; do not use it as a seed.
            # Unrated books are not negative: borrowing one is a useful positive signal.
            if book_id in ratings and ratings[book_id] <= 2:
                continue
            borrowed_weights[book_id] = 0.5 + min(int(count), 3) * 0.1
        liked_weights = {book_id: 1.2 for book_id in liked_ids}
        return {
            "ratings": rated_weights,
            "likes": liked_weights,
            "borrowing": borrowed_weights,
        }

    def upsert_feedback(self, *, student_id: UUID, book_id: UUID, signal: str) -> None:
        """Create or replace one explicit preference for a student and title."""
        statement = (
            pg_insert(RecommendationFeedback)
            .values(student_id=student_id, book_id=book_id, signal=signal)
            .on_conflict_do_update(
                constraint="uq_recommendation_feedback_student_book",
                set_={"signal": signal, "updated_at": func.now()},
            )
        )
        self.db.execute(statement)

    def delete_feedback(self, *, student_id: UUID, book_id: UUID) -> int:
        """Remove explicit feedback so the title can be considered again."""
        statement = delete(RecommendationFeedback).where(
            RecommendationFeedback.student_id == student_id,
            RecommendationFeedback.book_id == book_id,
        )
        return self.db.execute(statement).rowcount

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
                joinedload(Book.publisher),
                joinedload(Book.language),
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

    def rating_summaries(self) -> tuple[dict[UUID, float], dict[UUID, int]]:
        """Return average star scores and counts with one grouped query."""
        statement = select(
            Rating.book_id,
            func.avg(Rating.score),
            func.count(Rating.id),
        ).group_by(Rating.book_id)
        averages: dict[UUID, float] = {}
        counts: dict[UUID, int] = {}
        for book_id, average, count in self.db.execute(statement):
            averages[book_id] = float(average)
            counts[book_id] = int(count)
        return averages, counts

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
