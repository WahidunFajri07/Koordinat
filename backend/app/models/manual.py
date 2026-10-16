"""Manual entry model — for cases that cannot be automated."""

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import DateTime, LargeBinary, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class ManualEntry(Base, UUIDPrimaryKeyMixin):
    """Manually entered pelanggan record."""

    __tablename__ = "manual_entries"

    idpel_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    idpel_blind_index: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, index=True)

    geom: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=False,
    )

    entered_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
