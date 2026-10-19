"""Upload files model."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UploadFile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tracks uploaded files (master, pdpj, kosong)."""

    __tablename__ = "upload_files"

    file_type: Mapped[str] = mapped_column(String(20), nullable=False, comment="master|pdpj|kosong")
    sub_type: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="idpel_kosong|idpel_tidak_ditemukan")
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_hash_sha256: Mapped[str] = mapped_column(
        String(64), nullable=False, index=True, comment="SHA-256 hex digest"
    )
    column_mapping: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        comment="pending|processing|completed|failed",
    )
    total_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    valid_rows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rejected_rows_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    # Relationships
    rejected_rows: Mapped[list["RejectedRow"]] = relationship(
        "RejectedRow", back_populates="upload", lazy="selectin"
    )


class RejectedRow(Base, UUIDPrimaryKeyMixin):
    """Rows that failed cleaning/validation, with reason."""

    __tablename__ = "rejected_rows"

    upload_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("upload_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    original_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    rejection_reason: Mapped[str] = mapped_column(String(500), nullable=False)
    rejection_field: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    upload: Mapped["UploadFile"] = relationship("UploadFile", back_populates="rejected_rows")
