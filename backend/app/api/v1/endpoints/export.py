"""Export endpoint for CSV download."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps.rbac import require_role
from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.match import MatchCandidate # Assuming it's here
from app.services.pipeline import export_to_csv # Assuming it's here

router = APIRouter()

@router.get("/{process_id}")
async def export_candidates(
    process_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Export reconciliation results to CSV."""

    # Logic to fetch candidates and export
    # ...

    return StreamingResponse(
        content=export_to_csv(process_id),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=hasil_rekonsiliasi_{process_id}.csv"}
    )
