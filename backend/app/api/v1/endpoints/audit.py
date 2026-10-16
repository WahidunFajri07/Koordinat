"""Audit log endpoints — accessible only by admin and auditor roles."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps.rbac import require_role
from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogListResponse, AuditLogResponse

router = APIRouter()


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1, description="Nomor halaman"),
    page_size: int = Query(20, ge=1, le=100, description="Jumlah data per halaman"),
    action: str | None = Query(None, description="Filter berdasarkan jenis aksi"),
    entity_type: str | None = Query(None, description="Filter berdasarkan entitas"),
    user_email: str | None = Query(None, description="Filter berdasarkan email pengguna"),
    current_user: CurrentUser = Depends(require_role("admin", "auditor")),
    db: AsyncSession = Depends(get_db),
) -> AuditLogListResponse:
    """Retrieve paginated audit logs. Only admin and auditor can access."""
    query = select(AuditLog)

    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if user_email:
        query = query.where(AuditLog.user_email.ilike(f"%{user_email}%"))

    # Count total
    count_stmt = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Paginate and order by newest first
    stmt = (
        query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    return AuditLogListResponse(
        items=[AuditLogResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
