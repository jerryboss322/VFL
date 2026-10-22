from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.models.audit import AuditRecord
from app.models.user import User

security = HTTPBearer(auto_error=False)
SESSION_COOKIE_NAME = "vfu_session"

# Canonical Granular RBAC Permission Presets per Staff Role
ROLE_DEFAULT_PERMISSIONS: dict[str, list[str]] = {
    "SUPER_ADMIN": [
        "users.view",
        "users.suspend",
        "users.notes",
        "users.sessions",
        "users.export",
        "finance.view",
        "finance.adjust",
        "finance.settle",
        "finance.export",
        "football.view",
        "football.suspend_markets",
        "football.edit_odds",
        "football.control_sim",
        "admin.audit_view",
        "admin.invite_staff",
        "admin.manage_permissions",
        "admin.system_settings",
    ],
    "SUPPORT_ADMIN": [
        "users.view",
        "users.suspend",
        "users.notes",
        "users.sessions",
        "finance.view",
        "admin.audit_view",
    ],
    "MODERATOR": [
        "users.view",
        "users.suspend",
        "users.notes",
        "admin.audit_view",
    ],
    "TRADING_ADMIN": [
        "football.view",
        "football.suspend_markets",
        "football.edit_odds",
        "admin.audit_view",
    ],
    "LEDGER_AUDITOR": [
        "users.view",
        "finance.view",
        "finance.export",
        "admin.audit_view",
    ],
    "OPERATIONS_ADMIN": [
        "football.view",
        "football.control_sim",
        "admin.audit_view",
    ],
    "TRADER": [],
}


def get_effective_permissions(user: User) -> set[str]:
    """Return the effective set of permissions for a user or staff member."""
    role = getattr(user, "staff_role", "TRADER") or "TRADER"
    if user.is_admin and role == "TRADER":
        role = "SUPER_ADMIN"
    if role == "SUPER_ADMIN":
        return set(ROLE_DEFAULT_PERMISSIONS["SUPER_ADMIN"])
    custom = getattr(user, "staff_permissions", None)
    if isinstance(custom, list) and len(custom) > 0:
        return set(custom)
    return set(ROLE_DEFAULT_PERMISSIONS.get(role, []))


async def check_staff_permission(
    session: AsyncSession,
    user: User,
    required_permission: str,
    target_id: str = "system",
) -> None:
    """Enforce server-side granular staff permission and log any denied privilege attempts."""
    perms = get_effective_permissions(user)
    if required_permission not in perms:
        session.add(
            AuditRecord(
                actor_user_id=user.id,
                action="PRIVILEGE_ACCESS_DENIED",
                target_type="permission",
                target_id=target_id,
                details={
                    "actorEmail": user.email,
                    "staffRole": getattr(user, "staff_role", "TRADER"),
                    "requiredPermission": required_permission,
                },
            )
        )
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{required_permission}' is required for this operation.",
        )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    session: Annotated[AsyncSession, Depends(get_session)],
    vfu_session: Annotated[str | None, Cookie()] = None,
) -> User:
    raw_token: str | None = None
    if credentials is not None and credentials.credentials:
        raw_token = credentials.credentials
    elif vfu_session:
        raw_token = vfu_session

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            raw_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str | None = payload.get("sub")
        token_sv: int | None = payload.get("sv")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    current_sv = getattr(user, "session_version", 1) or 1
    if token_sv is not None and token_sv != current_sv:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked by an administrator",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_current_admin_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    role = getattr(current_user, "staff_role", "TRADER") or "TRADER"
    if not current_user.is_admin and role == "TRADER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Staff or Admin privileges required"
        )
    return current_user
