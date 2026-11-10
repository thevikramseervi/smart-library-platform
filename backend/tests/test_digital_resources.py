"""Digital book PDF upload, access, and cleanup tests."""

from io import BytesIO

from fastapi.testclient import TestClient

from app.services.digital_resource_storage import DigitalResourceStorage
from tests.conftest_circulation import (  # noqa: F401
    admin_token,
    catalog_book_with_copy,
    student_token,
)

PDF_BYTES = b"%PDF-1.7\nsmall test document\n%%EOF"


class FakeStorageBody(BytesIO):
    """Small in-memory stand-in for the streamed R2 object response."""

    def iter_chunks(self, chunk_size: int):
        while chunk := self.read(chunk_size):
            yield chunk


def test_staff_upload_student_access_and_remove_pdf(
    client: TestClient,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
    monkeypatch,
) -> None:
    stored: dict[str, bytes] = {}
    deleted: list[str] = []

    def upload(_self, key: str, body) -> None:
        stored[key] = body.read()

    def open_object(_self, key: str) -> FakeStorageBody:
        return FakeStorageBody(stored[key])

    def delete_object(_self, key: str) -> None:
        deleted.append(key)
        stored.pop(key, None)

    monkeypatch.setattr(DigitalResourceStorage, "upload", upload)
    monkeypatch.setattr(DigitalResourceStorage, "open", open_object)
    monkeypatch.setattr(DigitalResourceStorage, "delete", delete_object)

    book_id = catalog_book_with_copy["book_id"]
    staff_headers = {"Authorization": f"Bearer {admin_token}"}
    student_headers = {"Authorization": f"Bearer {student_token}"}
    endpoint = f"/api/v1/digital-resources/books/{book_id}"

    uploaded = client.put(
        endpoint,
        headers=staff_headers,
        files={"file": ("lecture-notes.pdf", PDF_BYTES, "application/pdf")},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["original_filename"] == "lecture-notes.pdf"
    assert uploaded.json()["file_size"] == len(PDF_BYTES)

    metadata = client.get(endpoint, headers=student_headers)
    assert metadata.status_code == 200
    assert metadata.json()["original_filename"] == "lecture-notes.pdf"
    assert "storage_key" not in metadata.json()

    first_key = next(iter(stored))
    replacement_bytes = b"%PDF-1.7\nreplacement document\n%%EOF"
    replaced = client.put(
        endpoint,
        headers=staff_headers,
        files={"file": ("replacement.pdf", replacement_bytes, "application/pdf")},
    )
    assert replaced.status_code == 200
    assert replaced.json()["original_filename"] == "replacement.pdf"
    assert deleted == [first_key]
    assert len(stored) == 1

    content = client.get(f"{endpoint}/content", headers=student_headers)
    assert content.status_code == 200
    assert content.headers["content-type"] == "application/pdf"
    assert content.content == replacement_bytes
    assert content.headers["cache-control"] == "private, no-store"

    book = client.get(f"/api/v1/books/{book_id}", headers=student_headers)
    assert book.json()["is_digital"] is True

    assert client.delete(endpoint, headers=student_headers).status_code == 403
    removed = client.delete(endpoint, headers=staff_headers)
    assert removed.status_code == 204
    assert client.get(endpoint, headers=student_headers).json() is None
    assert len(deleted) == 2
    assert not stored


def test_digital_resource_upload_rejects_non_pdf_and_student_upload(
    client: TestClient,
    admin_token: str,  # noqa: F811
    student_token: str,  # noqa: F811
    catalog_book_with_copy: dict,  # noqa: F811
    monkeypatch,
) -> None:
    uploaded_keys: list[str] = []
    monkeypatch.setattr(
        DigitalResourceStorage,
        "upload",
        lambda _self, key, _body: uploaded_keys.append(key),
    )
    endpoint = f"/api/v1/digital-resources/books/{catalog_book_with_copy['book_id']}"
    student_headers = {"Authorization": f"Bearer {student_token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    forbidden = client.put(
        endpoint,
        headers=student_headers,
        files={"file": ("lecture-notes.pdf", PDF_BYTES, "application/pdf")},
    )
    assert forbidden.status_code == 403

    invalid = client.put(
        endpoint,
        headers=admin_headers,
        files={"file": ("notes.txt", b"not a pdf", "text/plain")},
    )
    assert invalid.status_code == 415
    assert uploaded_keys == []
