from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SESSION_COOKIE_NAME, get_current_user, get_session
from app.core.config import settings
from app.models.user import User
from app.schemas.user import TokenOut, UserCreate, UserLogin, UserOut
from app.services.auth import authenticate_user, create_token_for_user, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    data: UserCreate,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    user_out = await register_user(session, data)
    if user_out.access_token:
        _set_auth_cookie(response, user_out.access_token)
    return user_out


@router.post("/login", response_model=TokenOut)
async def login(
    data: UserLogin,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    user = await authenticate_user(session, data)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = user.access_token or await create_token_for_user(user)
    _set_auth_cookie(response, token)
    return TokenOut(
        access_token=token,
        token_type="bearer",
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response):
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return None


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        email=current_user.email,
        display_name=current_user.display_name,
        is_active=current_user.is_active,
        is_admin=current_user.is_admin,
    )
