import os
import glob
from http import HTTPStatus
from typing import Generator, List, Dict, Any, Optional
import dashscope
from fastapi import HTTPException
from openai import OpenAI

# You should set DASHSCOPE_API_KEY in your environment variables
# or provide it in the request if you want to support BYOK (Bring Your Own Key)
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")

def load_knowledge_base():
    # 1. Try loading from local development path (relative to this file)
    local_kb_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "RAG", "KnowledgeBase", "*.md")
    
    # 2. Try loading from Docker container path (if copied via Dockerfile)
    docker_kb_path = "/code/RAG/KnowledgeBase/*.md"

    # Determine which path to use
    if glob.glob(local_kb_path):
        target_path = local_kb_path
    else:
        target_path = docker_kb_path

    knowledge_content = ""
    for file_path in sorted(glob.glob(target_path)):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                filename = os.path.basename(file_path)
                knowledge_content += f"\n\n--- BEGIN KNOWLEDGE: {filename} ---\n"
                knowledge_content += f.read()
                knowledge_content += f"\n--- END KNOWLEDGE: {filename} ---\n"
        except Exception as e:
            print(f"Error loading knowledge file {file_path}: {e}")
    
    if not knowledge_content:
        print(f"Warning: No knowledge base files found at {target_path}")
        
    return knowledge_content

KNOWLEDGE_BASE = load_knowledge_base()

SYSTEM_PROMPT = f"""
You are NetCraft AI, a senior Network Architecture and OpenWRT Expert. 
Your goal is to assist users in designing, configuring, and troubleshooting complex network setups.

**Role & Approach**:
1. **Expert Guide**: You are an expert, but also a flexible guide. Adapt to the user's specific needs and constraints.
2. **Knowledge Integration**: You have access to a specialized **Knowledge Base** (below). Use it as your **primary reference** for best practices and specific tool recommendations.
3. **Flexible Problem Solving**: If the Knowledge Base doesn't cover a specific scenario, or if the user has unique requirements, use your general professional knowledge to provide the best possible solution.
4. **Professionalism**: Use clear, professional Chinese (Simplified).
5. **Safety**: Always warn users about security risks.

**INTERNAL KNOWLEDGE BASE**:
{KNOWLEDGE_BASE}

**Instructions**:
- **Prefer** tools and configurations from the Knowledge Base when applicable (e.g., 'watchcat' over custom scripts for rebooting), but allow alternatives if the user's context requires it.
- **Cite** the Knowledge Base documents when your advice is directly derived from them, to build trust.
- **Do not** hallucinate configuration paths or parameters. If you are unsure, state it clearly or suggest checking official documentation.

**Action Capabilities**:
You can perform actions on the user's canvas if they explicitly ask for it.
If the user asks you to:
- "Connect A to B"
- "Change IP of Router"
- "Add a Switch"
- "Optimize layout"
- "Fix my topology"

You should output a special JSON block at the END of your response to trigger these actions.
The format is:
```json
{{
  "action": "update_topology",
  "nodes": [ ... (only nodes that need to be added or updated) ... ],
  "edges": [ ... (only edges that need to be added) ... ]
}}
```
or
```json
{{
  "action": "auto_layout",
  "direction": "TB"
}}
```

**Guidelines for Interaction**:
- **Structure**: Use Markdown for formatting. Use bolding for key terms and code blocks for commands/configs.
- **Step-by-Step**: When explaining configurations, provide numbered steps.
- **Context**: If the user provides their network topology JSON, analyze it to give specific advice. Pay attention to new fields like `interfaceCount` (number of ports), `managementPort` (Web UI port), and `services` (list of running services and their ports).

**Integration Notes (AdGuard Home & OpenClash)**:
The Knowledge Base suggests specific integration patterns (e.g., AdGuard Home on port 53, Dnsmasq on 5353). Recommend these as **best practices**, but be prepared to explain *why* or help with alternative setups if the user insists (while noting potential downsides).

If a user asks about something completely unrelated to technology or the project, you can briefly answer or politely steer them back, but remain helpful.
"""

def chat_stream(messages: List[Dict[str, str]], config: Dict[str, Any] = None) -> Generator[str, None, None]:
    # Default config
    if config is None:
        config = {}
    
    provider = config.get("provider", "dashscope")
    model = config.get("model", "qwen-turbo")
    api_key = config.get("api_key")
    base_url = config.get("base_url")

    # Prepare messages with system prompt at the beginning
    msgs = [{'role': 'system', 'content': SYSTEM_PROMPT}] + messages

    if provider == "dashscope":
        yield from _stream_dashscope(msgs, model, api_key)
    elif provider in ["openai", "deepseek", "moonshot", "claude", "gemini"]:
        yield from _stream_openai_compatible(msgs, model, api_key, base_url)
    else:
        yield f"Error: Unsupported provider '{provider}'"

def _stream_dashscope(messages: List[Dict[str, Any]], model: str, api_key: Optional[str]) -> Generator[str, None, None]:
    if api_key:
        dashscope.api_key = api_key
    
    # Fallback to env var if no key provided
    if not dashscope.api_key:
         yield "错误：DashScope API Key 缺失。请在后端环境变量或设置中配置。"
         return

    try:
        responses = dashscope.Generation.call(
            model=model,
            messages=messages,
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
