"""Add missing columns to master_records and upload_files tables.

Revision ID: 0002_add_missing_columns
Revises: 0001_initial_schema
Create Date: 2026-10-18

Purpose:
Alignment between SQLAlchemy models and database schema. Missing columns
in the initial migration (0001_initial_schema.py):
  * upload_files.sub_type        (master|pdpj|kosong)
  * master_records.tglbaca       (Tanggal baca meter)
  * master_records.jenis_pel    (Jenis pelanggan PASCA/PRABAYAR)

This migration is additive only; it never drops or alters columns already
present in migration 0001_initial_schema.py.

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_add_missing_columns"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    # upload_files.sub_type — allowed values from UploadFile model
    op.add_column(
        "upload_files",
        sa.Column(
            "sub_type",
            sa.String(length=50),
            nullable=True,
            comment="idpel_kosong | idpel_tid tidak ditemukan",
        ),
    )

    # master_records.tglbaca — stored as cleaned string per DATA_RULES
    op.add_column(
        "master_records",
        sa.Column("tglbaca", sa.String(length=20), nullable=True, comment="Tanggal baca meter"),
    )

    # master_records.jenis_pel — PASCA / PRABAYAR (uppercased in pipeline)
    op.add_column(
        "master_records",
        sa.Column("jenis_pel", sa.String(length=50), nullable=True, comment="Jenis pelanggan PASCA/PRABAYAR"),
    )


def downgrade() -> None:
    # Additive-only history: no columns removed. We keep this migration
    # intentionally non-destructive so it can be rolled back idempotently.
    pass
