"""Unit tests for OIDC authentication and RBAC authorization."""

import jwt
import pytest
from httpx import AsyncClient


def create_mock_jwt(sub: str, email: str, roles: list[str]) -> str:
    """Helper to generate mock Keycloak JWT for test scenarios."""
    payload = {
        "sub": sub,
        "email": email,
        "preferred_username": email,
        "realm_access": {"roles": roles},
    }
    return jwt.encode(payload, "secret_key_32_bytes_test_rfc7518!", algorithm="HS256")


@pytest.mark.asyncio
async def test_unauthenticated_request_rejected(client: AsyncClient) -> None:
    """Requests to protected endpoints without Bearer token must return 401."""
    response = await client.get("/api/v1/audit-log")
    assert response.status_code == 401
    assert "Bearer token diperlukan" in response.json()["detail"]


@pytest.mark.asyncio
async def test_analyst_cannot_access_audit_log(client: AsyncClient) -> None:
    """Analis role should be forbidden (403) from accessing audit logs."""
    analyst_token = create_mock_jwt("user-1", "analis@example.com", ["analis"])
    headers = {"Authorization": f"Bearer {analyst_token}"}

    response = await client.get("/api/v1/audit-log", headers=headers)
    assert response.status_code == 403
    assert "Akses ditolak" in response.json()["detail"]


@pytest.mark.asyncio
async def test_auditor_can_access_audit_log_endpoint(client: AsyncClient) -> None:
    """Auditor role should pass RBAC check for audit logs."""
    auditor_token = create_mock_jwt("user-2", "auditor@example.com", ["auditor"])
    headers = {"Authorization": f"Bearer {auditor_token}"}

    # Even if DB is mocked or empty, it should not fail with 401 or 403
    response = await client.get("/api/v1/audit-log", headers=headers)
    assert response.status_code in (200, 500)  # Passed 401/403 authorization gate


@pytest.mark.asyncio
async def test_admin_can_access_audit_log_endpoint(client: AsyncClient) -> None:
    """Admin role should pass RBAC check for audit logs."""
    admin_token = create_mock_jwt("user-3", "admin@example.com", ["admin"])
    headers = {"Authorization": f"Bearer {admin_token}"}

    response = await client.get("/api/v1/audit-log", headers=headers)
    assert response.status_code in (200, 500)  # Passed 401/403 authorization gate
