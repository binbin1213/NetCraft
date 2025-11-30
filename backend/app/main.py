from typing import List, Dict, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import Session, select
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from jose import JWTError, jwt

load_dotenv()

from .database import create_db_and_tables, get_session
from .models import Project, ProjectCreate, ProjectRead, ProjectUpdate, User, UserCreate, UserRead, UserLogin
from .services.ai_service import chat_stream
from .auth import get_password_hash, verify_password, create_access_token, SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="NetCraft API", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth Dependencies ---
async def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exception
    return user

@app.get("/")
def read_root():
    return {"message": "Welcome to NetCraft API"}

# --- AI Chat Routes ---

class ChatMessage(BaseModel):
    role: str
    content: str

class LLMConfig(BaseModel):
    provider: str = "dashscope"  # dashscope, openai, deepseek, etc.
    model: str = "qwen-turbo"
    api_key: Optional[str] = None
    base_url: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    config: Optional[LLMConfig] = None
    # Backward compatibility
    api_key: Optional[str] = None

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    # Convert Pydantic models to dicts
    messages = [msg.model_dump() for msg in request.messages]
    
    # Merge backward compatible api_key into config if needed
    config = request.config or LLMConfig()
    if request.api_key and not config.api_key:
        config.api_key = request.api_key
        
    return StreamingResponse(
        chat_stream(messages, config.model_dump()), 
        media_type="text/event-stream"
    )

# --- Auth Routes ---

@app.post("/register", response_model=UserRead)
def register(user: UserCreate, session: Session = Depends(get_session)):
    existing_user = session.exec(select(User).where(User.username == user.username)).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, email=user.email, password_hash=hashed_password)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserRead)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# --- Project Routes (Protected) ---

@app.post("/projects/", response_model=ProjectRead)
def create_project(
    project: ProjectCreate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_project = Project.model_validate(project)
    db_project.user_id = current_user.id # Associate with user
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@app.get("/projects/", response_model=List[ProjectRead])
def read_projects(
    offset: int = 0, 
    limit: int = 100, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # Filter projects by current user
    projects = session.exec(
        select(Project)
        .where(Project.user_id == current_user.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return projects

@app.get("/projects/{project_id}", response_model=ProjectRead)
def read_project(
    project_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    return project

@app.put("/projects/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int, 
    project: ProjectUpdate, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    db_project = session.get(Project, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    if db_project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this project")
    
    project_data = project.model_dump(exclude_unset=True)
    for key, value in project_data.items():
        setattr(db_project, key, value)
    
    session.add(db_project)
    session.commit()
    session.refresh(db_project)
    return db_project

@app.delete("/projects/{project_id}")
def delete_project(
    project_id: int, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this project")
    session.delete(project)
    session.commit()
    return {"ok": True}
