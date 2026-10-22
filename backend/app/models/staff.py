import uuid
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class StaffInvitation(BaseModel):
    __tablename__ = "staff_invitations"

    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    staff_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role_name: Mapped[str] = mapped_column(String(40), nullable=False)
    permissions: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)
    invited_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    internal_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="Pending", server_default="Pending", nullable=False)
    expires_at: Mapped[str] = mapped_column(String(60), nullable=False)
    accepted_at: Mapped[str | None] = mapped_column(String(60), nullable=True)
    revoked_at: Mapped[str | None] = mapped_column(String(60), nullable=True)
