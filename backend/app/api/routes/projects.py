"""Project CRUD endpoints."""

from typing import List

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ...core.logging import get_logger
from ...database import get_session
from ...models import Project, ProjectCreate, ProjectRead, ProjectUpdate, User
from ...services.project_service import apply_update, get_owned_project
from ..deps import get_current_user

logger = get_logger(__name__)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("/", response_model=ProjectRead)
def create_project(
    project: ProjectCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_project = Project.model_validate(project)
    db_project.user_id = current_user.id
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    logger.info("Project created: id=%s user=%s", db_project.id, current_user.username)
    return db_project


@router.get("/", response_model=List[ProjectRead])
def read_projects(
    offset: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return session.exec(
        select(Project)
        .where(Project.user_id == current_user.id)
        .offset(offset)
        .limit(limit)
    ).all()


@router.get("/{project_id}", response_model=ProjectRead)
def read_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return get_owned_project(session, project_id, current_user)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    project: ProjectUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    db_project = get_owned_project(session, project_id, current_user)
    updated = apply_update(session, db_project, project.model_dump(exclude_unset=True))
    logger.info("Project updated: id=%s user=%s", project_id, current_user.username)
    return updated


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    project = get_owned_project(session, project_id, current_user)
    session.delete(project)
    session.commit()
    logger.info("Project deleted: id=%s user=%s", project_id, current_user.username)
    return {"ok": True}
