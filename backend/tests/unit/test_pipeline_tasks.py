"""Unit tests for pipeline_tasks Celery task."""

import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

from app.tasks.pipeline_tasks import (
    process_upload_pipeline,
    _require_upload,
    _load_mapping,
    _insert_master,
    _insert_pdpj,
    _insert_kosong,
    _write_rejected,
)
from app.models.upload import UploadFile, RejectedRow
from app.models.master import MasterRecord
from app.models.pdpj import PdpjRecord
from app.models.kosong import KosongRecord
from app.services.import_service import ImportError


@pytest.fixture
def mock_session():
    """Mock SQLAlchemy session."""
    session = MagicMock()
    session.get = MagicMock()
    session.add = MagicMock()
    session.commit = MagicMock()
    session.rollback = MagicMock()
    session.execute = MagicMock()
    session.flush = MagicMock()
    return session


@pytest.fixture
def upload_record():
    """Sample upload record."""
    return UploadFile(
        id=uuid.uuid4(),
        file_type="master",
        status="pending",
        stored_path="test.csv",
        column_mapping={"idpel_col": "idpel", "lat_col": "latitude", "lon_col": "longitude"},
    )


class TestRequireUpload:
    """Test _require_upload validation."""

    def test_valid_upload(self, mock_session, upload_record):
        mock_session.get.return_value = upload_record
        result = _require_upload(mock_session, upload_record.id)
        assert result == upload_record

    def test_upload_not_found(self, mock_session):
        mock_session.get.return_value = None
        with pytest.raises(ImportError, match="tidak ditemukan"):
            _require_upload(mock_session, uuid.uuid4())

    def test_upload_already_completed(self, mock_session, upload_record):
        upload_record.status = "completed"
        mock_session.get.return_value = upload_record
        with pytest.raises(ImportError, match="tidak dapat diproses ulang"):
            _require_upload(mock_session, upload_record.id)


class TestLoadMapping:
    """Test _load_mapping validation."""

    def test_valid_mapping(self, upload_record):
        result = _load_mapping(upload_record)
        assert result == {"idpel_col": "idpel", "lat_col": "latitude", "lon_col": "longitude"}

    def test_missing_mapping(self, upload_record):
        upload_record.column_mapping = None
        with pytest.raises(ImportError, match="belum memiliki pemetaan kolom"):
            _load_mapping(upload_record)

    def test_empty_mapping(self, upload_record):
        upload_record.column_mapping = {}
        with pytest.raises(ImportError, match="belum memiliki pemetaan kolom"):
            _load_mapping(upload_record)


class TestInsertMaster:
    """Test _insert_master logic."""

    def test_valid_master_row(self, mock_session):
        upload_id = uuid.uuid4()
        row = {"idpel_col": "123456789012", "lat_col": "-6.2", "lon_col": "106.8", "tglbaca_col": "2024-01"}
        mapping = {"idpel_col": "idpel", "lat_col": "latitude", "lon_col": "longitude", "tglbaca_col": "tglbaca"}

        mock_session.execute.return_value.first.return_value = None  # No existing IDPEL

        result = _insert_master(mock_session, upload_id, 1, row, mapping)
        assert result is None
        mock_session.add.assert_called_once()
        added_record = mock_session.add.call_args[0][0]
        assert isinstance(added_record, MasterRecord)
        assert added_record.has_coordinate_conflict is False

    def test_invalid_idpel(self, mock_session):
        upload_id = uuid.uuid4()
        row = {"idpel_col": "invalid", "lat_col": "-6.2", "lon_col": "106.8"}
        mapping = {"idpel_col": "idpel", "lat_col": "latitude", "lon_col": "longitude"}

        result = _insert_master(mock_session, upload_id, 1, row, mapping)
        assert result is not None
        reason, field = result
        assert "IDPEL tidak valid" in reason
        assert field == "idpel"

    def test_coordinate_conflict_detection(self, mock_session):
        upload_id = uuid.uuid4()
        row = {"idpel_col": "123456789012", "lat_col": "-6.2", "lon_col": "106.8"}
        mapping = {"idpel_col": "idpel", "lat_col": "latitude", "lon_col": "longitude"}

        # Simulate existing IDPEL
        existing = MagicMock()
        existing.id = uuid.uuid4()
        existing.geom = "SRID=4326;POINT(106.8 -6.2)"
        mock_session.execute.return_value.first.return_value = existing

        result = _insert_master(mock_session, upload_id, 1, row, mapping)
        assert result is None
        added_record = mock_session.add.call_args[0][0]
        assert added_record.has_coordinate_conflict is True


class TestInsertPdpj:
    """Test _insert_pdpj logic."""

    def test_valid_pdpj_row(self, mock_session):
        upload_id = uuid.uuid4()
        row = {"idpel_col": "123456789012"}
        mapping = {"idpel_col": "idpel"}

        result = _insert_pdpj(mock_session, upload_id, 1, row, mapping)
        assert result is None
        mock_session.add.assert_called_once()
        added_record = mock_session.add.call_args[0][0]
        assert isinstance(added_record, PdpjRecord)

    def test_invalid_idpel(self, mock_session):
        upload_id = uuid.uuid4()
        row = {"idpel_col": "invalid"}
        mapping = {"idpel_col": "idpel"}

        result = _insert_pdpj(mock_session, upload_id, 1, row, mapping)
        assert result is not None
        reason, field = result
        assert "IDPEL tidak valid" in reason

    def test_duplicate_pdpj_handled(self, mock_session):
        from sqlalchemy.exc import IntegrityError

        upload_id = uuid.uuid4()
        row = {"idpel_col": "123456789012"}
        mapping = {"idpel_col": "idpel"}

        mock_session.flush.side_effect = IntegrityError(None, None, None)

        result = _insert_pdpj(mock_session, upload_id, 1, row, mapping)
        assert result is not None
        reason, field = result
        assert "sudah terdaftar" in reason
        mock_session.begin_nested.assert_called_once()
        mock_session.rollback.assert_not_called()


class TestInsertKosong:
    """Test _insert_kosong logic."""

    def test_valid_kosong_row(self, mock_session):
        upload_id = uuid.uuid4()
        row = {"lat_col": "-6.2", "lon_col": "106.8"}
        mapping = {"lat_col": "latitude", "lon_col": "longitude"}

        result = _insert_kosong(mock_session, upload_id, 1, row, mapping)
        assert result is None
        mock_session.add.assert_called_once()
        added_record = mock_session.add.call_args[0][0]
        assert isinstance(added_record, KosongRecord)
        assert added_record.status == "unmatched"

    def test_missing_coordinates(self, mock_session):
        upload_id = uuid.uuid4()
        row = {"lat_col": "invalid"}
        mapping = {"lat_col": "latitude", "lon_col": "longitude"}

        result = _insert_kosong(mock_session, upload_id, 1, row, mapping)
        assert result is not None
        reason, field = result
        assert "koordinat tidak valid" in reason


class TestWriteRejected:
    """Test _write_rejected tracking."""

    def test_write_rejected_with_idpel_masking(self, mock_session):
        upload_id = uuid.uuid4()
        row = {"idpel_col": "123456789012", "other": "data"}

        _write_rejected(mock_session, upload_id, 1, row, "Test reason", "idpel", "idpel_col")

        mock_session.add.assert_called_once()
        added_record = mock_session.add.call_args[0][0]
        assert isinstance(added_record, RejectedRow)
        assert added_record.rejection_reason == "Test reason"
        assert added_record.rejection_field == "idpel"


class TestProcessUploadPipeline:
    """Test end-to-end process_upload_pipeline task."""

    @patch("app.tasks.pipeline_tasks.SyncSessionLocal")
    @patch("app.tasks.pipeline_tasks.read_rows_csv")
    def test_successful_master_import(self, mock_read_csv, mock_session_factory):
        mock_session = MagicMock()
        mock_session_factory.return_value.__enter__.return_value = mock_session

        upload_id = str(uuid.uuid4())
        upload_record = UploadFile(
            id=uuid.UUID(upload_id),
            file_type="master",
            status="pending",
            stored_path="test.csv",
            column_mapping={"idpel": "idpel", "lat": "latitude", "lon": "longitude"},
        )

        mock_session.get.return_value = upload_record
        mock_session.execute.return_value.first.return_value = None

        # Mock CSV rows
        mock_read_csv.return_value = iter([
            (1, {"idpel": "123456789012", "lat": "-6.2", "lon": "106.8"}),
            (2, {"idpel": "123456789013", "lat": "-6.3", "lon": "106.9"}),
        ])

        result = process_upload_pipeline(upload_id)

        assert result["status"] == "success"
        assert result["total_rows"] == 2
        assert result["valid_rows"] == 2
        assert result["rejected_rows_count"] == 0
        assert upload_record.status == "completed"

    @patch("app.tasks.pipeline_tasks.SyncSessionLocal")
    def test_invalid_upload_id(self, mock_session_factory):
        result = process_upload_pipeline("not-a-uuid")
        assert result["status"] == "failed"
        assert "tidak valid" in result["error"]

    @patch("app.tasks.pipeline_tasks.SyncSessionLocal")
    def test_upload_not_found(self, mock_session_factory):
        mock_session = MagicMock()
        mock_session_factory.return_value.__enter__.return_value = mock_session
        mock_session.get.return_value = None

        upload_id = str(uuid.uuid4())
        result = process_upload_pipeline(upload_id)

        assert result["status"] == "failed"
        assert "tidak ditemukan" in result["error"]
