"""Application assembly.

Route logic lives in ``app/api/routes/*``; this module only wires things up.
"""

from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import auth as auth_routes
from .api.routes import chat as chat_routes
from .api.routes import projects as project_routes
from .core.config import ALLOWED_ORIGINS, LOG_LEVEL
from .core.logging import configure_logging, get_logger
from .database import create_db_and_tables

configure_logging(LOG_LEVEL)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    logger.info("NetCraft API starting (origins=%s)", ALLOWED_ORIGINS)
    yield
    logger.info("NetCraft API shutting down")


app = FastAPI(title="NetCraft API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(project_routes.router)
app.include_router(chat_routes.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to NetCraft API"}


@app.get("/health")
def health():
    """Liveness probe for the container orchestrator."""
    return {"status": "ok"}
