"""Comprehensive Phase 3 tests: persistence, statistics, process isolation."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import get_db, Base
from app.models.match import MatchCandidate, MatchProcess
from app.models.user import User
from app.core.security import get_password_hash, create_access_token

# Test database URL - use in-memory SQLite for speed
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def db_session():
    """Create test database and session."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def override_get_db(db_session):
    """Override database dependency."""
    async def _override():
        yield db_session
    return _override


@pytest.fixture
def client(override_get_db):
    """Test client with overridden database."""
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def test_user(db_session):
    """Create test user."""
    user = User(
        id=uuid4(),
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("password123"),
        role="reviewer"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user):
    """Generate auth token for test user."""
    return create_access_token({"sub": str(test_user.id), "role": test_user.role})


@pytest.fixture
def auth_headers(auth_token):
    """Auth headers for requests."""
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
async def test_process(db_session):
    """Create test process."""
    process = MatchProcess(
        id=uuid4(),
        master_filename="master_test.csv",
        kosong_filename="kosong_test.csv",
        status="active",
        created_at=datetime.utcnow()
    )
    db_session.add(process)
    await db_session.commit()
    await db_session.refresh(process)
    return process


@pytest.fixture
async def test_candidates(db_session, test_process):
    """Create test candidates for process."""
    candidates = []
    for i in range(5):
        cand = MatchCandidate(
            id=uuid4(),
            process_id=test_process.id,
            match_id=f"match_{i}",
            score=0.75 + (i * 0.05),
            validation_status="pending"
        )
        candidates.append(cand)
        db_session.add(cand)

    await db_session.commit()
    for c in candidates:
        await db_session.refresh(c)
    return candidates


# PERSISTENCE TESTS
@pytest.mark.asyncio
async def test_validate_candidate_persists_to_db(client, auth_headers, test_candidates):
    """Test candidate validation persists to database."""
    candidate = test_candidates[0]

    response = client.post(
        f"/api/v1/candidates/{candidate.id}/validate",
        json={"status": "valid", "notes": "Looks good"},
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["validation_status"] == "valid"
    assert data["validation_notes"] == "Looks good"

    # Verify persisted in DB
    get_response = client.get(f"/api/v1/candidates/{candidate.id}", headers=auth_headers)
    assert get_response.status_code == 200
    persisted = get_response.json()
    assert persisted["validation_status"] == "valid"
    assert persisted["validation_notes"] == "Looks good"


@pytest.mark.asyncio
async def test_finalize_process_persists_completion(client, auth_headers, test_process):
    """Test process finalization persists to database."""
    response = client.post(
        f"/api/v1/process/{test_process.id}/finalize",
        json={"notes": "Review completed successfully"},
        headers=auth_headers
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["notes"] == "Review completed successfully"

    # Verify in history
    history_response = client.get("/api/v1/process/history/all", headers=auth_headers)
    assert history_response.status_code == 200
    history = history_response.json()
    completed_process = next((p for p in history if p["id"] == str(test_process.id)), None)
    assert completed_process is not None
    assert completed_process["status"] == "completed"


# STATISTICS ACCURACY TESTS
@pytest.mark.asyncio
async def test_statistics_reflect_actual_db_counts(client, auth_headers, test_process, db_session):
    """Test statistics accurately reflect database state."""
    # Create candidates with known validation states
    valid_count = 3
    invalid_count = 2

    for i in range(valid_count):
        cand = MatchCandidate(
            id=uuid4(),
            process_id=test_process.id,
            match_id=f"valid_{i}",
            score=0.9,
            validation_status="valid"
        )
        db_session.add(cand)

    for i in range(invalid_count):
        cand = MatchCandidate(
            id=uuid4(),
            process_id=test_process.id,
            match_id=f"invalid_{i}",
            score=0.3,
            validation_status="invalid"
        )
        db_session.add(cand)

    await db_session.commit()

    # Fetch statistics
    stats_response = client.get(
        f"/api/v1/process/{test_process.id}/statistics",
        headers=auth_headers
    )

    assert stats_response.status_code == 200
    stats = stats_response.json()
    assert stats["valid_count"] == valid_count
    assert stats["invalid_count"] == invalid_count
    assert stats["total_count"] == valid_count + invalid_count


@pytest.mark.asyncio
async def test_statistics_update_after_validation(client, auth_headers, test_candidates):
    """Test statistics update correctly after validation actions."""
    process_id = test_candidates[0].process_id

    # Get initial stats
    initial_response = client.get(
        f"/api/v1/process/{process_id}/statistics",
        headers=auth_headers
    )
    initial_stats = initial_response.json()
    initial_valid = initial_stats.get("valid_count", 0)

    # Validate one candidate
    client.post(
        f"/api/v1/candidates/{test_candidates[0].id}/validate",
        json={"status": "valid"},
        headers=auth_headers
    )

    # Check updated stats
    updated_response = client.get(
        f"/api/v1/process/{process_id}/statistics",
        headers=auth_headers
    )
    updated_stats = updated_response.json()
    assert updated_stats["valid_count"] == initial_valid + 1


# PROCESS ISOLATION TESTS
@pytest.mark.asyncio
async def test_processes_are_isolated(client, auth_headers, db_session):
    """Test candidates from different processes remain isolated."""
    # Create two processes
    process_a = MatchProcess(
        id=uuid4(),
        master_filename="master_a.csv",
        kosong_filename="kosong_a.csv",
        status="active"
    )
    process_b = MatchProcess(
        id=uuid4(),
        master_filename="master_b.csv",
        kosong_filename="kosong_b.csv",
        status="active"
    )
    db_session.add(process_a)
    db_session.add(process_b)
    await db_session.commit()

    # Add candidates to each process
    for i in range(3):
        cand_a = MatchCandidate(
            id=uuid4(),
            process_id=process_a.id,
            match_id=f"a_{i}",
            score=0.8,
            validation_status="valid"
        )
        cand_b = MatchCandidate(
            id=uuid4(),
            process_id=process_b.id,
            match_id=f"b_{i}",
            score=0.7,
            validation_status="pending"
        )
        db_session.add(cand_a)
        db_session.add(cand_b)

    await db_session.commit()

    # Get statistics for each process
    stats_a = client.get(
        f"/api/v1/process/{process_a.id}/statistics",
        headers=auth_headers
    ).json()

    stats_b = client.get(
        f"/api/v1/process/{process_b.id}/statistics",
        headers=auth_headers
    ).json()

    # Verify isolation
    assert stats_a["valid_count"] == 3
    assert stats_a["total_count"] == 3
    assert stats_b["valid_count"] == 0
    assert stats_b["total_count"] == 3


@pytest.mark.asyncio
async def test_finalize_does_not_affect_other_processes(client, auth_headers, db_session):
    """Test finalizing one process doesn't affect others."""
    # Create two active processes
    process_1 = MatchProcess(id=uuid4(), master_filename="m1.csv", kosong_filename="k1.csv", status="active")
    process_2 = MatchProcess(id=uuid4(), master_filename="m2.csv", kosong_filename="k2.csv", status="active")
    db_session.add(process_1)
    db_session.add(process_2)
    await db_session.commit()

    # Finalize process 1
    client.post(
        f"/api/v1/process/{process_1.id}/finalize",
        json={"notes": "Done"},
        headers=auth_headers
    )

    # Check process 2 still active
    history = client.get("/api/v1/process/history/all", headers=auth_headers).json()
    p1 = next((p for p in history if p["id"] == str(process_1.id)), None)
    p2 = next((p for p in history if p["id"] == str(process_2.id)), None)

    assert p1["status"] == "completed"
    assert p2["status"] == "active"


@pytest.mark.asyncio
async def test_new_process_creates_isolated_context(client, auth_headers):
    """Test creating new process starts fresh isolated context."""
    # Create first process
    response_1 = client.post(
        "/api/v1/process/new",
        json={"master_filename": "master1.csv", "kosong_filename": "kosong1.csv"},
        headers=auth_headers
    )
    assert response_1.status_code == 200
    process_1_id = response_1.json()["id"]

    # Create second process
    response_2 = client.post(
        "/api/v1/process/new",
        json={"master_filename": "master2.csv", "kosong_filename": "kosong2.csv"},
        headers=auth_headers
    )
    assert response_2.status_code == 200
    process_2_id = response_2.json()["id"]

    # Verify different IDs
    assert process_1_id != process_2_id

    # Verify both in history
    history = client.get("/api/v1/process/history/all", headers=auth_headers).json()
    assert len([p for p in history if p["id"] in [process_1_id, process_2_id]]) == 2
