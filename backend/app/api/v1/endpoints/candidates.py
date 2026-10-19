"""Candidate validation endpoints."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser
from app.api.v1.deps.rbac import require_role
from app.models.match import MatchCandidate, MatchProcess
from app.schemas.candidate import CandidateValidationRequest, CandidateResponseSchema

router = APIRouter()


@router.get("/{candidate_id}", response_model=CandidateResponseSchema)
async def get_candidate(
    candidate_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Fetch single candidate by ID."""
    stmt = select(MatchCandidate).where(MatchCandidate.id == candidate_id)
    result = await db.execute(stmt)
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    return candidate


@router.get("/process/{process_id}", response_model=list[CandidateResponseSchema])
async def list_candidates_by_process(
    process_id: uuid.UUID,
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """List all candidates for a process, optionally filtered by status."""
    stmt = select(MatchCandidate).where(MatchCandidate.process_id == process_id)

    if status:
        stmt = stmt.where(MatchCandidate.status == status)

    result = await db.execute(stmt)
    candidates = result.scalars().all()

    return candidates


@router.post("/{candidate_id}/validate")
async def validate_candidate(
    candidate_id: uuid.UUID,
    req: CandidateValidationRequest,
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Validate or reject a candidate."""
    stmt = select(MatchCandidate).where(MatchCandidate.id == candidate_id)
    result = await db.execute(stmt)
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(status_code=404, detail="Kandidat tidak ditemukan")

    # Update candidate with decision
    candidate.status = req.status  # 'valid' or 'invalid'
    candidate.validated_by = current_user.email
    candidate.validated_at = req.validated_at

    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)

    return {
        "id": str(candidate.id),
        "status": candidate.status,
        "validated_by": candidate.validated_by,
        "validated_at": candidate.validated_at.isoformat() if candidate.validated_at else None,
    }


@router.get("/process/{process_id}/stats")
async def get_process_candidate_stats(
    process_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
):
    """Get validation statistics for a process."""
    stmt = select(MatchCandidate).where(MatchCandidate.process_id == process_id)
    result = await db.execute(stmt)
    candidates = result.scalars().all()

    total = len(candidates)
    valid = sum(1 for c in candidates if c.status == 'valid')
    invalid = sum(1 for c in candidates if c.status == 'invalid')
    unresolved = sum(1 for c in candidates if c.status == 'unresolved')

    return {
        "process_id": str(process_id),
        "total": total,
        "valid": valid,
        "invalid": invalid,
        "unresolved": unresolved,
    }
