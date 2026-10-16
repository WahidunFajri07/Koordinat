"""Audit log model — immutable record of all write actions."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class AuditLog(Base, UUIDPrimaryKeyMixin):
    """Immutable audit log entry. Retention: configurable, default 6 months."""

    __tablename__ = "audit_log"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="e.g. upload.create, candidate.validate, manual_entry.create",
    )

    entity_type: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="e.g. upload_file, match_candidate, manual_entry"
    )
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    before_state: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment="State before action (IDPEL masked)"
    )
    after_state: Mapped[dict | None] = mapped_column(
        JSONB, nullable=True, comment="State after action (IDPEL masked)"
    )

    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
