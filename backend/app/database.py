from sqlmodel import SQLModel, create_engine, Session

from .core.config import DATABASE_URL
from .core.logging import get_logger

logger = get_logger(__name__)

# SQLAlchemy requires 'postgresql://' but some environments provide 'postgres://'
database_url = DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# 'check_same_thread' is only meaningful (and only allowed) for SQLite.
connect_args = {}
if database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# echo=True would log every statement with its parameters, including password
# hashes, so it is opt-in for debugging only.
engine = create_engine(
    database_url,
    echo=logger.isEnabledFor(10),  # DEBUG
    connect_args=connect_args,
)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
