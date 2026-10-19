"""API client functions for candidate and process endpoints."""
import uuid
from datetime import datetime
from httpx import AsyncClient
from app.core.config import settings


async def validate_candidate(
    candidate_id: uuid.UUID,
    status: str,
    user_email: str,
    client: AsyncClient | None = None,
) -> dict:
    """Call backend API to validate/reject a candidate."""
    if not client:
        async with AsyncClient(base_url=settings.api_base_url) as c:
            return await c.post(
                f"/api/v1/candidates/{candidate_id}/validate",
                json={
                    "status": status,
                    "validated_at": datetime.utcnow().isoformat(),
                },
                headers={"Content-Type": "application/json"},
            )
    return await client.post(
        f"/api/v1/candidates/{candidate_id}/validate",
        json={
            "status": status,
            "validated_at": datetime.utcnow().isoformat(),
        },
        headers={"Content-Type": "application/json"},
    )


async def get_process_stats(
    process_id: uuid.UUID,
    client: AsyncClient | None = None,
) -> dict:
    """Fetch validation statistics for a process."""
    if not client:
        async with AsyncClient(base_url=settings.api_base_url) as c:
            resp = await c.get(f"/api/v1/candidates/process/{process_id}/stats")
            return resp.json()
    resp = await client.get(f"/api/v1/candidates/process/{process_id}/stats")
    return resp.json()


async def get_process_history(
    client: AsyncClient | None = None,
) -> list[dict]:
    """Fetch complete process history with statistics."""
    if not client:
        async with AsyncClient(base_url=settings.api_base_url) as c:
            resp = await c.get("/api/v1/process/history/all")
            return resp.json()
    resp = await client.get("/api/v1/process/history/all")
    return resp.json()


async def finalize_process(
    process_id: uuid.UUID,
    notes: str | None = None,
    client: AsyncClient | None = None,
) -> dict:
    """Complete a matching process."""
    if not client:
        async with AsyncClient(base_url=settings.api_base_url) as c:
            return await c.post(
                f"/api/v1/process/{process_id}/finalize",
                json={"notes": notes},
                headers={"Content-Type": "application/json"},
            )
    return await client.post(
        f"/api/v1/process/{process_id}/finalize",
        json={"notes": notes},
        headers={"Content-Type": "application/json"},
    )


async def create_new_process(
    master_filename: str,
    kosong_filename: str,
    pdpj_filename: str | None = None,
    client: AsyncClient | None = None,
) -> dict:
    """Start new matching process."""
    if not client:
        async with AsyncClient(base_url=settings.api_base_url) as c:
            resp = await c.post(
                "/api/v1/process/new",
                json={
                    "master_filename": master_filename,
                    "kosong_filename": kosong_filename,
                    "pdpj_filename": pdpj_filename,
                },
                headers={"Content-Type": "application/json"},
            )
            return resp.json()
    resp = await client.post(
        "/api/v1/process/new",
        json={
            "master_filename": master_filename,
            "kosong_filename": kosong_filename,
            "pdpj_filename": pdpj_filename,
        },
        headers={"Content-Type": "application/json"},
    )
    return resp.json()
