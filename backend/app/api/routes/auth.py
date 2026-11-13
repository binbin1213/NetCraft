"""Registration, login and current-user lookup."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from ...core.logging import get_logger
from ...core.security import create_access_token, get_password_hash, verify_password
from ...database import get_session
from ...models import User, UserCreate, UserRead
from ..deps import get_current_user

logger = get_logger(__name__)

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=UserRead)
def register(user: UserCreate, session: Session = Depends(get_session)):
    existing_user = (
        session.exec(select(User).where(User.username == user.username)).first()
    )
    if existing_user:
        logger.warning("Registration rejected, username taken: %s", user.username)
        raise HTTPException(status_code=400, detail="Username already registered")

    db_user = User(
        username=user.username,
        email=user.email,
        password_hash=get_password_hash(user.password),
    )
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    logger.info("User registered: %s", db_user.username)
    return db_user


@router.post("/token")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    user = session.exec(
        select(User).where(User.username == form_data.username)
    ).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        logger.warning("Login failed for user: %s", form_data.username)
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    access_token = create_access_token(data={"sub": user.username})
    logger.info("Login succeeded: %s", user.username)
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/users/me", response_model=UserRead)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
