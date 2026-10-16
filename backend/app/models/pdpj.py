"""PDPJ records model — already-verified IDPELs to exclude from master."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, LargeBinary, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class PdpjRecord(Base, UUIDPrimaryKeyMixin):
    """PDPJ record — contains only blind index of verified IDPEL."""

    __tablename__ = "pdpj_records"

    # Blind index (HMAC-SHA256) for anti-join against master
    idpel_blind_index: Mapped[bytes] = mapped_column(
        LargeBinary, nullable=False, unique=True, index=True
    )

    source_upload_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
