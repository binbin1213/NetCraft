# NetCraft 维度 06：AI 能力链路（RAG 与动作协议）

Route: C
时间基准：2026-11-13

## 架构

链路是：前端 `AiAssistant` → `POST /api/chat` → `chat_stream` 拼 system prompt → DashScope 或 OpenAI 兼容 SDK 流式返回 → 前端拼接 → 正则匹配 JSON 动作块 → 改 store。

## RAG 实为「整库注入」

`load_knowledge_base()` 用 glob 读 `RAG/KnowledgeBase/*.md` 全部拼接成一个字符串，在**模块导入时**执行一次，然后整段塞进 system prompt[^dim06-rag]。

- 知识库 5 个文件、19,631 bytes / 11,957 字符。按中文约 1.5-2 字符/token 估算，约 6k-8k tokens，每次对话都随 system prompt 全量发送。
- 没有切片、没有检索、没有向量库、没有重排。所谓 RAG 是「把 5 个文档全文贴在提示词里」。
- 文件路径用四层 `dirname` 拼 `RAG/KnowledgeBase`，容器内 fallback 到 `/code/RAG/KnowledgeBase`[^dim06-path]。Dockerfile 确实 COPY 了该目录，所以容器内可用；但本地开发时若工作目录变动则会静默降级为空知识库（只打印一行 Warning）。

这套做法在当前规模（5 篇、约 12k 字符）是合理的工程折中——比搭向量库便宜得多。但它是**规模不可扩展**的：知识库涨到 50 篇就必然超出上下文。而且模型对「引用知识库文档」的指令只是软约束，无法验证引用真实性。

## 动作协议靠正则 + 字符串匹配

system prompt 规定模型在回复末尾输出 ```json {"action": "update_topology"|"auto_layout"} ``` 代码块[^dim06-protocol]。前端用正则 `/```json\s*(\{\s*"action":[\s\S]*?\})\s*```/` 提取[^dim06-regex]。

三个具体问题：

1. **`auto_layout` 分支前端完全没实现**。prompt 里教模型输出这个动作，解析代码只 `if (actionData.action === 'update_topology')`[^dim06-only-update]。模型按指令返回 `auto_layout` 时，用户看到「我帮你重新布局了」，画布纹丝不动。
2. **正则要求 JSON 紧跟 ` ```json ` 且以 `"action"` 开头**。模型多打一个空格、加注释、或先输出别的字段就会匹配失败——静默失败，无任何提示。
3. **边不做去重**：`setEdges([...currentEdges, ...actionData.edges])` 直接拼接[^dim06-edges]。用户手动连过 A→B 后让 AI 再连一次，会出现两条重叠的边。而手动连线路径 `onConnect` 是做了双向去重的——两条路径规则不一致。

## 凭据处理

前端的 LLM 配置（provider/model/api_key/base_url）存在 `localStorage['llm_config']` 明文里[^dim06-localstorage]，并与后端全局 `dashscope.api_key` 的串号问题叠加（见 dim03）。对个人自部署可接受，对多用户部署不可接受。

## 提示词工程的成熟度

这部分反而是项目里质量最高的代码之一：system prompt 有明确的角色设定、知识库优先、禁止幻觉路径、区分「打招呼」与「要求改拓扑」、要求用 Markdown 和编号步骤[^dim06-prompt]。还专门有一条提交 `fix: restrict AI from proactively analyzing topology or modifying canvas on simple greetings` 来修「AI 主动改画布」的问题——说明作者对 LLM 行为边界有实际调试经验。

## 模型与成本

默认 `qwen-turbo`，前端下拉支持 DashScope / OpenAI / DeepSeek / Moonshot / Claude / Gemini。但后端 `_stream_openai_compatible` 用同一个 OpenAI SDK 打所有非 DashScope 的 provider[^dim06-compat]：Claude 与 Gemini 的官方 API 并不兼容 OpenAI 协议，选这两项必须用户自己填一个兼容网关的 base_url，否则必然报错。UI 上的 6 个选项里实际开箱可用的是 DashScope 和（配 base_url 后的）OpenAI 兼容系。

[^dim06-rag]: File: backend/app/services/ai_service.py, lines 13-42.
[^dim06-path]: File: backend/app/services/ai_service.py, lines 14-24; backend/Dockerfile, line 15.
[^dim06-protocol]: File: backend/app/services/ai_service.py, lines 66-91.
[^dim06-regex]: File: frontend/src/components/AiAssistant/AiAssistant.tsx, line 175.
[^dim06-only-update]: File: frontend/src/components/AiAssistant/AiAssistant.tsx, lines 179-201.
[^dim06-edges]: File: frontend/src/components/AiAssistant/AiAssistant.tsx, lines 196-199 vs store/useStore.ts, lines 175-194.
[^dim06-localstorage]: File: frontend/src/components/AiAssistant/AiAssistant.tsx, line 58.
[^dim06-prompt]: File: backend/app/services/ai_service.py, lines 44-102.
[^dim06-compat]: File: backend/app/services/ai_service.py, lines 117-122.
