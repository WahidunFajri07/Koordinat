"""Pydantic schemas for upload, preview, and column mapping APIs."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class UploadResponse(BaseModel):
    """Response after file upload containing preview and detected column mapping."""

    upload_id: uuid.UUID
    file_type: str = Field(..., description="master | pdpj | kosong")
    sub_type: str | None = Field(None, description="idpel_kosong | idpel_tidak_ditemukan")
    original_filename: str
    file_hash_sha256: str
    is_duplicate: bool = False
    duplicate_of_id: uuid.UUID | None = None
    headers: list[str]
    preview_rows: list[dict[str, Any]]
    detected_mapping: dict[str, str]
    sheet_names: list[str] = []
    status: str = "pending"


class ColumnMappingRequest(BaseModel):
    """User-confirmed or corrected column mapping."""

    mapping: dict[str, str] = Field(
        ...,
        description="Map of source column header to target field: 'idpel', 'latitude', 'longitude', 'coordinate_combined', or 'ignore'",
    )


class UploadFileDetailResponse(BaseModel):
    """Detailed status and metrics of an uploaded file."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_type: str
    sub_type: str | None = None
    original_filename: str
    file_hash_sha256: str
    column_mapping: dict[str, Any] | None = None
    status: str
    total_rows: int | None = None
    valid_rows: int | None = None
    rejected_rows_count: int | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime | None = None
