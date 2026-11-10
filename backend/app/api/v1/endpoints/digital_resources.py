"""Digital PDF upload, metadata, and authenticated retrieval endpoints."""

from collections.abc import Iterator
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User
from app.schemas.digital_resource import DigitalResourceResponse
from app.services.digital_resource_service import DigitalResourceService

router = APIRouter()


def get_digital_resource_service(db: Session = Depends(get_db)) -> DigitalResourceService:
    """Provide digital resource business logic for this request."""
    return DigitalResourceService(db)


@router.get("/books/{book_id}", response_model=DigitalResourceResponse | None)
def get_book_digital_resource(
    book_id: UUID,
    _current_user: User = Depends(get_current_user),
    service: DigitalResourceService = Depends(get_digital_resource_service),
) -> DigitalResourceResponse | None:
    """Return safe PDF metadata, or null when the title has no digital copy."""
    return service.get_for_book(book_id)


@router.put(
    "/books/{book_id}",
    response_model=DigitalResourceResponse,
)
def upload_book_digital_resource(
    book_id: UUID,
    file: UploadFile = File(...),
    actor: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: DigitalResourceService = Depends(get_digital_resource_service),
) -> DigitalResourceResponse:
    """Upload or replace the private PDF for a title (staff only)."""
    return service.upload(book_id, file, actor)


@router.delete("/books/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_book_digital_resource(
    book_id: UUID,
    actor: User = Depends(require_roles("ADMIN", "LIBRARIAN")),
    service: DigitalResourceService = Depends(get_digital_resource_service),
) -> None:
    """Remove a title's stored PDF (staff only)."""
    service.remove(book_id, actor)


@router.get("/books/{book_id}/content")
def open_book_digital_resource(
    book_id: UUID,
    _current_user: User = Depends(get_current_user),
    service: DigitalResourceService = Depends(get_digital_resource_service),
) -> StreamingResponse:
    """Stream a stored PDF after authenticating the requesting user."""
    resource, body = service.open_pdf(book_id)
    safe_name = resource.original_filename.replace('"', "").replace("\r", "").replace("\n", "")
    fallback_name = safe_name.encode("ascii", "ignore").decode("ascii") or "digital-book.pdf"

    def chunks() -> Iterator[bytes]:
        try:
            yield from body.iter_chunks(chunk_size=64 * 1024)
        finally:
            body.close()

    return StreamingResponse(
        chunks(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'inline; filename="{fallback_name}"; '
                f"filename*=UTF-8''{quote(safe_name)}"
            ),
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )
