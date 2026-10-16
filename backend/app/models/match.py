"""Match process and match candidates models."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class MatchProcess(Base, UUIDPrimaryKeyMixin):
    """A matching run between kosong records and master records."""

    __tablename__ = "match_processes"

    master_upload_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    kosong_upload_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    tolerance_meters: Mapped[float] = mapped_column(Float, nullable=False, default=5.0)

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="queued",
        comment="queued|running|completed|failed",
    )

    total_kosong: Mapped[int | None] = mapped_column(Integer, nullable=True)
    matched_kosong: Mapped[int | None] = mapped_column(Integer, nullable=True)
    unmatched_kosong: Mapped[int | None] = mapped_column(Integer, nullable=True)

    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    candidates: Mapped[list["MatchCandidate"]] = relationship(
        "MatchCandidate", back_populates="process", lazy="selectin"
    )


class MatchCandidate(Base, UUIDPrimaryKeyMixin):
    """A candidate match between a kosong record and a master record."""

    __tablename__ = "match_candidates"

    kosong_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("kosong_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    master_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("master_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    distance_meters: Mapped[float] = mapped_column(Float, nullable=False)
    match_type: Mapped[str] = mapped_column(String(20), nullable=False, comment="exact|spatial")
    rank: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="unresolved",
        comment="unresolved|valid|invalid",
    )

    validated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    process_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("match_processes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    process: Mapped["MatchProcess"] = relationship("MatchProcess", back_populates="candidates")
