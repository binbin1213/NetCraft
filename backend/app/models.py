from datetime import datetime
from typing import Optional, Any, Dict, List
from sqlmodel import Field, SQLModel, Column, Relationship
from sqlalchemy.dialects.postgresql import JSONB

# --- User Models ---
class UserBase(SQLModel):
    username: str = Field(index=True, unique=True)
    email: Optional[str] = Field(default=None, index=True)

class User(UserBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    projects: List["Project"] = Relationship(back_populates="user")

class UserCreate(UserBase):
    password: str

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
    
    # Upgrade to JSONB for PostgreSQL
    # sa_column=Column(JSONB) tells SQLModel to use PostgreSQL's JSONB type
    # We use Dict[str, Any] or List[Any] as the python type
    data: Optional[List[Dict[str, Any]]] = Field(default=None, sa_column=Column(JSONB))

class Project(ProjectBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
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
    updated_at: datetime = Field(default_factory=datetime.utcnow)
