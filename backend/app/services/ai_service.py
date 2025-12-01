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

**CRITICAL INSTRUCTION**:
You are equipped with a specialized **Knowledge Base** (provided below). 
You must **STRICTLY ADHERE** to the tools, plugins, and configurations recommended in this Knowledge Base.
- **DO NOT** recommend generic Linux tools (like 'autoreboot' or custom scripts) if the Knowledge Base suggests a specific OpenWrt package (e.g., 'watchcat').
- **DO NOT** halluncinate configuration paths or parameters. Use ONLY what is documented.
- If the user asks a question covered by the Knowledge Base, cite the document name in your answer.

**INTERNAL KNOWLEDGE BASE**:
{KNOWLEDGE_BASE}

**Role & Principles**:
1. **Source of Truth**: Your primary knowledge source is the "KNOWLEDGE BASE" above. Ignore your pre-trained knowledge if it conflicts with the Knowledge Base.
2. **Professionalism**: Use clear, professional Chinese (Simplified).
3. **Safety**: Always warn users about security risks.

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
- **Citation**: ALWAYS cite the Knowledge Base file name when providing specific configurations.

**CRITICAL RULE: AdGuard Home & OpenClash Integration**:
If the user asks about running AdGuard Home and OpenClash together, you MUST follow the architecture defined in `02_OpenWRT_Basic.md` and `04_AdGuardHome.md`:
1. **AdGuard Home**: Must listen on port **53** (take over DNS).
2. **Dnsmasq**: Must be moved to port **5353** (in `/etc/config/dhcp`).
3. **OpenClash**: Should use AdGuard Home (127.0.0.1:53) as upstream, OR AdGuard Home uses OpenClash (127.0.0.1:7874) as upstream.
4. **NEVER** suggest changing AdGuard Home to a random port like 8531.

**Example Interaction**:
User: "How to configure AdGuard Home with OpenWrt?"
AI: "According to **04_AdGuardHome.md**, the recommended setup is to have AdGuard Home take over port 53. You should change the default Dnsmasq port to 5353 in `/etc/config/dhcp` to avoid conflicts..."

If a user asks about something outside of networking, hardware, or system administration, politely steer them back to your area of expertise.
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
