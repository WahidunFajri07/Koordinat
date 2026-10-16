"""User model — synced from Keycloak on first login."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Application user, synced from Keycloak claims."""

    __tablename__ = "users"

    external_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True, comment="Keycloak 'sub' claim"
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)

    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="analis", comment="analis|admin|auditor"
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
