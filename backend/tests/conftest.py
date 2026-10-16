"""Pytest configuration and fixtures for backend testing."""

from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app


@pytest.fixture
def mock_db_session() -> AsyncMock:
    """Mock async DB session that returns empty scalars by default."""
    session = AsyncMock()
    # Mock execute count and scalars
    mock_scalar_one = MagicMock(return_value=0)
    empty_results: list[object] = []
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = empty_results
    mock_scalars.first.return_value = None

    mock_result = MagicMock()
    mock_result.scalar_one = mock_scalar_one
    mock_result.scalars = MagicMock(return_value=mock_scalars)

    session.execute.return_value = mock_result
    return session


@pytest.fixture
async def client(mock_db_session: AsyncMock) -> AsyncGenerator[AsyncClient, None]:
    """Async test client for FastAPI application with mocked DB dependency."""

    async def override_get_db() -> AsyncGenerator[AsyncMock, None]:
        yield mock_db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
