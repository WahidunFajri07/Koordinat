"""Role-Based Access Control (RBAC) dependency factory."""

from collections.abc import Awaitable, Callable

from fastapi import Depends, HTTPException, status

from app.api.v1.deps.auth import get_current_user
from app.core.security import CurrentUser


def require_role(*allowed_roles: str) -> Callable[..., Awaitable[CurrentUser]]:
    """Dependency factory that checks if current user has one of allowed roles.

    Roles: 'analis', 'admin', 'auditor'.
    Admin automatically satisfies all role checks.
    """

    async def role_checker(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        if not current_user.has_role(*allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak: role Anda ({', '.join(current_user.roles)}) tidak memiliki izin untuk tindakan ini. Diperlukan salah satu dari: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_checker
