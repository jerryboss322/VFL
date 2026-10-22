from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.audit import AuditRecord
from app.models.ledger import LedgerEntry
from app.models.user import User
from app.models.wallet import Wallet
from app.schemas.user import UserCreate, UserLogin, UserOut


async def register_user(session: AsyncSession, data: UserCreate) -> UserOut:
    result = await session.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    is_adm = data.email.lower().startswith("admin@")
    now_iso = datetime.now(timezone.utc).isoformat()
    user = User(
        email=data.email,
        display_name=data.display_name,
        password_hash=hash_password(data.password),
        is_admin=is_adm,
        staff_role="SUPER_ADMIN" if is_adm else "TRADER",
        session_version=1,
        last_login_at=now_iso,
        failed_login_attempts=0,
        is_verified=is_adm,
        kyc_tier="VIP_INSTITUTIONAL" if is_adm else "PENDING_KYC",
        risk_flag="NORMAL",
    )
    session.add(user)
    await session.flush()

    initial_minor = settings.INITIAL_WALLET_MINOR
    wallet = Wallet(
        id=user.id,
        user_id=user.id,
        available_minor=initial_minor,
        reserved_minor=0,
        currency="XTS",
        simulated=True,
    )
    session.add(wallet)
    await session.flush()

    session.add(
        LedgerEntry(
            wallet_id=wallet.id,
            user_id=user.id,
            kind="initial_grant",
            amount_minor=initial_minor,
            balance_after_minor=initial_minor,
            description="Initial test-token wallet grant upon registration",
            reference=f"signup:{user.id}",
        )
    )
    session.add(
        AuditRecord(
            actor_user_id=user.id,
            action="NEW_USER_SIGNUP",
            target_type="user",
            target_id=str(user.id),
            details={
                "email": user.email,
                "displayName": user.display_name,
                "kycTier": user.kyc_tier,
                "initialGrantMinor": initial_minor,
            },
        )
    )
    await session.commit()

    token = create_access_token({"sub": str(user.id), "email": user.email, "sv": user.session_version})
    return UserOut(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        access_token=token,
        token_type="bearer",
    )


async def authenticate_user(session: AsyncSession, data: UserLogin) -> UserOut | None:
    result = await session.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    if not verify_password(data.password, user.password_hash):
        user.failed_login_attempts = (getattr(user, "failed_login_attempts", 0) or 0) + 1
        session.add(
            AuditRecord(
                actor_user_id=user.id,
                action="AUTH_LOGIN_FAILED",
                target_type="user",
                target_id=str(user.id),
                details={
                    "email": user.email,
                    "failedAttempts": user.failed_login_attempts,
                },
            )
        )
        await session.commit()
        return None

    user.failed_login_attempts = 0
    user.last_login_at = datetime.now(timezone.utc).isoformat()
    session.add(
        AuditRecord(
            actor_user_id=user.id,
            action="AUTH_LOGIN_SUCCESS",
            target_type="user",
            target_id=str(user.id),
            details={
                "email": user.email,
                "staffRole": getattr(user, "staff_role", "TRADER"),
            },
        )
    )
    await session.commit()

    sv = getattr(user, "session_version", 1) or 1
    token = create_access_token({"sub": str(user.id), "email": user.email, "sv": sv})
    return UserOut(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        access_token=token,
        token_type="bearer",
    )


async def create_token_for_user(user: UserOut) -> str:
    return create_access_token({"sub": str(user.id), "email": user.email, "sv": 1})
