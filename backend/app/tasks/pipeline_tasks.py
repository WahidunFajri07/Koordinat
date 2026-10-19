"""Celery tasks for data cleaning, dedup, and loading pipeline (Tahap 1).

Implements process_upload_pipeline end-to-end:
  1. Load upload record + confirmed column mapping.
  2. Stream file row-by-row (chunked) to bound memory usage.
  3. Normalize IDPEL, validate coordinates/tglbaca/jenis_pel.
  4. Insert into master_records / pdpj_records / kosong_records.
  5. Record rejected rows with masked IDPEL.
  6. Update upload_files metrics/status atomically.
  7. Reject duplicate PDPJ blind indexes across uploads without aborting.
"""

import logging
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import SyncSessionLocal
from app.core.encryption import compute_blind_index, encrypt_idpel
from app.models.kosong import KosongRecord
from app.models.master import MasterRecord
from app.models.pdpj import PdpjRecord
from app.models.upload import RejectedRow, UploadFile
from app.services.import_service import (
    ImportError,
    build_rejected_reason,
    extract_mapped_value,
    normalize_idpel,
    parse_coordinate_combined,
    read_rows_csv,
    read_rows_xlsx,
    sanitize_rejected_data,
    validate_jenis_pel,
    validate_latitude,
    validate_longitude,
)
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


def _require_upload(session, upload_id: uuid.UUID) -> UploadFile:
    upload_record = session.get(UploadFile, upload_id)
    if not upload_record:
        raise ImportError(f"Upload {upload_id} tidak ditemukan")
    if upload_record.status not in ("pending", "processing"):
        raise ImportError(f"Upload {upload_id} status {upload_record.status}; tidak dapat diproses ulang")
    return upload_record


def _load_mapping(upload_record: UploadFile) -> dict[str, str]:
    mapping = upload_record.column_mapping or {}
    if not isinstance(mapping, dict) or not mapping:
        raise ImportError(f"Upload {upload_record.id} belum memiliki pemetaan kolom yang dikonfirmasi")
    return mapping


def _insert_master(session, upload_id: uuid.UUID, row_number: int, row: dict[str, Any], mapping: dict[str, str]) -> str | None:
    """Insert a master record. Returns rejection reason or None."""
    idpel_raw = extract_mapped_value(row, mapping, "idpel")
    idpel_clean = normalize_idpel(idpel_raw)
    if not idpel_clean:
        return build_rejected_reason("idpel", f"Baris {row_number}: IDPEL tidak valid atau bukan 12 digit")

    latitude = validate_latitude(extract_mapped_value(row, mapping, "latitude"))
    longitude = validate_longitude(extract_mapped_value(row, mapping, "longitude"))
    combined = extract_mapped_value(row, mapping, "coordinate_combined")
    geom = None
    if combined:
        parsed = parse_coordinate_combined(combined)
        if parsed is None:
            return build_rejected_reason("koordinat", f"Baris {row_number}: format koordinat gabungan tidak valid")
        latitude, longitude = parsed
    if latitude is not None and longitude is not None:
        geom = f"SRID=4326;POINT({longitude} {latitude})"
    elif latitude is not None or longitude is not None:
        return build_rejected_reason("koordinat", f"Baris {row_number}: koordinat tidak lengkap (wajib latitude dan longitude)")

    has_conflict = False
    # Check for existing IDPEL across uploads (blind index).
    blind_index = compute_blind_index(idpel_clean)
    existing = session.execute(
        select(MasterRecord.id, MasterRecord.geom).where(MasterRecord.idpel_blind_index == blind_index)
    ).first()
    if existing:
        # Same IDPEL from another upload: keep old data, mark coordinate conflict.
        has_conflict = True

    session.add(
        MasterRecord(
            idpel_encrypted=encrypt_idpel(idpel_clean),
            idpel_blind_index=blind_index,
            geom=geom,
            tglbaca=str(extract_mapped_value(row, mapping, "tglbaca") or "").strip() or None,
            jenis_pel=validate_jenis_pel(extract_mapped_value(row, mapping, "jenis_pel")),
            source_upload_id=upload_id,
            source_row_number=row_number,
            has_coordinate_conflict=has_conflict,
            status="active",
        )
    )
    return None


def _insert_pdpj(session, upload_id: uuid.UUID, row_number: int, row: dict[str, Any], mapping: dict[str, str]) -> str | None:
    """Insert a PDPJ record. Returns rejection reason or None.

    Duplicate blind index across uploads is recorded as rejected row but does NOT abort upload.
    """
    idpel_raw = extract_mapped_value(row, mapping, "idpel")
    idpel_clean = normalize_idpel(idpel_raw)
    if not idpel_clean:
        return build_rejected_reason("idpel", f"Baris {row_number}: IDPEL tidak valid atau bukan 12 digit")

    blind_index = compute_blind_index(idpel_clean)
    try:
        with session.begin_nested():
            session.add(
                PdpjRecord(
                    idpel_blind_index=blind_index,
                    source_upload_id=upload_id,
                )
            )
            session.flush()  # Detect unique constraint violation inside SAVEPOINT.
    except IntegrityError:
        return build_rejected_reason("idpel", f"Baris {row_number}: IDPEL PDPJ sudah terdaftar secara global")
    return None


def _insert_kosong(session, upload_id: uuid.UUID, row_number: int, row: dict[str, Any], mapping: dict[str, str]) -> str | None:
    """Insert a kosong record. Returns rejection reason or None."""
    latitude = validate_latitude(extract_mapped_value(row, mapping, "latitude"))
    longitude = validate_longitude(extract_mapped_value(row, mapping, "longitude"))
    combined = extract_mapped_value(row, mapping, "coordinate_combined")
    geom = None
    if combined:
        parsed = parse_coordinate_combined(combined)
        if parsed is None:
            return build_rejected_reason("koordinat", f"Baris {row_number}: format koordinat gabungan tidak valid")
        latitude, longitude = parsed
    if latitude is None or longitude is None:
        return build_rejected_reason("koordinat", f"Baris {row_number}: koordinat tidak valid atau di luar wilayah Indonesia")

    geom = f"SRID=4326;POINT({longitude} {latitude})"

    idpel_raw = extract_mapped_value(row, mapping, "idpel")
    idpel_clean = normalize_idpel(idpel_raw) if idpel_raw else None

    session.add(
        KosongRecord(
            geom=geom,
            source_upload_id=upload_id,
            source_row_number=row_number,
            status="unmatched",
        )
    )
    # Kosong model does not store IDPEL; ignore idpel_clean except for debugging.
    return None


def _write_rejected(session, upload_id: uuid.UUID, row_number: int, row: dict[str, Any], reason: str, field: str | None, idpel_column: str | None) -> None:
    session.add(
        RejectedRow(
            upload_id=upload_id,
            row_number=row_number,
            original_data=sanitize_rejected_data(row, idpel_column),
            rejection_reason=reason,
            rejection_field=field,
        )
    )


@celery_app.task(name="app.tasks.pipeline_tasks.process_upload_pipeline", bind=True)
def process_upload_pipeline(self, upload_id: str) -> dict[str, Any]:
    """Celery task: process uploaded file through validation and import pipeline."""
    try:
        upload_uuid = uuid.UUID(upload_id)
    except (ValueError, AttributeError):
        return {"status": "failed", "upload_id": upload_id, "error": "upload_id tidak valid"}

    with SyncSessionLocal() as session:
        try:
            upload_record = _require_upload(session, upload_uuid)
            mapping = _load_mapping(upload_record)

            upload_record.status = "processing"
            upload_record.error_message = None
            session.commit()

            file_path = Path(upload_record.stored_path)
            file_type = upload_record.file_type

            total_rows = 0
            valid_rows = 0
            rejected_rows_count = 0

            idpel_column = None
            for col, tgt in mapping.items():
                if tgt == "idpel":
                    idpel_column = col
                    break

            reader = read_rows_csv(file_path) if file_path.suffix.lower() == ".csv" else read_rows_xlsx(file_path)

            for row_number, row in reader:
                total_rows += 1
                try:
                    if file_type == "master":
                        reject = _insert_master(session, upload_uuid, row_number, row, mapping)
                    elif file_type == "pdpj":
                        reject = _insert_pdpj(session, upload_uuid, row_number, row, mapping)
                    elif file_type == "kosong":
                        reject = _insert_kosong(session, upload_uuid, row_number, row, mapping)
                    else:
                        reject = build_rejected_reason(None, f"Baris {row_number}: tipe file tidak dikenal '{file_type}'")

                    if reject:
                        reason, field = reject
                        _write_rejected(session, upload_uuid, row_number, row, reason, field, idpel_column)
                        rejected_rows_count += 1
                    else:
                        valid_rows += 1
                except Exception as exc:  # noqa: BLE001 - per-row isolation
                    logger.exception("Gagal memproses baris %s upload %s", row_number, upload_id)
                    _write_rejected(session, upload_uuid, row_number, row, str(exc), "baris", idpel_column)
                    rejected_rows_count += 1

            upload_record.total_rows = total_rows
            upload_record.valid_rows = valid_rows
            upload_record.rejected_rows_count = rejected_rows_count
            upload_record.status = "completed"
            session.commit()

            return {
                "status": "success",
                "upload_id": upload_id,
                "total_rows": total_rows,
                "valid_rows": valid_rows,
                "rejected_rows_count": rejected_rows_count,
            }

        except Exception as exc:  # noqa: BLE001 - capture task failure
            logger.exception("Pipeline gagal untuk upload %s", upload_id)
            try:
                upload_record = session.get(UploadFile, upload_uuid)
                if upload_record:
                    upload_record.status = "failed"
                    upload_record.error_message = str(exc)[:1000]
                    session.commit()
            except Exception:
                session.rollback()
            return {"status": "failed", "upload_id": upload_id, "error": str(exc)[:1000]}
