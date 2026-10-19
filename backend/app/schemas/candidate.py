"""Candidate API schemas."""
import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict


class CandidateValidationRequest(BaseModel):
    status: Literal["valid", "invalid"]
    validated_at: datetime


class CandidateResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    process_id: uuid.UUID
    status: str
    validated_by: str | None = None
    validated_at: datetime | None = None
