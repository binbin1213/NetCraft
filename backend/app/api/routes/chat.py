"""Streaming AI chat endpoint."""

from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ...models import User
from ...services.ai_service import chat_stream
from ...core.logging import get_logger
from ..deps import get_current_user

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class LLMConfig(BaseModel):
    provider: str = "dashscope"
    model: str = "qwen-turbo"
    api_key: Optional[str] = None
    base_url: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    config: Optional[LLMConfig] = None
    # Backward compatibility with the original request shape
    api_key: Optional[str] = None


@router.post("/chat")
async def chat_endpoint(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    messages = [msg.model_dump() for msg in request.messages]

    config = request.config or LLMConfig()
    if request.api_key and not config.api_key:
        config.api_key = request.api_key

    logger.info(
        "Chat request: user=%s provider=%s messages=%d",
        current_user.username,
        config.provider,
        len(messages),
    )
    # Chunks are plain text, not SSE frames; label the stream accordingly.
    return StreamingResponse(
        chat_stream(messages, config.model_dump()),
        media_type="text/plain; charset=utf-8",
    )
