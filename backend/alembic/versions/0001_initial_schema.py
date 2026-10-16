"""Initial schema with PostGIS extension and all tables

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-10-15 09:16:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import geoalchemy2

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable PostGIS
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    # 2. upload_files
    op.create_table(
        "upload_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("file_type", sa.String(length=20), nullable=False, comment="master|pdpj|kosong"),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("stored_path", sa.String(length=1000), nullable=False),
        sa.Column("file_hash_sha256", sa.String(length=64), nullable=False, comment="SHA-256 hex digest"),
        sa.Column("column_mapping", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("total_rows", sa.Integer(), nullable=True),
        sa.Column("valid_rows", sa.Integer(), nullable=True),
        sa.Column("rejected_rows_count", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_upload_files_file_hash_sha256", "upload_files", ["file_hash_sha256"])
    op.create_index("ix_upload_files_uploaded_by", "upload_files", ["uploaded_by"])

    # 3. rejected_rows
    op.create_table(
        "rejected_rows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("upload_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("upload_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("original_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("rejection_reason", sa.String(length=500), nullable=False),
        sa.Column("rejection_field", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_rejected_rows_upload_id", "rejected_rows", ["upload_id"])

    # 4. master_records
    op.create_table(
        "master_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("idpel_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("idpel_blind_index", sa.LargeBinary(), nullable=False),
        sa.Column("source_upload_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("upload_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_row_number", sa.Integer(), nullable=False),
        sa.Column("has_coordinate_conflict", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active", comment="active|excluded|conflict"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    # Add geography column using geoalchemy2 / Raw SQL for consistency
    op.execute("SELECT AddGeometryColumn('master_records', 'geom', 4326, 'POINT', 2);")
    op.execute("ALTER TABLE master_records ALTER COLUMN geom TYPE geography(Point, 4326) USING ST_SetSRID(geom, 4326)::geography;")
    op.create_index("ix_master_records_idpel_blind_index", "master_records", ["idpel_blind_index"])
    op.create_index("ix_master_records_source_upload_id", "master_records", ["source_upload_id"])
    op.execute("CREATE INDEX idx_master_records_geom ON master_records USING GIST (geom);")

    # 5. pdpj_records
    op.create_table(
        "pdpj_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("idpel_blind_index", sa.LargeBinary(), nullable=False),
        sa.Column("source_upload_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("upload_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_pdpj_records_idpel_blind_index", "pdpj_records", ["idpel_blind_index"], unique=True)
    op.create_index("ix_pdpj_records_source_upload_id", "pdpj_records", ["source_upload_id"])

    # 6. kosong_records
    op.create_table(
        "kosong_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_upload_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("upload_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_row_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="unmatched", comment="unmatched|matched|manual"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute("SELECT AddGeometryColumn('kosong_records', 'geom', 4326, 'POINT', 2);")
    op.execute("ALTER TABLE kosong_records ALTER COLUMN geom TYPE geography(Point, 4326) USING ST_SetSRID(geom, 4326)::geography;")
    op.execute("ALTER TABLE kosong_records ALTER COLUMN geom SET NOT NULL;")
    op.create_index("ix_kosong_records_source_upload_id", "kosong_records", ["source_upload_id"])
    op.execute("CREATE INDEX idx_kosong_records_geom ON kosong_records USING GIST (geom);")

    # 7. match_processes
    op.create_table(
        "match_processes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("master_upload_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("kosong_upload_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("upload_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tolerance_meters", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="queued", comment="queued|running|completed|failed"),
        sa.Column("total_kosong", sa.Integer(), nullable=True),
        sa.Column("matched_kosong", sa.Integer(), nullable=True),
        sa.Column("unmatched_kosong", sa.Integer(), nullable=True),
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
        sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("started_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 8. match_candidates
    op.create_table(
        "match_candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kosong_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("kosong_records.id", ondelete="CASCADE"), nullable=False),
        sa.Column("master_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_records.id", ondelete="CASCADE"), nullable=False),
        sa.Column("distance_meters", sa.Float(), nullable=False),
        sa.Column("match_type", sa.String(length=20), nullable=False, comment="exact|spatial"),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="unresolved", comment="unresolved|valid|invalid"),
        sa.Column("validated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("process_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("match_processes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_match_candidates_kosong_id", "match_candidates", ["kosong_id"])
    op.create_index("ix_match_candidates_master_id", "match_candidates", ["master_id"])
    op.create_index("ix_match_candidates_process_id", "match_candidates", ["process_id"])
    op.create_index("ix_match_candidates_status", "match_candidates", ["status"])

    # 9. manual_entries
    op.create_table(
        "manual_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("idpel_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("idpel_blind_index", sa.LargeBinary(), nullable=False),
        sa.Column("entered_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.execute("SELECT AddGeometryColumn('manual_entries', 'geom', 4326, 'POINT', 2);")
    op.execute("ALTER TABLE manual_entries ALTER COLUMN geom TYPE geography(Point, 4326) USING ST_SetSRID(geom, 4326)::geography;")
    op.execute("ALTER TABLE manual_entries ALTER COLUMN geom SET NOT NULL;")
    op.create_index("ix_manual_entries_idpel_blind_index", "manual_entries", ["idpel_blind_index"])
    op.execute("CREATE INDEX idx_manual_entries_geom ON manual_entries USING GIST (geom);")

    # 10. audit_log
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_email", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("before_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("after_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])

    # 11. users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="analis"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_external_id", "users", ["external_id"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # 12. system_config
    op.create_table(
        "system_config",
        sa.Column("key", sa.String(length=100), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("system_config")
    op.drop_table("users")
    op.drop_table("audit_log")
    op.drop_table("manual_entries")
    op.drop_table("match_candidates")
    op.drop_table("match_processes")
    op.drop_table("kosong_records")
    op.drop_table("pdpj_records")
    op.drop_table("master_records")
    op.drop_table("rejected_rows")
    op.drop_table("upload_files")
