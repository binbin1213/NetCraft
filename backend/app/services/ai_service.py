import os
import glob
from http import HTTPStatus
from typing import Generator, List, Dict, Any
import dashscope
from fastapi import HTTPException

# You should set DASHSCOPE_API_KEY in your environment variables
# or provide it in the request if you want to support BYOK (Bring Your Own Key)
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")

def load_knowledge_base():
    kb_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "RAG", "KnowledgeBase", "*.md")
    knowledge_content = ""
    for file_path in sorted(glob.glob(kb_path)):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                filename = os.path.basename(file_path)
                knowledge_content += f"\n\n--- BEGIN KNOWLEDGE: {filename} ---\n"
                knowledge_content += f.read()
                knowledge_content += f"\n--- END KNOWLEDGE: {filename} ---\n"
        except Exception as e:
            print(f"Error loading knowledge file {file_path}: {e}")
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
{{KNOWLEDGE_BASE}}

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

def chat_stream(messages: List[Dict[str, str]], api_key: str = None) -> Generator[str, None, None]:
    if api_key:
        dashscope.api_key = api_key
        
    if not dashscope.api_key:
        yield "Error: DashScope API Key is missing. Please configure it in the backend or settings."
        return

    # Prepare messages with system prompt at the beginning
    msgs = [{'role': 'system', 'content': SYSTEM_PROMPT}] + messages

    try:
        responses = dashscope.Generation.call(
            model=dashscope.Generation.Models.qwen_turbo, # or qwen-plus/max for better performance
            messages=msgs,
            result_format='message',  # set the result to be "message" format.
            stream=True,
            incremental_output=True  # get streaming output incrementally
        )

        for response in responses:
            if response.status_code == HTTPStatus.OK:
                if response.output.choices and response.output.choices[0].message.content:
                    yield response.output.choices[0].message.content
            else:
                yield f"Error: {response.code} - {response.message}"
                
    except Exception as e:
        yield f"Exception: {str(e)}"
