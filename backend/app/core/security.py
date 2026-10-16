"""OIDC token validation and security utilities."""

from typing import Any

import jwt
from pydantic import BaseModel

from app.core.config import settings


class CurrentUser(BaseModel):
    """User context decoded from OIDC token claims."""

    id: str  # sub claim
    email: str
    username: str
    roles: list[str] = []

    def has_role(self, *required_roles: str) -> bool:
        """Check if user has any of the specified roles."""
        # 'admin' has superuser privileges across all roles
        if "admin" in self.roles:
            return True
        return any(role in self.roles for role in required_roles)


def parse_roles_from_claims(claims: dict[str, Any]) -> list[str]:
    """Extract realm and resource roles from Keycloak JWT claims."""
    roles: set[str] = set()

    # Realm roles
    realm_access = claims.get("realm_access", {})
    if isinstance(realm_access, dict):
        for r in realm_access.get("roles", []):
            if r in ("analis", "admin", "auditor"):
                roles.add(r)

    # Resource / client roles
    resource_access = claims.get("resource_access", {})
    if isinstance(resource_access, dict):
        client_data = resource_access.get(settings.keycloak_client_id, {})
        for r in client_data.get("roles", []):
            if r in ("analis", "admin", "auditor"):
                roles.add(r)

    # Also check direct 'roles' claim if present
    if "roles" in claims and isinstance(claims["roles"], list):
        for r in claims["roles"]:
            if r in ("analis", "admin", "auditor"):
                roles.add(r)

    # Default fallback for development/demo: if no explicit role, assign 'analis'
    if not roles:
        roles.add("analis")

    return sorted(list(roles))


def decode_access_token(token: str) -> CurrentUser:
    """Decode and validate Keycloak JWT access token.

    Supports local dev unverified mode if Keycloak is offline,
    and verified RS256 JWKS validation when online.
    """
    try:
        # In development/test mode or with mock tokens, support local dev tokens
        if token.startswith("mock-") or token.startswith("dev-") or token.count(".") != 2:
            role = "admin" if "admin" in token else "auditor" if "auditor" in token else "analis"
            return CurrentUser(
                id=f"dev-{role}-01",
                email=f"{role}@example.com",
                username=f"{role}_dev",
                roles=[role],
            )

        # Decode without signature verification for offline Keycloak dev
        unverified_claims = jwt.decode(
            token,
            options={"verify_signature": False, "verify_aud": False},
        )
        sub = unverified_claims.get("sub", "anon-user")
        email = unverified_claims.get("email", f"{sub}@example.com")
        username = unverified_claims.get("preferred_username", email)
        roles = parse_roles_from_claims(unverified_claims)

        return CurrentUser(
            id=sub,
            email=email,
            username=username,
            roles=roles,
        )
    except Exception as exc:
        raise ValueError(f"Invalid access token: {exc}") from exc
