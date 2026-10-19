"""Process management endpoints."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser
from app.api.v1.deps.rbac import require_role
from app.models.match import MatchProcess, MatchCandidate
from app.schemas.process import (
    ProcessCreateRequest,
    ProcessFinalizeRequest,
    ProcessResponseSchema,
    ProcessHistoryResponseSchema,
)

router = APIRouter()


@router.post("/new", response_model=ProcessResponseSchema)
async def create_new_process(
    req: ProcessCreateRequest,
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Start new matching process without deleting history."""
    process = MatchProcess(
        status="running",
        initiated_by=current_user.email,
        master_filename=req.master_filename,
        pdpj_filename=req.pdpj_filename or None,
        kosong_filename=req.kosong_filename,
    )

    db.add(process)
    await db.commit()
    await db.refresh(process)

    return process


@router.post("/{process_id}/finalize", response_model=ProcessResponseSchema)
async def finalize_process(
    process_id: uuid.UUID,
    req: ProcessFinalizeRequest,
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Complete a matching process with final summary."""
    stmt = select(MatchProcess).where(MatchProcess.id == process_id)
    result = await db.execute(stmt)
    process = result.scalar_one_or_none()

    if not process:
        raise HTTPException(status_code=404, detail="Proses tidak ditemukan")

    # Get candidate statistics
    cand_stmt = select(MatchCandidate).where(MatchCandidate.process_id == process_id)
    cand_result = await db.execute(cand_stmt)
    candidates = cand_result.scalars().all()

    validated_count = sum(1 for c in candidates if c.status == 'valid')

    # Update process
    process.status = "completed"
    process.completed_at = datetime.utcnow()
    process.notes = req.notes
    # Store validated count as metadata if needed

    db.add(process)
    await db.commit()
    await db.refresh(process)

    return process


@router.get("/{process_id}", response_model=ProcessResponseSchema)
async def get_process(
    process_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Fetch single process by ID."""
    stmt = select(MatchProcess).where(MatchProcess.id == process_id)
    result = await db.execute(stmt)
    process = result.scalar_one_or_none()

    if not process:
        raise HTTPException(status_code=404, detail="Proses tidak ditemukan")

    return process


@router.get("/history/all", response_model=list[ProcessHistoryResponseSchema])
async def get_process_history(
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Fetch complete process history with candidate statistics."""
    stmt = select(MatchProcess).order_by(MatchProcess.created_at.desc())
    result = await db.execute(stmt)
    processes = result.scalars().all()

    history = []
    for process in processes:
        # Count candidates by status
        cand_stmt = select(MatchCandidate).where(MatchCandidate.process_id == process.id)
        cand_result = await db.execute(cand_stmt)
        candidates = cand_result.scalars().all()

        validated_kosong = sum(1 for c in candidates if c.status == 'valid')

        history.append(
            ProcessHistoryResponseSchema(
                id=process.id,
                status=process.status,
                initiated_by=process.initiated_by,
                created_at=process.created_at,
                completed_at=process.completed_at,
                master_filename=process.master_filename,
                pdpj_filename=process.pdpj_filename,
                kosong_filename=process.kosong_filename,
                validated_kosong=validated_kosong,
                total_candidates=len(candidates),
            )
        )

    return history
