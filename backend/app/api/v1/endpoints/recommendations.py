"""Student book recommendation endpoint."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.recommendation import (
    BookRecommendationResponse,
    RecommendationFeedbackResponse,
    RecommendationFeedbackUpsert,
)
from app.services.recommendation_service import RecommendationService

router = APIRouter()


def get_recommendation_service(db: Session = Depends(get_db)) -> RecommendationService:
    """Provide a RecommendationService for the current request."""
    return RecommendationService(db)


@router.get("/me", response_model=list[BookRecommendationResponse])
def get_my_recommendations(
    response: Response,
    limit: int = Query(default=9, ge=1, le=20),
    current_user: User = Depends(require_roles("STUDENT")),
    service: RecommendationService = Depends(get_recommendation_service),
) -> list[BookRecommendationResponse]:
    """Return personalized books for the authenticated student."""
    timings: dict[str, float] = {}
    results = service.get_for_student(current_user, limit=limit, timings=timings)
    response.headers["Server-Timing"] = ", ".join(
        f"rec-{name.replace('_ms', '')};dur={duration:.2f}"
        for name, duration in timings.items()
    )
    return results


@router.put("/{book_id}/feedback", response_model=RecommendationFeedbackResponse)
def save_recommendation_feedback(
    book_id: UUID,
    payload: RecommendationFeedbackUpsert,
    current_user: User = Depends(require_roles("STUDENT")),
    service: RecommendationService = Depends(get_recommendation_service),
) -> RecommendationFeedbackResponse:
    """Save whether the student wants similar titles or dismisses this title."""
    return service.save_feedback(student=current_user, book_id=book_id, signal=payload.signal)


@router.delete("/{book_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
def clear_recommendation_feedback(
    book_id: UUID,
    current_user: User = Depends(require_roles("STUDENT")),
    service: RecommendationService = Depends(get_recommendation_service),
) -> Response:
    """Remove the student's saved feedback for this title."""
    service.clear_feedback(student=current_user, book_id=book_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
