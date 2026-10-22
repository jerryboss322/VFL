import uuid
from pydantic import EmailStr, Field, field_validator
from app.schemas.base import DualCaseModel


class UserCreate(DualCaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=255)


class UserLogin(DualCaseModel):
    email: EmailStr
    password: str


class UserOut(DualCaseModel):
    id: str
    email: str
    display_name: str
    is_active: bool = True
    is_admin: bool = False
    access_token: str | None = None
    token_type: str = "bearer"

    @field_validator("id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v):
        return str(v) if isinstance(v, uuid.UUID) else v


class TokenOut(DualCaseModel):
    access_token: str
    token_type: str = "bearer"
    id: str | None = None
    email: str | None = None
    display_name: str | None = None
    is_active: bool | None = None
    is_admin: bool | None = None
