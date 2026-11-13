import os
from http import HTTPStatus
from typing import Any, Dict, Generator, List, Optional

import dashscope
from openai import OpenAI

from .knowledge_base import build_knowledge_section, detect_topics

# DASHSCOPE_API_KEY may come from the environment or be supplied per request
# (BYOK). It is resolved per call so concurrent users do not share credentials.

# Kept deliberately short: every character here is paid on every request.
# Project-specific facts live in the knowledge block, not here.
BASE_PROMPT = """You are NetCraft AI, a senior network architecture and OpenWRT expert.
Answer in the user's language (default: Simplified Chinese). Be concrete; never invent
config paths, ports or parameters — if unsure, say so and point to official docs.

**Behaviour**
- A greeting or general question gets a greeting and an offer to help. Do NOT analyse
  the topology or change the canvas unless the user explicitly asks (e.g. "check my
  network", "optimize this"), or the change follows directly from their request.
- When advice comes from the Knowledge Base below, cite the document name.
- Format with Markdown; use numbered steps for procedures.

**Canvas actions**
Only when the user asks for a change, append ONE fenced json block at the very end:

```json
{{"action": "update_topology", "nodes": [ ...only added/changed nodes... ], "edges": [ ...only new edges... ]}}
```
or
```json
{{"action": "auto_layout", "direction": "TB"}}
```

**Topology fields worth reading**: `interfaceCount` (port count), `managementPort`
(web UI), `services` (running services and their ports).
"""


def build_system_prompt(messages: List[Dict[str, Any]]) -> str:
    """Assemble the system prompt for this conversation.

    The knowledge block is selected per request: core constraints always,
    topic documents only when the conversation mentions them.
    """
    topics = detect_topics(messages)
    knowledge = build_knowledge_section(topics)
    return (
        BASE_PROMPT
        + "\n**KNOWLEDGE BASE** (curated for this conversation):\n"
        + knowledge
        + "\n"
    )


def chat_stream(messages: List[Dict[str, str]], config: Dict[str, Any] = None) -> Generator[str, None, None]:
    # Default config
    if config is None:
        config = {}
    
    provider = config.get("provider", "dashscope")
    model = config.get("model", "qwen-turbo")
    api_key = config.get("api_key")
    base_url = config.get("base_url")

    # Prepare messages with the per-conversation system prompt
    system_prompt = build_system_prompt(messages)
    msgs = [{'role': 'system', 'content': system_prompt}] + messages

    if provider == "dashscope":
        yield from _stream_dashscope(msgs, model, api_key)
    elif provider in ["openai", "deepseek", "moonshot", "claude", "gemini"]:
        yield from _stream_openai_compatible(msgs, model, api_key, base_url)
    else:
        yield f"Error: Unsupported provider '{provider}'"

def _stream_dashscope(messages: List[Dict[str, Any]], model: str, api_key: Optional[str]) -> Generator[str, None, None]:
    # Resolve the key per request instead of mutating the module-level global,
    # otherwise concurrent users would overwrite each other's credentials.
    effective_key = api_key or os.getenv("DASHSCOPE_API_KEY")

    if not effective_key:
        yield "错误：DashScope API Key 缺失。请在后端环境变量或设置中配置。"
        return

    try:
        responses = dashscope.Generation.call(
            model=model,
            messages=messages,
            api_key=effective_key,
            result_format='message',
            stream=True,
            incremental_output=True
        )

        for response in responses:
            if response.status_code == HTTPStatus.OK:
                if response.output.choices and response.output.choices[0].message.content:
                    yield response.output.choices[0].message.content
            else:
                yield f"Error: {response.code} - {response.message}"
                
    except Exception as e:
        yield f"Exception: {str(e)}"

def _stream_openai_compatible(messages: List[Dict[str, Any]], model: str, api_key: Optional[str], base_url: Optional[str]) -> Generator[str, None, None]:
    if not api_key:
        yield "错误：缺少 API Key。请在设置中配置 API Key。"
        return

    try:
        client = OpenAI(api_key=api_key, base_url=base_url)
        
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True
        )

        for chunk in stream:
            if chunk.choices[0].delta.content is not None:
                yield chunk.choices[0].delta.content
                
    except Exception as e:
        yield f"Exception: {str(e)}"
