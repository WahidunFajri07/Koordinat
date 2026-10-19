"""Process API schemas."""
import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class ProcessCreateRequest(BaseModel):
    master_filename: str
    pdpj_filename: str | None = None
    kosong_filename: str


class ProcessFinalizeRequest(BaseModel):
    notes: str | None = None


class ProcessResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    initiated_by: str
    created_at: datetime
    completed_at: datetime | None = None
    master_filename: str
    pdpj_filename: str | None = None
    kosong_filename: str


class ProcessHistoryResponseSchema(ProcessResponseSchema):
    validated_kosong: int
    total_candidates: int
