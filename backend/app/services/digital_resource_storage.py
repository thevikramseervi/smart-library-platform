"""Cloudflare R2 object storage adapter using its S3-compatible API."""

from typing import BinaryIO

import boto3
from botocore.client import BaseClient
from fastapi import HTTPException, status

from app.core.config import settings


class DigitalResourceStorage:
    """Store private book PDFs in the configured R2 bucket."""

    def __init__(self) -> None:
        self._client: BaseClient | None = None

    def _get_client(self) -> BaseClient:
        if not all(
            (
                settings.CLOUD_STORAGE_BUCKET,
                settings.CLOUD_STORAGE_KEY,
                settings.CLOUD_STORAGE_SECRET,
                settings.CLOUD_STORAGE_ENDPOINT,
            )
        ):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Digital book storage is not configured.",
            )
        if self._client is None:
            self._client = boto3.client(
                "s3",
                endpoint_url=settings.CLOUD_STORAGE_ENDPOINT,
                region_name="auto",
                aws_access_key_id=settings.CLOUD_STORAGE_KEY,
                aws_secret_access_key=settings.CLOUD_STORAGE_SECRET,
            )
        return self._client

    def upload(self, key: str, body: BinaryIO) -> None:
        self._get_client().put_object(
            Bucket=settings.CLOUD_STORAGE_BUCKET,
            Key=key,
            Body=body,
            ContentType="application/pdf",
        )

    def open(self, key: str) -> BinaryIO:
        response = self._get_client().get_object(
            Bucket=settings.CLOUD_STORAGE_BUCKET,
            Key=key,
        )
        return response["Body"]

    def delete(self, key: str) -> None:
        self._get_client().delete_object(
            Bucket=settings.CLOUD_STORAGE_BUCKET,
            Key=key,
        )
