"""Explainable hybrid book recommendations from existing library data."""

from math import log1p, sqrt
from typing import Literal, cast
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.book import Book
from app.models.user import User
from app.repositories.recommendation_repository import RecommendationRepository
from app.schemas.recommendation import (
    BookRecommendationResponse,
    RecommendationFeedbackResponse,
)
from app.services.book_service import BookService


class RecommendationService:
    """Blend semantic similarity, student interests, and library-wide signals."""

    SEMANTIC_WEIGHT = 0.55
    CATEGORY_WEIGHT = 0.25
    POPULARITY_WEIGHT = 0.12
    RATING_WEIGHT = 0.08
    DIVERSITY_PENALTY = 0.18

    def __init__(self, db: Session) -> None:
        self.repository = RecommendationRepository(db)
        self.book_service = BookService(db)

    @staticmethod
    def _cosine(left: list[float], right: list[float]) -> float:
        """Compute cosine similarity safely for two stored embedding vectors."""
        if len(left) != len(right) or not left:
            return 0.0
        dot = sum(a * b for a, b in zip(left, right, strict=True))
        left_norm = sqrt(sum(value * value for value in left))
        right_norm = sqrt(sum(value * value for value in right))
        if not left_norm or not right_norm:
            return 0.0
        # Negative cosine values do not indicate useful recommendation relevance.
        return max(0.0, dot / (left_norm * right_norm))

    @staticmethod
    def _category_interest(
        book: Book,
        rating_preferences: dict[UUID, tuple[str, int]],
        like_preferences: dict[UUID, tuple[str, int]],
        borrow_preferences: dict[UUID, int],
    ) -> float:
        return max(
            0.0,
            sum(
                rating_preferences.get(category.id, ("", 0))[1]
                + like_preferences.get(category.id, ("", 0))[1] * 1.5
                + min(borrow_preferences.get(category.id, 0), 4) * 0.25
                for category in book.categories
                if category.deleted_at is None
            ),
        )

    @staticmethod
    def _semantic_matches(
        book_id: UUID,
        seed_weights: dict[UUID, float],
        vectors: dict[UUID, list[float]],
    ) -> tuple[float, UUID | None]:
        candidate = vectors.get(book_id)
        if candidate is None:
            return 0.0, None
        best_score = 0.0
        best_seed: UUID | None = None
        for seed_id, weight in seed_weights.items():
            if seed_id == book_id:
                continue
            seed = vectors.get(seed_id)
            if seed is None:
                continue
            similarity = RecommendationService._cosine(candidate, seed)
            # Use the strongest positive preference, while keeping the score bounded.
            score = similarity * min(weight / 1.5, 1.0)
            if score > best_score:
                best_score, best_seed = score, seed_id
        return best_score, best_seed

    @staticmethod
    def _signal_reason(
        book: Book,
        *,
        signal: str,
        semantic_seed: UUID | None,
        semantic_score: float,
        book_titles: dict[UUID, str],
        rating_preferences: dict[UUID, tuple[str, int]],
        like_preferences: dict[UUID, tuple[str, int]],
        borrow_preferences: dict[UUID, int],
        rating_averages: dict[UUID, float],
    ) -> str:
        seed_title = book_titles.get(semantic_seed) if semantic_seed is not None else None
        if (
            seed_title is not None
            and seed_title.casefold() != book.title.casefold()
            and semantic_score >= 0.55
        ):
            source_text = {
                "ratings": "a book you rated highly",
                "likes": "a book you liked",
                "borrowing": "a book you borrowed",
            }[signal]
            return f'Similar to "{seed_title}", {source_text}'

        categories = [category for category in book.categories if category.deleted_at is None]
        if signal == "ratings":
            matches = [
                (rating_preferences[category.id][1], rating_preferences[category.id][0])
                for category in categories
                if category.id in rating_preferences and rating_preferences[category.id][1] > 0
            ]
            if matches:
                return f"Because you rated {max(matches)[1]} books highly"
        elif signal == "likes":
            matches = [
                (like_preferences[category.id][1], like_preferences[category.id][0])
                for category in categories
                if category.id in like_preferences
            ]
            if matches:
                return f"More like books you liked in {max(matches)[1]}"
        elif signal == "borrowing":
            matches = [
                (borrow_preferences.get(category.id, 0), category.name)
                for category in categories
                if borrow_preferences.get(category.id, 0) > 0
            ]
            if matches:
                return f"Related to your borrowing in {max(matches)[1]}"
        elif signal == "popular":
            return "Popular with library readers"
        elif signal == "reader_ratings":
            average = rating_averages.get(book.id, 0)
            return f"Highly rated by library readers ({average:.1f}/5)"
        return {
            "ratings": "Based on books you rated highly",
            "likes": "Based on books you liked",
            "borrowing": "Related to your borrowing history",
        }.get(signal, "Recommended for you")

    def get_for_student(self, student: User, *, limit: int = 9) -> list[BookRecommendationResponse]:
        """Return eligible titles in a rotating mix of personalized and library signals."""
        rating_preferences, like_preferences, borrow_preferences = (
            self.repository.get_category_preferences(student.id)
        )
        seed_weights_by_signal = self.repository.get_positive_seed_weights_by_signal(student.id)
        seed_weights: dict[UUID, float] = {}
        for weights in seed_weights_by_signal.values():
            for book_id, weight in weights.items():
                seed_weights[book_id] = max(seed_weights.get(book_id, 0.0), weight)
        interacted_ids = self.repository.list_interacted_book_ids(student.id)
        feedback_signals = self.repository.feedback_signals(student.id)
        all_books = self.repository.list_candidate_books()
        books_by_id = {book.id: book for book in all_books}
        candidates = [book for book in all_books if book.id not in interacted_ids]
        popularity = self.repository.popularity_counts()
        rating_averages, rating_counts = self.repository.rating_summaries()
        available_copies = self.repository.available_copy_counts([book.id for book in candidates])
        candidates = [book for book in candidates if available_copies.get(book.id, 0) > 0]

        vectors = self.repository.indexed_vectors(settings.EMBEDDING_MODEL)
        semantic_by_signal = {
            signal: {
                book.id: self._semantic_matches(book.id, weights, vectors) for book in candidates
            }
            for signal, weights in seed_weights_by_signal.items()
        }
        semantic = {
            book.id: max(
                (matches[book.id] for matches in semantic_by_signal.values()),
                key=lambda match: match[0],
                default=(0.0, None),
            )
            for book in candidates
        }
        category_scores = {
            book.id: self._category_interest(
                book, rating_preferences, like_preferences, borrow_preferences
            )
            for book in candidates
        }
        max_category = max(category_scores.values(), default=0.0)
        max_popularity = max(
            (log1p(popularity.get(book.id, 0)) for book in candidates),
            default=0.0,
        )

        def category_signal(book: Book, signal: str) -> float:
            active_categories = [
                category for category in book.categories if category.deleted_at is None
            ]
            if signal == "ratings":
                return sum(
                    max(rating_preferences.get(category.id, ("", 0))[1], 0)
                    for category in active_categories
                )
            if signal == "likes":
                return sum(
                    like_preferences.get(category.id, ("", 0))[1] * 1.5
                    for category in active_categories
                )
            return sum(
                min(borrow_preferences.get(category.id, 0), 4) * 0.25
                for category in active_categories
            )

        max_category_by_signal = {
            signal: max((category_signal(book, signal) for book in candidates), default=0.0)
            for signal in ("ratings", "likes", "borrowing")
        }
        signal_scores: dict[str, dict[UUID, float]] = {
            signal: {} for signal in ("ratings", "likes", "borrowing", "popular", "reader_ratings")
        }
        for book in candidates:
            for signal in ("ratings", "likes", "borrowing"):
                semantic_score = semantic_by_signal[signal][book.id][0]
                category_max = max_category_by_signal[signal]
                category_score = (
                    category_signal(book, signal) / category_max if category_max else 0.0
                )
                source_score = max(semantic_score, category_score)
                if source_score > 0:
                    signal_scores[signal][book.id] = source_score

            if max_popularity and popularity.get(book.id, 0):
                signal_scores["popular"][book.id] = log1p(popularity[book.id]) / max_popularity
            average = rating_averages.get(book.id, 0.0)
            if average >= 4.0 and rating_counts.get(book.id, 0) > 0:
                signal_scores["reader_ratings"][book.id] = average / 5.0

        def relevance(book: Book) -> float:
            semantic_score, _ = semantic[book.id]
            category_score = category_scores[book.id] / max_category if max_category else 0.0
            popularity_score = (
                log1p(popularity.get(book.id, 0)) / max_popularity if max_popularity else 0.0
            )
            rating_score = min(rating_averages.get(book.id, 0.0) / 5.0, 1.0)

            # If semantic data is missing for a book/student, preserve useful fallback ranking
            # instead of giving an unindexed title a zero for the whole relevance score.
            weights = [
                (self.SEMANTIC_WEIGHT, semantic_score, bool(seed_weights and semantic_score)),
                (self.CATEGORY_WEIGHT, category_score, bool(category_scores[book.id])),
                (self.POPULARITY_WEIGHT, popularity_score, bool(popularity.get(book.id, 0))),
                (self.RATING_WEIGHT, rating_score, bool(rating_averages.get(book.id, 0))),
            ]
            active_weight = sum(weight for weight, _, active in weights if active)
            if not active_weight:
                return 0.0
            return (
                sum(weight * score for weight, score, active in weights if active) / active_weight
            )

        # Round-robin source pools ensure a strong personal signal cannot fill the whole list.
        source_order = ("ratings", "likes", "borrowing", "popular", "reader_ratings")
        selected: list[Book] = []
        selected_signals: dict[UUID, str] = {}
        while len(selected) < limit:
            made_progress = False
            for signal in source_order:
                available = [
                    book
                    for book in candidates
                    if book.id not in selected_signals and book.id in signal_scores[signal]
                ]
                if not available:
                    continue
                scored: list[tuple[float, float, str, Book]] = []
                for book in available:
                    vector = vectors.get(book.id)
                    redundancy = max(
                        (
                            self._cosine(vector, vectors[selected_book.id])
                            for selected_book in selected
                            if vector is not None and selected_book.id in vectors
                        ),
                        default=0.0,
                    )
                    score = signal_scores[signal][book.id]
                    scored.append(
                        (
                            score - self.DIVERSITY_PENALTY * redundancy,
                            relevance(book),
                            book.title.casefold(),
                            book,
                        )
                    )
                chosen = min(scored, key=lambda item: (-item[0], -item[1], item[2]))[3]
                selected.append(chosen)
                selected_signals[chosen.id] = signal
                made_progress = True
                if len(selected) >= limit:
                    break
            if not made_progress:
                break

        # Fill remaining slots with the blended score when a source pool is sparse.
        while len(selected) < limit:
            remaining = [book for book in candidates if book.id not in selected_signals]
            if not remaining:
                break
            scored = []
            for book in remaining:
                vector = vectors.get(book.id)
                redundancy = max(
                    (
                        self._cosine(vector, vectors[selected_book.id])
                        for selected_book in selected
                        if vector is not None and selected_book.id in vectors
                    ),
                    default=0.0,
                )
                scored.append(
                    (
                        relevance(book) - self.DIVERSITY_PENALTY * redundancy,
                        book.title.casefold(),
                        book,
                    )
                )
            chosen = min(scored, key=lambda item: (-item[0], item[1]))[2]
            selected.append(chosen)
            selected_signals[chosen.id] = "fallback"

        recommendations: list[BookRecommendationResponse] = []
        for book in selected:
            signal = selected_signals[book.id]
            if signal == "fallback":
                reason = "A fresh title from the catalog"
            elif signal == "popular":
                reason = "Popular with library readers"
            elif signal == "reader_ratings":
                reason = f"Highly rated by library readers ({rating_averages[book.id]:.1f}/5)"
            else:
                semantic_score, semantic_seed = semantic_by_signal[signal][book.id]
                reason = self._signal_reason(
                    book,
                    signal=signal,
                    semantic_seed=semantic_seed,
                    semantic_score=semantic_score,
                    book_titles={book_id: item.title for book_id, item in books_by_id.items()},
                    rating_preferences=rating_preferences,
                    like_preferences=like_preferences,
                    borrow_preferences=borrow_preferences,
                    rating_averages=rating_averages,
                )
            recommendations.append(
                BookRecommendationResponse(
                    book=self.book_service._to_response(book),
                    average_rating=rating_averages.get(book.id),
                    rating_count=rating_counts.get(book.id, 0),
                    feedback_signal=cast(
                        Literal["LIKE", "DISMISS"] | None,
                        feedback_signals.get(book.id),
                    ),
                    reason=reason,
                )
            )
        return recommendations

    def save_feedback(
        self, *, student: User, book_id: UUID, signal: Literal["LIKE", "DISMISS"]
    ) -> RecommendationFeedbackResponse:
        """Persist explicit feedback after confirming the title is still active."""
        if self.book_service.repository.get_active_by_id(book_id) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
        self.repository.upsert_feedback(student_id=student.id, book_id=book_id, signal=signal)
        self.repository.db.commit()
        return RecommendationFeedbackResponse(book_id=book_id, signal=signal)

    def clear_feedback(self, *, student: User, book_id: UUID) -> None:
        """Remove the student's explicit preference for a title."""
        deleted = self.repository.delete_feedback(student_id=student.id, book_id=book_id)
        if deleted == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recommendation feedback not found",
            )
        self.repository.db.commit()
