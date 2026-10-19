import pytest
from uuid import uuid4
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Helper token mock
def mock_auth():
    return {"sub": "analis@pln.co.id", "email": "analis@pln.co.id", "role": "analis"}

def test_validate_candidate_endpoint_unauthorized():
    candidate_id = str(uuid4())
    res = client.post(f"/api/v1/candidates/{candidate_id}/validate", json={"status": "valid"})
    # Expect 401 without bearer token
    assert res.status_code == 401

def test_create_new_process_unauthorized():
    res = client.post("/api/v1/process/new", json={
        "master_filename": "master.csv",
        "kosong_filename": "kosong.csv"
    })
    assert res.status_code == 401

def test_finalize_process_unauthorized():
    process_id = str(uuid4())
    res = client.post(f"/api/v1/process/{process_id}/finalize", json={"notes": "done"})
    assert res.status_code == 401

def test_get_process_history_unauthorized():
    res = client.get("/api/v1/process/history/all")
    assert res.status_code == 401
