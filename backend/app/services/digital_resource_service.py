"""Business logic for digital book PDFs."""

import logging
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.book import Book
from app.models.digital_resource import DigitalResource
from app.models.user import User
from app.repositories.digital_resource_repository import DigitalResourceRepository
from app.schemas.digital_resource import DigitalResourceResponse
from app.services.audit_log_service import AuditLogService
from app.services.digital_resource_storage import DigitalResourceStorage

logger = logging.getLogger(__name__)
MAX_PDF_BYTES = 25 * 1024 * 1024


class DigitalResourceService:
    """Manage one private PDF per book, stored outside PostgreSQL."""

    def __init__(
        self,
        db: Session,
        storage: DigitalResourceStorage | None = None,
    ) -> None:
        self.db = db
        self.repository = DigitalResourceRepository(db)
        self.storage = storage or DigitalResourceStorage()
        self.audit_log_service = AuditLogService(db)

    def get_for_book(self, book_id: UUID) -> DigitalResourceResponse | None:
        book_exists = self.db.execute(
            select(Book.id).where(Book.id == book_id, Book.deleted_at.is_(None))
        ).scalar_one_or_none()
        if book_exists is None:
            raise HTTPException(status_code=404, detail="Book not found.")
        resource = self.repository.get_for_book(book_id)
        return DigitalResourceResponse.model_validate(resource) if resource else None

    @staticmethod
    def _validate_pdf(upload: UploadFile) -> tuple[str, int]:
        filename = (upload.filename or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
        if not filename or not filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Upload a PDF file.",
            )
        if upload.content_type != "application/pdf":
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="The uploaded file must be a PDF.",
            )

        upload.file.seek(0, 2)
        file_size = upload.file.tell()
        upload.file.seek(0)
        if file_size <= 0:
            raise HTTPException(status_code=400, detail="The PDF file is empty.")
        if file_size > MAX_PDF_BYTES:
            raise HTTPException(status_code=413, detail="PDF files must be 25 MB or smaller.")
        if upload.file.read(5) != b"%PDF-":
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="The uploaded file does not contain a valid PDF header.",
            )
        upload.file.seek(0)
        return filename[:255], file_size

    def upload(
        self,
        book_id: UUID,
        upload: UploadFile,
        actor: User,
    ) -> DigitalResourceResponse:
        book = self.db.execute(
            select(Book).where(Book.id == book_id, Book.deleted_at.is_(None))
        ).scalar_one_or_none()
        if book is None:
            raise HTTPException(status_code=404, detail="Book not found.")

        filename, file_size = self._validate_pdf(upload)
        storage_key = f"digital-books/{book_id}/{uuid4().hex}.pdf"
        try:
            self.storage.upload(storage_key, upload.file)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001 - storage errors must not leak provider details
            logger.exception("Digital book PDF upload failed for book %s", book_id)
            raise HTTPException(
                status_code=502,
                detail="Unable to store the PDF. Check the digital storage configuration.",
            ) from exc

        previous = self.repository.get_for_book(book_id)
        previous_key = previous.storage_key if previous else None
        try:
            if previous is None:
                resource = DigitalResource(
                    book_id=book_id,
                    storage_key=storage_key,
                    original_filename=filename,
                    file_size=file_size,
                    uploaded_by=actor.id,
                )
                self.db.add(resource)
            else:
                previous.storage_key = storage_key
                previous.original_filename = filename
                previous.file_size = file_size
                previous.uploaded_by = actor.id
                resource = previous
            book.is_digital = True
            self.audit_log_service.record(
                actor=actor,
                action="DIGITAL_RESOURCE_UPLOADED",
                entity_type="BOOK",
                entity_id=book.id,
                summary=f'Uploaded a digital PDF for "{book.title}"',
                details={"filename": filename, "file_size": file_size},
            )
            self.db.commit()
            self.db.refresh(resource)
        except Exception:
            self.db.rollback()
            try:
                self.storage.delete(storage_key)
            except Exception:  # noqa: BLE001 - preserve the original database error
                logger.exception("Could not clean up failed PDF upload for book %s", book_id)
            raise

        if previous_key:
            try:
                self.storage.delete(previous_key)
            except Exception:  # noqa: BLE001 - new file is committed, leave old object for cleanup
                logger.exception("Could not remove replaced PDF for book %s", book_id)
        return DigitalResourceResponse.model_validate(resource)

    def remove(self, book_id: UUID, actor: User) -> None:
        resource = self.repository.get_for_book(book_id)
        if resource is None:
            raise HTTPException(status_code=404, detail="No digital PDF is attached to this book.")
        book = self.db.execute(select(Book).where(Book.id == book_id)).scalar_one_or_none()
        if book is not None:
            book.is_digital = False
            self.audit_log_service.record(
                actor=actor,
                action="DIGITAL_RESOURCE_REMOVED",
                entity_type="BOOK",
                entity_id=book.id,
                summary=f'Removed the digital PDF for "{book.title}"',
                details={"filename": resource.original_filename},
            )
        storage_key = resource.storage_key
        try:
            # Delete the object first. S3-compatible delete is idempotent, so a
            # retried request can safely finish if the database commit fails.
            self.storage.delete(storage_key)
        except Exception as exc:  # noqa: BLE001 - keep metadata if stored-file cleanup fails
            logger.exception("Could not remove stored PDF for book %s", book_id)
            raise HTTPException(
                status_code=502,
                detail="Unable to remove the stored PDF. Please retry.",
            ) from exc
        self.db.delete(resource)
        self.db.commit()

    def open_pdf(self, book_id: UUID):
        book_exists = self.db.execute(
            select(Book.id).where(Book.id == book_id, Book.deleted_at.is_(None))
        ).scalar_one_or_none()
        if book_exists is None:
            raise HTTPException(status_code=404, detail="Book not found.")
        resource = self.repository.get_for_book(book_id)
        if resource is None:
            raise HTTPException(status_code=404, detail="No digital PDF is attached to this book.")
        try:
            return resource, self.storage.open(resource.storage_key)
        except Exception as exc:  # noqa: BLE001 - storage errors must not leak provider details
            logger.exception("Digital book PDF retrieval failed for book %s", book_id)
            raise HTTPException(
                status_code=502,
                detail="Unable to open this PDF right now.",
            ) from exc
