"""Audit logging service for tracking all write mutations."""

import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import mask_idpel
from app.core.security import CurrentUser
from app.models.audit import AuditLog


def sanitize_audit_state(data: Any) -> Any:
    """Recursively sanitize state dictionary to ensure NO raw IDPEL is saved.

    Any key matching 'idpel' or containing 'idpel' will be masked.
    """
    if isinstance(data, dict):
        sanitized: dict[str, Any] = {}
        for k, v in data.items():
            key_str = str(k)
            if "idpel" in key_str.lower() and isinstance(v, str):
                sanitized[key_str] = mask_idpel(v)
            elif isinstance(v, (dict, list)):
                sanitized[key_str] = sanitize_audit_state(v)
            else:
                sanitized[key_str] = v
        return sanitized
    elif isinstance(data, list):
        return [sanitize_audit_state(item) for item in data]
    return data


def extract_client_ip(request: Request | None) -> str | None:
    """Extract client IP handling reverse proxies."""
    if not request:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in list is original client
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


async def write_audit_log(
    db: AsyncSession,
    user: CurrentUser | None,
    action: str,
    entity_type: str,
    entity_id: uuid.UUID | None = None,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    request: Request | None = None,
) -> AuditLog:
    """Record an immutable audit log entry."""
    ip_addr = extract_client_ip(request)
    user_agent = request.headers.get("user-agent") if request else None

    # Mask sensitive data in before/after snapshots
    clean_before = sanitize_audit_state(before_state) if before_state else None
    clean_after = sanitize_audit_state(after_state) if after_state else None

    # Parse user id if it is valid UUID, else None
    user_uuid = None
    if user and user.id:
        try:
            user_uuid = uuid.UUID(user.id)
        except ValueError:
            user_uuid = None

    entry = AuditLog(
        user_id=user_uuid,
        user_email=user.email if user else "system",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_state=clean_before,
        after_state=clean_after,
        ip_address=ip_addr,
        user_agent=user_agent,
    )
    db.add(entry)
    await db.flush()
    return entry
