"""Project CRUD with per-user isolation.

Ownership checks live here rather than in the routes so every handler
enforces the same rule and the 403 path is logged consistently.
"""

from fastapi import HTTPException
from sqlmodel import Session

from ..core.logging import get_logger
from ..models import Project, User, utcnow

logger = get_logger(__name__)


def get_owned_project(
    session: Session, project_id: int, current_user: User
) -> Project:
    """Return the project if it belongs to the user, else raise 404/403."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        logger.warning(
            "Forbidden project access: project=%s owner=%s requester=%s",
            project_id,
            project.user_id,
            current_user.id,
        )
        raise HTTPException(
            status_code=403, detail="Not authorized to access this project"
        )
    return project


def apply_update(session: Session, project: Project, changes: dict) -> Project:
    """Apply a partial update and always refresh updated_at."""
    # exclude_unset cannot be relied on to carry default_factory values, so the
    # timestamp is stamped explicitly.
    changes["updated_at"] = utcnow()
    for key, value in changes.items():
        setattr(project, key, value)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project
