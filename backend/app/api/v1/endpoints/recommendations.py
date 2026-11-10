"""Student book recommendation endpoint."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.user import User
from app.schemas.recommendation import BookRecommendationResponse
from app.services.recommendation_service import RecommendationService

router = APIRouter()


def get_recommendation_service(db: Session = Depends(get_db)) -> RecommendationService:
    """Provide a RecommendationService for the current request."""
    return RecommendationService(db)


@router.get("/me", response_model=list[BookRecommendationResponse])
def get_my_recommendations(
    limit: int = Query(default=6, ge=1, le=20),
    current_user: User = Depends(require_roles("STUDENT")),
    service: RecommendationService = Depends(get_recommendation_service),
) -> list[BookRecommendationResponse]:
    """Return personalized books for the authenticated student."""
    return service.get_for_student(current_user, limit=limit)
