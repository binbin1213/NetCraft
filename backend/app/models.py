from datetime import datetime, timezone
from typing import Optional, Any, Dict, List

from pydantic import field_validator
from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel, Column, Relationship

from .core.security import validate_password

# Use JSONB on PostgreSQL, plain JSON elsewhere (e.g. SQLite in tests)
JSONType = JSON().with_variant(JSONB, "postgresql")


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp.

    SQLModel 0.0.49+ rejects naive datetimes on insert, and
    datetime.utcnow() is deprecated in Python 3.12.
    """
    return datetime.now(timezone.utc)


# --- User Models ---
class UserBase(SQLModel):
    username: str = Field(index=True, unique=True)
    email: Optional[str] = Field(default=None, index=True)


class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)

    projects: List["Project"] = Relationship(back_populates="user")


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str) -> str:
        validate_password(value)
        return value


class UserRead(UserBase):
    id: int
    created_at: datetime


class UserLogin(SQLModel):
    username: str
    password: str


# --- Project Models ---
class ProjectBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None

    # JSONB on PostgreSQL, JSON on other backends
    data: Optional[List[Dict[str, Any]]] = Field(
        default=None, sa_column=Column(JSONType)
    )


class Project(ProjectBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    # Foreign Key to User
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="projects")


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: int
    created_at: datetime
    updated_at: datetime
    user_id: Optional[int] = None


class ProjectUpdate(SQLModel):
    name: Optional[str] = None
    description: Optional[str] = None
    data: Optional[List[Dict[str, Any]]] = None
    updated_at: datetime = Field(default_factory=utcnow)
