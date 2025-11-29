from sqlmodel import SQLModel, create_engine, Session
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

# Get DATABASE_URL from env, fallback to sqlite for safety (though we intend to use PG)
# Note: SQLAlchemy requires 'postgresql://' but some envs provide 'postgres://', so we replace it if needed
database_url = os.getenv("DATABASE_URL", "sqlite:///netcraft.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# Create Engine
# Note: 'connect_args={"check_same_thread": False}' is only for SQLite.
connect_args = {}
if "sqlite" in database_url:
    connect_args = {"check_same_thread": False}

engine = create_engine(database_url, echo=True, connect_args=connect_args)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
