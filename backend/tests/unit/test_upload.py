"""Unit tests for file upload, preview, auto-detection, and mapping endpoints."""

import io
import time
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import AsyncClient

from app.services.upload_service import auto_detect_columns
from tests.unit.test_auth_rbac import create_mock_jwt


def test_auto_detect_columns_master() -> None:
    """Test heuristic and content column detection for Master data."""
    headers = ["ID_PELANGGAN", "LATITUDE", "LONGITUDE", "NAMA_TARIF"]
    sample_rows = [
        {
            "ID_PELANGGAN": "531234567890",
            "LATITUDE": "-6.2088",
            "LONGITUDE": "106.8456",
            "NAMA_TARIF": "R1/900",
        },
        {
            "ID_PELANGGAN": "531234567891",
            "LATITUDE": "-6.2090",
            "LONGITUDE": "106.8460",
            "NAMA_TARIF": "R1/1300",
        },
    ]
    mapping = auto_detect_columns(headers, sample_rows, "master")
    assert mapping["ID_PELANGGAN"] == "idpel"
    assert mapping["LATITUDE"] == "latitude"
    assert mapping["LONGITUDE"] == "longitude"
    assert mapping["NAMA_TARIF"] == "ignore"


def test_auto_detect_columns_master_pln_standard() -> None:
    """Test auto-detection of standard PLN Master columns: idpel, koordinat_x, koordinat_y, tglbaca, jenis_pel."""
    headers = ["idpel", "koordinat_x", "koordinat_y", "tglbaca", "jenis_pel"]
    sample_rows = [
        {
            "idpel": "531000000001",
            "koordinat_x": "106.845600",
            "koordinat_y": "-6.208800",
            "tglbaca": "05",
            "jenis_pel": "PASCA",
        },
        {
            "idpel": "531000000002",
            "koordinat_x": "106.846000",
            "koordinat_y": "-6.209000",
            "tglbaca": "12",
            "jenis_pel": "PRABAYAR",
        },
    ]
    mapping = auto_detect_columns(headers, sample_rows, "master")
    assert mapping["idpel"] == "idpel"
    assert mapping["koordinat_x"] == "longitude"
    assert mapping["koordinat_y"] == "latitude"
    assert mapping["tglbaca"] == "tglbaca"
    assert mapping["jenis_pel"] == "jenis_pel"


def test_auto_detect_columns_combined_coordinates() -> None:
    """Test auto-detecting single column containing combined lat/lon."""
    headers = ["NO_PEL", "TITIK_KOORDINAT"]
    sample_rows = [
        {"NO_PEL": "531234567890", "TITIK_KOORDINAT": "-6.2088, 106.8456"},
    ]
    mapping = auto_detect_columns(headers, sample_rows, "master")
    assert mapping["NO_PEL"] == "idpel"
    assert mapping["TITIK_KOORDINAT"] == "coordinate_combined"


def test_auto_detect_columns_kosong() -> None:
    """Test auto-detecting coordinates in Koordinat Kosong file without IDPEL."""
    headers = ["KOORDINAT"]
    sample_rows = [
        {"KOORDINAT": "-6.2088, 106.8456"},
    ]
    mapping = auto_detect_columns(headers, sample_rows, "kosong")
    assert mapping["KOORDINAT"] == "coordinate_combined"


@pytest.mark.asyncio
async def test_upload_master_csv_preview_fast(client: AsyncClient) -> None:
    """Upload master CSV must return headers, preview rows, and mapping in < 2 seconds."""
    analyst_token = create_mock_jwt("user-1", "analis@example.com", ["analis"])
    headers = {"Authorization": f"Bearer {analyst_token}"}

    csv_content = (
        b"ID_PELANGGAN,LATITUDE,LONGITUDE\n"
        b"531000000001,-6.208800,106.845600\n"
        b"531000000002,-6.209000,106.846000\n"
    )

    files = {"file": ("master_test.csv", io.BytesIO(csv_content), "text/csv")}

    start_time = time.time()
    response = await client.post("/api/v1/upload/master", headers=headers, files=files)
    elapsed = time.time() - start_time

    assert response.status_code == 200
    assert elapsed < 2.0  # Must complete in under 2 seconds

    data = response.json()
    assert data["file_type"] == "master"
    assert data["headers"] == ["ID_PELANGGAN", "LATITUDE", "LONGITUDE"]
    assert len(data["preview_rows"]) == 2
    assert data["detected_mapping"]["ID_PELANGGAN"] == "idpel"
    assert data["detected_mapping"]["LATITUDE"] == "latitude"
    assert data["detected_mapping"]["LONGITUDE"] == "longitude"


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_extension(client: AsyncClient) -> None:
    """Upload with unsupported extension (.pdf, .exe, .txt) must return 400 Bad Request."""
    analyst_token = create_mock_jwt("user-1", "analis@example.com", ["analis"])
    headers = {"Authorization": f"Bearer {analyst_token}"}

    files = {"file": ("data.pdf", io.BytesIO(b"fake pdf"), "application/pdf")}
    response = await client.post("/api/v1/upload/master", headers=headers, files=files)
    assert response.status_code == 400
    assert "tidak didukung" in response.json()["detail"]


@pytest.mark.asyncio
async def test_confirm_mapping_validates_required_fields(
    client: AsyncClient, mock_db_session: AsyncMock
) -> None:
    """Confirming mapping without IDPEL on master file must raise 400 error."""
    analyst_token = create_mock_jwt("user-1", "analis@example.com", ["analis"])
    headers = {"Authorization": f"Bearer {analyst_token}"}

    fake_upload_id = uuid.uuid4()

    # Mock DB returning an existing master upload record
    mock_upload = MagicMock()
    mock_upload.id = fake_upload_id
    mock_upload.file_type = "master"
    mock_upload.status = "pending"

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_upload
    mock_db_session.execute.return_value = mock_result

    # Send mapping WITHOUT idpel
    bad_payload = {"mapping": {"COL1": "ignore", "COL2": "latitude", "COL3": "longitude"}}
    response = await client.post(
        f"/api/v1/upload/{fake_upload_id}/mapping", headers=headers, json=bad_payload
    )
    assert response.status_code == 400
    assert "harus memiliki minimal 1 kolom IDPEL" in response.json()["detail"]
