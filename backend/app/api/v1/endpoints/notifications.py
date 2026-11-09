"""Authenticated in-app notification endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.notification import NotificationCenterResponse, NotificationResponse
from app.services.notification_service import NotificationService

router = APIRouter()


def get_notification_service(db: Session = Depends(get_db)) -> NotificationService:
    """Provide a NotificationService for the current request."""
    return NotificationService(db)


@router.get("", response_model=NotificationCenterResponse)
def list_notifications(
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationCenterResponse:
    """Return recent notifications and unread count for the current user."""
    return service.list_for_user(current_user)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    """Mark one of the current user's notifications as read."""
    return service.mark_read(notification_id, current_user.id)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    service: NotificationService = Depends(get_notification_service),
) -> Response:
    """Mark all of the current user's notifications as read."""
    service.mark_all_read(current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
