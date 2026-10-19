"""File upload endpoints for Master, PDPJ, and Koordinat Kosong datasets."""

import uuid
from pathlib import Path
from typing import Any, cast

from fastapi import APIRouter, Depends, File, HTTPException, Request, status
from fastapi import UploadFile as FastApiUploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps.rbac import require_role
from app.core.config import settings
from app.core.database import get_db
from app.core.security import CurrentUser
from app.models.upload import UploadFile as DbUploadFile
from app.schemas.upload import ColumnMappingRequest, UploadFileDetailResponse, UploadResponse
from app.services.audit_service import write_audit_log
from app.services.upload_service import auto_detect_columns, compute_file_hash, read_file_preview
from app.tasks.pipeline_tasks import process_upload_pipeline

router = APIRouter()

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}


async def handle_upload(
    file_type: str,
    file: FastApiUploadFile,
    current_user: CurrentUser,
    db: AsyncSession,
    request: Request,
    sub_type: str | None = None,
) -> UploadResponse:
    """Generic file upload handler validating size, saving, hashing, and generating preview."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Nama file tidak boleh kosong"
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Format file '{ext}' tidak didukung. Format yang diterima: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Ensure uploads directory exists
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    upload_id = uuid.uuid4()
    stored_filename = f"{upload_id}_{file.filename}"
    stored_path = settings.upload_dir / stored_filename

    # Save uploaded file in chunks & enforce size limit
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    total_bytes = 0

    with open(stored_path, "wb") as buffer:
        while chunk := await file.read(65536):
            total_bytes += len(chunk)
            if total_bytes > max_bytes:
                # Cleanup file
                stored_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Ukuran file melebihi batas maksimal {settings.max_upload_size_mb} MB",
                )
            buffer.write(chunk)

    # Compute SHA-256
    file_hash = compute_file_hash(stored_path)

    # Check for duplicates
    dup_query = select(DbUploadFile).where(DbUploadFile.file_hash_sha256 == file_hash)
    dup_result = await db.execute(dup_query)
    existing_dup = dup_result.scalars().first()

    is_duplicate = existing_dup is not None
    duplicate_of_id = existing_dup.id if existing_dup else None

    # Read preview < 2s
    try:
        headers, preview_rows, sheet_names = read_file_preview(stored_path, max_rows=10)
    except Exception as exc:
        stored_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Gagal membaca pratinjau file: {exc}",
        ) from exc

    # Auto-detect column mapping
    detected_mapping = auto_detect_columns(headers, preview_rows, file_type)

    # Parse user id
    try:
        user_uuid = uuid.UUID(current_user.id)
    except ValueError:
        user_uuid = uuid.uuid4()

    # Save to database
    db_file = DbUploadFile(
        id=upload_id,
        file_type=file_type,
        sub_type=sub_type,
        original_filename=file.filename,
        stored_path=str(stored_path),
        file_hash_sha256=file_hash,
        column_mapping=detected_mapping,
        status="pending",
        uploaded_by=user_uuid,
    )
    db.add(db_file)

    # Write audit log
    await write_audit_log(
        db=db,
        user=current_user,
        action=f"upload.{file_type}",
        entity_type="upload_file",
        entity_id=upload_id,
        after_state={
            "filename": file.filename,
            "file_type": file_type,
            "sub_type": sub_type,
            "file_hash": file_hash,
            "is_duplicate": is_duplicate,
        },
        request=request,
    )
    await db.commit()

    return UploadResponse(
        upload_id=upload_id,
        file_type=file_type,
        sub_type=sub_type,
        original_filename=file.filename,
        file_hash_sha256=file_hash,
        is_duplicate=is_duplicate,
        duplicate_of_id=duplicate_of_id,
        headers=headers,
        preview_rows=preview_rows,
        detected_mapping=detected_mapping,
        sheet_names=sheet_names,
        status="pending",
    )


@router.post("/master", response_model=UploadResponse)
async def upload_master_file(
    request: Request,
    file: FastApiUploadFile = File(...),
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
) -> UploadResponse:
    """Upload Master dataset (Pasca + Prabayar) containing IDPEL and Coordinates."""
    return await handle_upload("master", file, current_user, db, request)


@router.post("/pdpj", response_model=UploadResponse)
async def upload_pdpj_file(
    request: Request,
    file: FastApiUploadFile = File(...),
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
) -> UploadResponse:
    """Upload PDPJ dataset containing already-verified IDPELs."""
    return await handle_upload("pdpj", file, current_user, db, request)


@router.post("/kosong", response_model=UploadResponse)
async def upload_kosong_file(
    request: Request,
    sub_type: str = "idpel_kosong",
    file: FastApiUploadFile = File(...),
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
) -> UploadResponse:
    """Upload Koordinat Kosong dataset containing coordinate points without IDPEL or with unfound IDPEL."""
    if sub_type not in ("idpel_kosong", "idpel_tidak_ditemukan"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subtipe harus 'idpel_kosong' atau 'idpel_tidak_ditemukan'",
        )
    return await handle_upload("kosong", file, current_user, db, request, sub_type=sub_type)


@router.post("/{upload_id}/mapping")
async def confirm_column_mapping(
    upload_id: uuid.UUID,
    payload: ColumnMappingRequest,
    request: Request,
    current_user: CurrentUser = Depends(require_role("analis", "admin")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Confirm or correct column mapping and trigger async cleaning/loading pipeline."""
    stmt = select(DbUploadFile).where(DbUploadFile.id == upload_id)
    result = await db.execute(stmt)
    upload_record = result.scalars().first()

    if not upload_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Data upload tidak ditemukan"
        )

    # Validate mapping requirements based on file type
    mapping = payload.mapping
    target_values = set(mapping.values())

    if upload_record.file_type == "master":
        if "idpel" not in target_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File Master harus memiliki minimal 1 kolom IDPEL ('idpel')",
            )
        has_coords = ("latitude" in target_values and "longitude" in target_values) or (
            "coordinate_combined" in target_values
        )
        if not has_coords:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File Master harus memiliki koordinat (Latitude & Longitude atau Koordinat Gabungan)",
            )

    elif upload_record.file_type == "pdpj":
        if "idpel" not in target_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File PDPJ harus memiliki minimal 1 kolom IDPEL ('idpel')",
            )

    elif upload_record.file_type == "kosong":
        has_coords = ("latitude" in target_values and "longitude" in target_values) or (
            "coordinate_combined" in target_values
        )
        if not has_coords:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File Koordinat Kosong harus memiliki koordinat (Latitude & Longitude atau Koordinat Gabungan)",
            )

    # Save mapping and update status
    upload_record.column_mapping = mapping
    upload_record.status = "processing"

    # Audit log
    await write_audit_log(
        db=db,
        user=current_user,
        action="upload.confirm_mapping",
        entity_type="upload_file",
        entity_id=upload_id,
        after_state={"mapping": mapping, "status": "processing"},
        request=request,
    )
    await db.commit()

    # Dispatch Celery async task
    task = cast(Any, process_upload_pipeline).delay(str(upload_id))

    return {
        "status": "success",
        "message": "Mapping kolom berhasil disimpan. Pipeline pembersihan dan pemuatan data sedang berjalan.",
        "upload_id": str(upload_id),
        "task_id": task.id if hasattr(task, "id") else str(task),
    }


@router.get("/{upload_id}", response_model=UploadFileDetailResponse)
async def get_upload_detail(
    upload_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("analis", "admin", "auditor")),
    db: AsyncSession = Depends(get_db),
) -> UploadFileDetailResponse:
    """Retrieve upload details, status, and processing metrics."""
    stmt = select(DbUploadFile).where(DbUploadFile.id == upload_id)
    result = await db.execute(stmt)
    upload_record = result.scalars().first()

    if not upload_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Data upload tidak ditemukan"
        )

    return UploadFileDetailResponse.model_validate(upload_record)
