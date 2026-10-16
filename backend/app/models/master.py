"""Master records model — cleaned, deduplicated pelanggan data."""

import uuid
from datetime import datetime

from geoalchemy2 import Geography
from sqlalchemy import Boolean, DateTime, Integer, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class MasterRecord(Base, UUIDPrimaryKeyMixin):
    """Master pelanggan record with encrypted IDPEL and spatial geometry."""

    __tablename__ = "master_records"

    # Encrypted IDPEL (AES-256-GCM): nonce || ciphertext || tag
    idpel_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)

    # Blind index (HMAC-SHA256) for dedup/join/search without decryption
    idpel_blind_index: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, index=True)

    # PostGIS geography point (WGS84)
    geom: Mapped[str] = mapped_column(
        Geography(geometry_type="POINT", srid=4326),
        nullable=True,
    )

    # PLN Master specific columns
    tglbaca: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="Tanggal baca meter"
    )
    jenis_pel: Mapped[str | None] = mapped_column(
        String(50), nullable=True, comment="Jenis pelanggan (PASCA/PRABAYAR)"
    )

    source_upload_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)

    has_coordinate_conflict: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        comment="active|excluded|conflict",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
