# NetCraft 优化执行方案

编制日期：2026-11-13
依据：`netcraft-research/research/netcraft_final.md` 的研究结论
原则：**先止血、再还债、最后加功能**。不重写前端；后端 488 行按阶段替换而非逐行修补。

---

## 零、先定三条纪律

1. **每改一项，跑一次验证**。前端 `npm run build && npm run lint`，后端 `python -c "import app.main"`，部署 `docker compose build backend`。没有验证的改动不算完成。
2. **文档只写能 grep 到的东西**。删掉或重写 `审查报告.md`、`测试清单.md`——它们当前描述的是不存在的代码，比没有文档更危险。
3. **不动 `nginx.conf` 的 `rewrite` 规则**，除非同时改前端 base URL。原因见附录 A（生产环境的 `/api/api/chat` 双前缀是"能跑但脆弱"的巧合）。

---

## 阶段 1：P0 止血（约 1 天，必须最先做）

目标：让它能安全地给第二个人用，且能按 README 的方式构建。

### 1.1 `SECRET_KEY` 去掉默认值

`backend/app/auth.py:8`

```python
# 改前
SECRET_KEY = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")

# 改后
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "环境变量 SECRET_KEY 未设置。生成方式：openssl rand -hex 32"
    )
```

**副作用**：本地直接 `uvicorn app.main:app` 会立即报错——这是预期行为。需在启动前 `export SECRET_KEY=...`，或建 `backend/.env`（已在 `.gitignore` 中）。

**验证**：不设变量启动 → 报 RuntimeError；设置后启动 → 正常。

### 1.2 修 JWT 有效期矛盾

`backend/app/auth.py:20-27`

```python
# 改前
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)

# 改后
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
```

现在 `ACCESS_TOKEN_EXPIRE_MINUTES = 60*24*7`（7 天）才真正生效，用户不会 15 分钟被踢下线。

**验证**：登录拿 token，`python -c` 解出 `exp - iat` ≈ 604800 秒。

### 1.3 `/api/chat` 加鉴权（**必须同时改前端**）

后端 `backend/app/main.py:79-80`

```python
# 改前
@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):

# 改后
@app.post("/api/chat")
async def chat_endpoint(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
```

前端 `frontend/src/components/AiAssistant/AiAssistant.tsx:135-137`

```ts
// 改前
const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },

// 改后
const token = useStore.getState().token;
if (!token) {
    message.warning('请先登录后再使用 AI 助手');
    return;
}
const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    },
```

**顺序很重要**：先改前端会让未登录用户看到明确提示；先改后端会让 AI 助手直接 401。建议同一次提交完成。

**验证**：未登录点发送 → 提示登录；登录后 → 正常流式返回。

### 1.4 `dashscope.api_key` 去掉全局改写

`backend/app/services/ai_service.py`

```python
# 改前（第 11 行，模块级）
dashscope.api_key = os.getenv("DASHSCOPE_API_KEY")

# 改后：删除这一行

# 改前（第 124-132 行）
def _stream_dashscope(messages, model, api_key):
    if api_key:
        dashscope.api_key = api_key
    if not dashscope.api_key:
         yield "错误：DashScope API Key 缺失。请在后端环境变量或设置中配置。"
         return
    try:
        responses = dashscope.Generation.call(model=model, messages=messages, ...)

# 改后
def _stream_dashscope(messages, model, api_key):
    effective_key = api_key or os.getenv("DASHSCOPE_API_KEY")
    if not effective_key:
        yield "错误：DashScope API Key 缺失。请在后端环境变量或设置中配置。"
        return
    try:
        responses = dashscope.Generation.call(
            model=model,
            messages=messages,
            api_key=effective_key,      # 每次调用传参，不再污染全局
            result_format='message',
            stream=True,
            incremental_output=True,
        )
```

**验证**：两个并发请求分别带不同 key，日志确认各用各的（可临时打印 key 后 4 位）。

### 1.5 CORS 接上 `ALLOWED_ORIGINS`

`backend/app/main.py`

```python
# 顶部补 import（当前文件没有 import os）
import os

# 第 31 行改前
    allow_origins=["http://localhost:5173"], # Frontend URL

# 改后
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
...
    allow_origins=ALLOWED_ORIGINS,
```

**注意**：`allow_credentials=True` 与 `allow_origins=["*"]` 在 CORS 规范下互斥，浏览器会拒绝。若要通配，需改用 `allow_origin_regex`。

### 1.6 compose 补传环境变量

`docker-compose.yml` 与 `docker-compose.prod.yml` 的 backend `environment`：

```yaml
    environment:
      - DATABASE_URL=postgresql://netcraft:netcraft_secret@db:5432/netcraft_db
      - DASHSCOPE_API_KEY=${DASHSCOPE_API_KEY}
      - SECRET_KEY=${SECRET_KEY}              # 新增
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}    # 新增
```

同时把 `POSTGRES_PASSWORD` 也参数化（当前 `netcraft_secret` 两处硬编码）：

```yaml
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-netcraft_secret}
```

**验证**：`docker compose config` 确认变量已展开；`docker compose up -d backend` 后 `docker compose exec backend env | grep SECRET`。

### 1.7 修 Docker 构建上下文（一行改动）

**根因**：`backend/Dockerfile` 需要同时 COPY `backend/` 与仓库根的 `RAG/`，所以上下文**必须是仓库根**。当前 compose 用的是 `./backend`，与 CI 的 `context: .` 不一致。

`docker-compose.yml:21`

```yaml
# 改前
    build: ./backend

# 改后
    build:
      context: .
      dockerfile: backend/Dockerfile
```

`scripts/publish_images.sh:37`

```bash
# 改前
docker build -t $USERNAME/netcraft-backend:latest ./backend

# 改后
docker build -f backend/Dockerfile -t $USERNAME/netcraft-backend:latest .
```

**同时新增 `.dockerignore`**（仓库根，当前不存在）——否则根上下文会把 `frontend/node_modules`（数百 MB）和 `.git` 全发给 daemon：

```
.git
frontend/node_modules
frontend/dist
backend/**/__pycache__
**/*.pyc
.DS_Store
netcraft-research
```

**验证**：`docker compose build backend` 成功；`docker compose up -d` 后 `curl localhost/api/`（经 nginx）或 `curl localhost:8000/` 返回 `{"message":"Welcome to NetCraft API"}`。

### 1.8 修密码策略缺失（让 4 份测试有意义）

`backend/app/auth.py` 末尾新增：

```python
import re

def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if len(password) > 128:
        raise ValueError("Password must be at most 128 characters long")
    if not re.search(r'[A-Z]', password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r'[0-9]', password):
        raise ValueError("Password must contain at least one number")
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]', password):
        raise ValueError("Password must contain at least one special character")
```

`backend/app/models.py`：

```python
from pydantic import field_validator
from .auth import validate_password

class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def _check_password(cls, v: str) -> str:
        validate_password(v)
        return v
```

**注意**：函数签名与 4 份测试的期望完全一致（`ValueError` + 英文消息），实现后 3 份原本 ImportError 的测试会自动变绿。

**验证**：
```bash
cd backend && python -m pytest tests/ -v
curl -X POST localhost:8000/register -H 'Content-Type: application/json' \
  -d '{"username":"t","password":"1"}'   # 期望 422
```

---

## 阶段 2：P1 还债（约 2-3 天）

### 2.1 合并两套项目系统（最大的一块）

**现状**：本地 `useStore.projects`（uuid，localStorage）与云端 `/projects/`（number，API）完全平行。

**推荐方案：服务端为唯一真相源，本地只做草稿。**

| 步骤 | 文件 | 动作 |
|---|---|---|
| 1 | `store/useStore.ts` | 删除 `projects`、`createProject`、`loadProject`、`saveProject`、`deleteProject`、`renameProject`、`currentProjectId`（约 90 行） |
| 2 | `store/useStore.ts` | 新增 `currentProjectId: number \| null` + `setCurrentProjectId`（仅此一项） |
| 3 | `components/Canvas/Canvas.tsx` | 把内联的 `useState<number\|null>` 换成 store 里的 `currentProjectId`，删掉本地 state |
| 4 | `components/ProjectManager.tsx` | 改为调用 `api.getProjects/createProject/deleteProject`，异步加载 |
| 5 | `components/AutoSave.tsx` | 改为 debounce 3s 调 `api.updateProject`，仅当 `token && currentProjectId` 时生效 |
| 6 | `components/Sidebar/Sidebar.tsx` | 「项目」入口保留，指向改造后的 ProjectManager |

**为什么这样切**：`Canvas.tsx` 已经有一套完整可用的云端 CRUD（保存/加载/删除），只是状态放在组件里。把它提升到 store 后，`ProjectManager` 与 `AutoSave` 复用同一份状态，本地那套就能整体删除。

**风险点**：已存在于用户 localStorage 的 `netcraft-storage` 里的 `projects` 字段。在 `persist` 的 `migrate` 里丢弃该字段即可（`delete persistedState.projects`）。

**验证**：登录 → 保存 → 刷新页面 → 从云端列表加载 → 节点与连线一致；退出登录 → 保存按钮提示登录。

### 2.2 补 AI 的 `auto_layout` 分支

`frontend/src/components/AiAssistant/AiAssistant.tsx:176-205`，在 `update_topology` 分支后追加：

```ts
} else if (actionData.action === 'auto_layout') {
    const { nodes: lNodes, edges: lEdges } = getLayoutedElements(
        useStore.getState().nodes,
        useStore.getState().edges,
        actionData.direction || 'TB'
    );
    useStore.getState().setNodes(lNodes);
    useStore.getState().setEdges(lEdges);
    message.success('已自动布局');
}
```

需要 `import { getLayoutedElements } from '../../utils/autoLayout';`

### 2.3 AI 加边复用去重逻辑

把 `useStore` 里 `onConnect` 的去重判断抽成纯函数：

```ts
// utils/graph.ts
export const edgeExists = (edges: Edge[], source: string, target: string) =>
    edges.some(e =>
        (e.source === source && e.target === target) ||
        (e.source === target && e.target === source)
    );
```

`onConnect` 与 AI 分支都调用它。当前 AI 路径是裸拼接 `[...currentEdges, ...actionData.edges]`，会产出重叠边。

### 2.4 结构化 `docs/` 并重写可疑文档

| 文件 | 处置 |
|---|---|
| `审查报告.md` | **删除**。它描述的三项修复从未落地，保留即误导。 |
| `可观测性增强建议.md` | 移到 `docs/proposals/`，标题加「未实施」 |
| `测试清单.md` | 重写路由（`/api/users/`→`/register` 等），或删除 |
| `PROJECT_STATUS.md` | 用实际代码状态重写：删掉"待开发"里的图片导出/后端持久化/模板系统，补上真实的未实现项（环路检测、JSON 导入） |
| `README.md` | 删掉「云端自动保存」「完美中英切换」「企业级安全」三处；补「已知限制」小节 |

### 2.5 git 卫生

```bash
git rm --cached .DS_Store .github/.DS_Store
git rm -r --cached backend/app/__pycache__ backend/app/services/__pycache__
printf '\n# Python bytecode\n__pycache__/\n*.py[cod]\n' >> .gitignore
```

`.gitignore` 里已有 `backend/__pycache__/`，但实际路径是 `backend/app/__pycache__/`，规则没覆盖到——这是它们被提交的原因。

---

## 阶段 3：P2 质量（约 3-4 天）

### 3.1 后端分层（488 行值得重排，不值得逐行修）

目标结构：

```
backend/app/
├── main.py              # 只留 app 创建、中间件、router 注册（~40 行）
├── core/
│   ├── config.py        # SECRET_KEY / ALLOWED_ORIGINS / DATABASE_URL 集中读取 + 校验
│   └── security.py      # 原 auth.py
├── models.py
├── database.py
├── api/
│   ├── deps.py          # get_current_user
│   ├── auth.py          # /register /token /users/me
│   ├── projects.py      # 5 个 CRUD
│   └── chat.py          # /api/chat
└── services/
    ├── ai_service.py
    └── project_service.py  # 授权校验从路由里挪出来
```

**收益**：`project_service.py` 把 `if project.user_id != current_user.id: 403` 这行重复 3 次的逻辑收敛到一处；`core/config.py` 让所有必需环境变量在启动时一次性校验，而不是散落在 `os.getenv` 里。

**顺序**：先抽 `config.py`（改动小、收益立现）→ 再拆 routers（纯搬移）→ 最后抽 service。每步都能独立构建通过。

### 3.2 测试基础设施

| 项 | 动作 |
|---|---|
| 依赖 | 新增 `backend/requirements-dev.txt`：`pytest`、`httpx`、`pytest-asyncio` |
| 配置 | 新增 `backend/pytest.ini`，`testpaths = tests`，`pythonpath = .` |
| 测试库 | `conftest.py` 用 `sqlite:///./test.db` + `dependency_overrides` 替换 session |
| **前置改动** | `models.py` 的 `JSONB` 改 `JSON`（SQLAlchemy 通用类型）。否则 SQLite 建表失败，测试无法跑 |
| 冒烟用例 | `test_auth.py`：注册→登录→带 token 访问 `/users/me`→无 token 401 |
| 项目隔离 | `test_projects.py`：A 用户建项目，B 用户读取 → 403 |

`JSON` vs `JSONB`：当前数据量下无性能差异，换来的是「测试能在 SQLite 跑」。若坚持 JSONB，就必须在 CI 起 Postgres service 容器——成本更高。

### 3.3 CI 加门禁

`.github/workflows/docker-publish.yml` 在 build 之前插入：

```yaml
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r backend/requirements.txt -r backend/requirements-dev.txt
      - run: cd backend && pytest -q
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd frontend && npm ci && npm run build
  build-and-push:
    needs: test
```

**注意**：`npm run lint` 当前有 29 个 error，直接加会红。建议先 `npm run lint -- --fix` 处理可自动修的 1 个，其余 20 个 `no-explicit-any` 分批清理，lint 作为**非阻塞**检查先观察。

### 3.4 前端 polish（半天，纯收益）

| 问题 | 文件 | 修法 |
|---|---|---|
| Controls 按钮白底不可见 | `index.css` | `.react-flow__controls-button{background:#1e293b;border-bottom:1px solid #334155}.react-flow__controls-button svg{fill:#cbd5e1}` |
| 历史栈无上限 | `store/useStore.ts:79` | `temporal(persist(...), { limit: 50 })` |
| dagre 单例污染 | `utils/autoLayout.ts:4` | 把 `const dagreGraph` 移进 `getLayoutedElements` 函数体 |
| i18n 漏覆盖 | `AiAssistant/Login/Canvas` | 把 533+239+99 个中文字符抽到 `locales/*.ts`，新增约 40 个 key |
| 未用依赖 | `package.json` | `@types/dagre`、`clsx`、`tailwind-merge` 逐个确认，未用的删除 |

### 3.5 SSE 规范化

**当前**：后端 `yield` 裸文本，前端 `reader.read()` 拼字符串。能跑，但不是合法 SSE。

**两个选择**：
- **A（推荐，改动小）**：把 `media_type` 改成 `text/plain; charset=utf-8`，明确「这是分块文本流」，不冒充 SSE。前后端都不用改。
- **B（规范，改动大）**：后端每条 `yield f"data: {chunk}\n\n"`，前端按 `\n\n` 分帧解析。

选 A 的成本是 1 行，且消除「自称 SSE 但格式不符」的隐患。同时在 nginx 的 `/api/` location 加 `proxy_buffering off;`，否则生产环境流式会被缓冲成一次性输出。

---

## 阶段 4：P3 产品（按价值排序）

| 优先级 | 功能 | 理由 | 估算 |
|---|---|---|---|
| 1 | **JSON 导入** | 现在只能导出，是单向的。补齐后拓扑可分享、可版本管理 | 0.5 天 |
| 2 | **环路 / IP 冲突 / 瓶颈检测** | `PROJECT_STATUS.md` 里唯一「说没做也确实没做」的功能，也是区别于普通画图工具的核心 | 2 天 |
| 3 | **知识库结构化** | 把 5 篇文档拆成「设备/服务/端口/依赖」结构化数据，AI 生成的拓扑可追溯到具体条目，大幅降低幻觉 | 3 天 |
| 4 | 模板库扩充 | 当前只有 2 个模板，且 `basic_home` 的 IP 规划（192.168.1.x / 192.168.2.x 混用）本身不自洽 | 1 天 |

**关于 #2 的具体算法**（`PROJECT_STATUS.md` 里已有思路，但写得太粗）：

```ts
// 环路：并查集比 DFS 更适合，因为能同时给出"哪条边导致成环"
// IP 冲突：Map<ip, nodeId[]>，同 IP 多节点即冲突（当前生成器保证唯一，但手动改 IP 会撞）
// 瓶颈：给每个 ConnectionType 定速率，路径上取 min，与端点设备标称速率比较
```

展示方式建议：不弹窗，直接在节点/连线上加红色角标 + Minimap 旁一个「问题 (3)」计数，点击定位。这符合现有暗色 UI 的语言。

---

## 附录 A：不要轻易动的三处「能跑但脆弱」

**1. `/api/api/chat` 双前缀**
生产构建 `VITE_API_URL=/api`，前端拼 `${API_BASE_URL}/api/chat` → `/api/api/chat`；nginx `rewrite ^/api/(.*) /$1` → `/api/chat`；后端路由正好是 `/api/chat`。**三处巧合抵消，能跑**。任何一处单独改动都会 404。若要整理，必须三处同改。

**2. `frontend/dist` 与 `node_modules` 不进 git 是对的**
但仓库无 `.dockerignore`，构建时仍会发送。这是阶段 1.7 要补的。

**3. `Project.data` 是 `List[Dict]` 而非 `Dict`**
前端保存时包了一层 `data: [projectData]`，加载时 `if (Array.isArray(data)) data = data[0]`。语义上「一个项目一个拓扑」应该是对象，但改成对象要动前后端 + 数据迁移。**建议保留**，只在 `ProjectUpdate` 加注释说明。

---

## 附录 B：执行顺序与依赖关系

```
阶段1（可并行）
├─ 1.1 SECRET_KEY ─┐
├─ 1.2 JWT 过期    ├─ 同一次提交（都改 auth.py）
├─ 1.8 密码策略 ───┘
├─ 1.3 chat 鉴权 ── 必须前后端同改
├─ 1.4 dashscope key（依赖 1.3 的顺序，先鉴权再解耦 key）
├─ 1.5 CORS ─┐
├─ 1.6 compose env ─┴─ 一起验证（否则容器起不来）
└─ 1.7 Docker context（独立，可最后做）

阶段2
├─ 2.1 项目系统合并 ── 依赖阶段1完成（否则保存仍走未鉴权路径）
├─ 2.2 auto_layout ── 独立
├─ 2.3 边去重 ── 依赖 2.2（同文件）
├─ 2.4 文档重写 ── 可在任意时点做
└─ 2.5 git 卫生 ── 独立，建议最先做（清理后 diff 更干净）

阶段3
├─ 3.1 后端分层 ── 依赖 1.x 全部完成
├─ 3.2 测试基建 ── 依赖 3.1 的目录结构（或先做 conftest，后拆层）
├─ 3.3 CI 门禁 ── 依赖 3.2
├─ 3.4 前端 polish ── 独立，可穿插
└─ 3.5 SSE ── 独立

阶段4：依赖阶段2、3
```

---

## 附录 C：验收总表

| 阶段 | 验收命令 | 通过标准 |
|---|---|---|
| 1.1 | 不设 `SECRET_KEY` 启动 | 抛出 RuntimeError 并说明生成方式 |
| 1.2 | 解析登录返回的 JWT | `exp - iat` = 604800 |
| 1.3 | 未登录调 `/api/chat` | 401；登录后 200 流式 |
| 1.4 | 两个不同 key 并发请求 | 互不影响 |
| 1.5 | `ALLOWED_ORIGINS=https://a.com` 后 `curl -H 'Origin: https://a.com'` | 响应头含该 origin |
| 1.6 | `docker compose config` | `SECRET_KEY` 已展开且非空 |
| 1.7 | `docker compose build backend` | 成功；镜像内 `/code/RAG/KnowledgeBase` 存在 |
| 1.8 | `pytest backend/tests -q` | 全绿 |
| 2.1 | 登录→保存→刷新→加载 | 拓扑一致；退出后保存提示登录 |
| 2.2 | 让 AI「重新布局」 | 画布实际重排 |
| 2.3 | 手动连 A→B 后再让 AI 连 | 只有一条边 |
| 3.1 | `python -c "import app.main"` | 无循环导入 |
| 3.2 | `pytest -q` | 覆盖 auth + projects 至少 8 个用例 |
| 3.3 | 推送 main | test job 先于 build job |
| 3.4 | 浏览器 1600×950 | 缩放按钮清晰可见 |
| 3.5 | `curl -N localhost/api/api/chat` | 逐块输出，非一次性 |

---

## 附录 D：不建议做的事

| 想法 | 为什么不建议 |
|---|---|
| 重写后端为完整 DDD 分层 | 488 行不值得。按 3.1 的目录拆分即可，够用 |
| 引入 Redis / 消息队列 | 没有任何场景需要。AI 流式已由 FastAPI 原生支持 |
| 把 Zustand 换成 Redux Toolkit | 现有 store 除了职责过多，技术选型没问题。拆 store 比换库划算 |
| 引入向量数据库做真 RAG | 5 篇文档、12k 字符，整库注入更准更便宜。到 30 篇以上再考虑 |
| 给所有组件补单测 | 前端测试成本高收益低。优先补后端接口测试 + 1-2 个关键交互的 e2e |
| 直接删掉本地项目管理 | 先按 2.1 合并，保留「未登录=草稿」的体验，再决定是否砍 |


---

# 执行记录（2026-11-13）

按本方案实施的第一批改动，全部经过实际运行验证。

## 已完成

| 编号 | 事项 | 验证方式 | 结果 |
|---|---|---|---|
| 1.1 | `SECRET_KEY` 去掉默认值 | 不设变量启动 | 抛 `RuntimeError` 并提示生成命令 |
| 1.2 | JWT 有效期修正常量引用 | 解码 token 的 `exp` | 604800 秒（7 天） |
| 1.3 | `/api/chat` 加鉴权 + 前端补 Authorization | curl + 浏览器 | 未登录 401；已登录但无 Key 返回可读错误 |
| 1.4 | `dashscope.api_key` 改为按请求传参 | 代码审查 + 调用 | 不再改写模块级全局 |
| 1.5 | CORS 接入 `ALLOWED_ORIGINS` | 启动日志/配置核对 | 支持逗号分隔多源 |
| 1.6 | compose 补传 `SECRET_KEY`/`ALLOWED_ORIGINS`/`POSTGRES_PASSWORD` | YAML 解析 | 变量引用正确 |
| 1.7 | Docker 构建上下文改为仓库根 + 新增 `.dockerignore` | 路径比对 | 与 CI 一致（daemon 未运行，未做实际构建） |
| 1.8 | 补齐 `validate_password` 并在 `UserCreate` 上启用 | `POST /register` 弱密码 | 返回 422 |
| 2.1 | 合并两套项目系统（服务端为唯一真相源） | 浏览器端到端 | 新建/打开/自动保存均走 API；localStorage 升至 v2 并丢弃旧 `projects` 字段 |
| 2.2 | 补 `auto_layout` 动作分支 | 浏览器 | 画布实际重排 |
| 2.3 | AI 加边复用去重逻辑 | 代码审查 | 抽出 `utils/graph.ts::edgeExists`，两条路径共用 |
| 2.4 | 文档重写 | 逐条对照 | 删除 `审查报告.md`；建议移至 `docs/proposals/` 并标注未实施；重写 `PROJECT_STATUS.md`、`测试清单.md`；README 删除三处失实描述 |
| 2.5 | git 卫生 | `git ls-files` | 5 个 `.pyc` 移出版本控制；`.gitignore` 补 `**/__pycache__` |
| 3.2 | 测试基建 | `pytest -q` | 35 passed |
| 3.3 | CI 加 test job 门禁 | YAML 解析 | `build-and-push` 加 `needs: test` |
| 3.4 | 前端 polish | 浏览器实测 | Controls 深底浅图标；`temporal` limit 50；dagre 单例改函数内创建 |
| 3.5 | 流式响应类型规范化 | `curl -D -` | `content-type: text/plain; charset=utf-8`；nginx 加 `proxy_buffering off` |

## 额外发现并修复

- **`updated_at` 从不刷新**：`model_dump(exclude_unset=True)` 不会带上 `default_factory` 生成的值，导致「更新于」永远停在创建时间。已在 `update_project` 中显式赋值，并补回归测试。
- **SQLModel 0.0.49+ 拒绝 naive datetime**：原代码用 `datetime.utcnow()`，在新版 SQLModel 下插入即报错。已改为时区感知的 `utcnow()` 辅助函数。
- **依赖未锁版本**：已锁定到实测通过的版本组合，并注明 `sqlmodel` 的兼容约束。
- **`JSONB` 硬编码导致测试不可行**：改为 `JSON().with_variant(JSONB, "postgresql")`，生产仍用 JSONB，测试可跑 SQLite。

## 未做（保持原状）

- **3.1 后端分层**：488 行当前可读，分层属于纯收益但非阻塞的重构，留待后续。
- **i18n 补齐**：AI 助手 533 / 登录 239 / 画布 99 个中文字符仍为硬编码，已记入「已知限制」。
- **前端 lint 的 29 个 `any`**：与改造前基线持平，未新增；属独立清理任务。
- **Docker 实际构建 / 容器启动**：本机 daemon 未运行，无法验证，已在报告中标注。

## 最终验证快照

```
backend: 35 passed in 3.42s
frontend: tsc -b 通过；vite build 成功（1,389.76 kB / gzip 441.29 kB）
lint: 31 problems (29 errors, 2 warnings) —— 与改造前持平
端到端: 注册 200 → 登录 200 → 建项目 200 → 更新 200 → 跨用户读取 403
浏览器: store v2、无残留 projects 字段、自动保存触发、云端恢复 3 个节点
```

## 一处更正

初次研究报告称 `.DS_Store` 已入库。核验 `git ls-tree -r HEAD` 命中 0 次，该结论**不成立**；实际入库的是 5 个 `.pyc` 文件。相关报告文件已同步更正。


---

# 执行记录（第二批，2026-11-13）

在第一批基础上继续推进产品能力与可观测性。

## 新增能力

| 模块 | 文件 | 行数 | 说明 |
|---|---|---|---|
| 拓扑检测引擎 | `frontend/src/utils/validation.ts` | ~200 | 环路（并查集）、IP 冲突、无效 IP、链路超规格、带宽瓶颈、端口溢出、孤立设备、缺出口设备 |
| JSON 导入 | `frontend/src/utils/importTopology.ts` | ~200 | 校验结构、去重无向边、跳过悬空边/自连、未知类型降级并提示、兼容云端项目格式 |
| 检测面板 | `Canvas.tsx` | — | 工具栏按严重度着色显示问题数，列表可点击定位到节点 |
| 配置中心 | `backend/app/core/config.py` | 46 | 环境变量集中读取 + 启动期校验 |
| 日志 | `backend/app/core/logging.py` | 37 | 统一格式输出 stdout，`:memory`/重载安全 |
| 健康检查 | `GET /health` | — | 容器探针 |

## 测试增长

| 项 | 第一批 | 第二批 |
|---|---|---|
| 后端用例 | 35 | **43**（新增配置校验、CORS 解析、启动即失败、健康检查） |
| 前端用例 | 0 | **30**（检测 16 + 导入 14） |

前端首次引入 vitest，`npm run test` 已接入 CI。

## 顺带修复

- **Minimap 节点不可见**：`nodeColor="#334155"` 与画布 `#0f172a` 对比度约 1.5:1，改为 `#94a3b8` + 描边。
- **工具栏溢出**：7 个按钮总宽约 800px，窄屏会溢出，改为 `flex-wrap` + 上限宽度；实测 1700px 单行、1280px 自动两行，均不溢出。
- **SQL 日志泄漏**：`echo=True` 会打印每条 SQL 及其参数（含密码哈希），改为仅在 DEBUG 级别开启。实测 INFO 下 `SELECT`/`INSERT` 出现 0 次。
- **`link-speed-exceeds` 文案 bug**：英文模板把两个占位符都写成 `{{link}}`，显示成「10G exceeds 10G」。

## 测试驱动的规则修正

初版把 `router(2.5G) --1G--> pc(2.5G)` 判定为瓶颈，测试失败暴露了规则过严。改为只在**设备能力 ≥5G 且链路 ≤1G** 时提示——家用场景下 2.5G 网卡接千兆线是常态，不该报警。

## 仍然未做

- **3.1 后端分层**：已抽出 `core/`，但 `main.py` 仍有 200+ 行路由，`api/` + `services/` 拆分留待后续。
- **i18n 完整性**：新增的检测/导入文案已双语，但 AiAssistant(533)、Login(239) 仍是硬编码中文。
- **前端 29 个 lint error**：与基线持平，未新增。
- **Docker 实际构建**：daemon 仍未运行，无法验证。

## 最终验证

```
backend: 43 passed
frontend: 30 passed（vitest）
tsc -b: 通过
vite build: 成功
lint: 31 problems (29 errors) —— 与基线持平
浏览器: 导入 5 节点/去重 4 边、检测出 3 个真实问题、Minimap 可辨、工具栏 1280px 自动折行
日志: 启动 CORS、注册、登录成功/失败、越权 403 均正常记录；INFO 下无 SQL 泄漏
CORS: 配置的两个源放行，未配置源被拒绝
```


---

# 执行记录（第三批，2026-11-13）

收尾阶段：后端分层、i18n 补全、lint 归零。

## 1. 后端分层

`main.py` 从 **284 行降到 51 行**，只负责装配。

```
backend/app/
├── main.py                 51 行：中间件 + include_router + 健康检查
├── api/
│   ├── deps.py             get_current_user
│   └── routes/
│       ├── auth.py         /register /token /users/me
│       ├── projects.py     项目 CRUD
│       └── chat.py         /api/chat
├── core/
│   ├── config.py           环境变量 + 启动期校验
│   ├── logging.py          日志配置
│   └── security.py         密码哈希 / JWT / 密码策略
├── services/
│   ├── ai_service.py       知识库注入 + 流式对话
│   └── project_service.py  归属校验（403 逻辑收敛到一处）
└── auth.py                 兼容层（re-export，避免旧导入断裂）
```

关键收益：`if project.user_id != current_user.id: 403` 原本在三处重复，现在只有 `get_owned_project()` 一处实现，且越权日志格式统一。

验证：43 个测试全绿；`openapi()` 确认 10 个路由全部注册；端到端回归（注册/登录/建项目/更新/鉴权/弱密码）行为与分层前完全一致。

## 2. i18n 补全

| 指标 | 之前 | 之后 |
|---|---|---|
| 文案键 | 79 | **171** |
| 中英对齐 | 对齐 | 对齐（脚本校验 0 差异） |
| `t()` 字面量覆盖 | 53 | **122**，0 缺失 |
| 硬编码中文 | AI 助手 533 字符 + 登录 239 + 画布 99 | 0 处用户可见文案 |

设计决策：导入模块的错误与警告改为**错误码**（`ImportErrorCode` / `ImportWarning`），由 UI 层翻译。纯函数不依赖 i18n 运行时，测试断言码而非文案，改文案不会破坏测试。

## 3. lint 归零

**31 problems（29 errors, 2 warnings）→ 0。**

逐类处理，未用 `eslint-disable`：

| 类别 | 数量 | 处理方式 |
|---|---|---|
| `no-explicit-any` | 20 | 导出 `RFStateShape` 类型化 selector；`TopologyAction` 描述 LLM 返回结构；`LoginValues`；`unknown` + 类型收窄替代 `any` |
| `react-hooks/purity` | 3 | `Math.random()` 改模块级轮转偏移；`Date.now()` 移出渲染作用域 |
| `react-hooks/set-state-in-effect` | 1 | GuideSystem 改为 `store.subscribe` 订阅，不再依赖 count state |
| `react-hooks/refs` | 1 | ref 写入从渲染期移到 effect |
| `exhaustive-deps` | 2 | 补全依赖 |
| `no-unused-vars` / `ban-ts-comment` / `prefer-const` | 6 | 清理未用变量、移除多余 `@ts-ignore` |

CI 已加 `npm run lint` 门禁，回归即报错。

## 4. 一处 AI 健壮性修复

模型返回的节点可能缺 `position` 或 `data`，原代码直接 `push` 进画布会让 React Flow 报错。现在统一补默认值（位置 0,0、类型 pc、空服务），边也补 `id`/`type`/`data`。

## 最终验证

```
backend:  43 passed
frontend: 30 passed
lint:     0 problems
tsc -b:   通过
build:    成功
i18n:     171 keys × 2 语言，0 不对称；122 处 t() 调用 0 缺失
端到端:   health / register / login / me / create / update / chat 鉴权 / 弱密码 → 全部符合预期
浏览器:   英文界面 10 个工具栏按钮全部正确翻译（含 Import JSON / Check）
```

## 方案完成度

| 阶段 | 状态 |
|---|---|
| 1 止血（8 项） | 全部完成 |
| 2 还债（5 项） | 全部完成 |
| 3 质量（5 项） | 全部完成 |
| 4 产品（4 项中的 2 项） | JSON 导入 ✅、拓扑检测 ✅；知识库结构化、模板扩充未做 |

仍未做：知识库结构化为产品资产、模板库扩充、Docker 实际构建验证（daemon 不可用）。


---

# 执行记录（第四批，2026-11-13）—— A 档：知识库结构化 + 模板扩充

按讨论确定的 A 档范围实施，不做配置片段生成与依赖清单提示。

## 1. 知识库结构化

新增 `frontend/src/data/knowledge.ts`（约 180 行），从 5 篇 Markdown 中抽取：

| 数据集 | 条数 | 内容 |
|---|---|---|
| `SERVICE_CATALOG` | 5 | dnsmasq(53/5353)、AdGuard Home(53/3000/80/443/853)、OpenClash(53)、DoT(853) |
| `PORT_CONFLICT_RULES` | 3 | AGH×dnsmasq、AGH×OpenClash、OpenClash×dnsmasq，均争用 53 |
| `IP_PLAN` | 5 | 核心 .1–.10 / 设施 .11–.20 / 服务器 .21–.50 / DHCP .100–.200 / IoT .201–.250 |
| `DEVICE_IP_ZONE` | 13 | 设备类型 → 推荐地址段 |

每条数据带 `source: {file, quote}`，引文为文档原文片段。

## 2. 防漂移机制（关键）

`data/__tests__/knowledge.test.ts`（19 个用例）重新读取 Markdown，断言每条引文仍存在于对应文档。

**已实测验证有效性**：把 `option port '5353'` 篡改为 `'9999'` 后，只有该条用例失败并精确指出是哪条事实、哪个文件；还原后重新通过。这直接对应项目历史上 `审查报告.md` 描述不存在的代码那一类问题。

另有自洽性断言：服务 id 唯一、冲突规则引用的服务存在、冲突端口确实被双方声明、IP 段不重叠且落在 1–254。

## 3. 检测引擎扩展

`utils/validation.ts` 新增 2 类检查：

- `port-conflict`：同一节点上两个服务争用同一端口，按知识库规则判定
- `ip-zone-mismatch`：IP 落在所有规划段之外

**测试驱动的规则修正**：初版按服务名匹配，导致 `dnsmasq (5353)` 被误判为占用 53。改为**按服务实际声明的端口**判定，并保留名称归一化（大小写、下划线、括号）。这条 bug 由 `dns_stack` 模板测试发现。

## 4. 模板扩充 2 → 4

| 模板 | 设计要点 |
|---|---|
| `basic_home` | 重写：光猫桥接（无 IP）、单一 NAT、PC 与路由同网段 |
| `bypass_router` | 新增：旁路由关 DHCP，客户端网关/DNS 指向旁路由 |
| `dns_stack` | 新增：AGH 占 53、dnsmasq 退 5353，演示端口分工 |
| `advanced_homelab` | 修正：原 10G 链路配 2.5G 软路由导致告警，降为 2.5G；IP 迁入 .21–.32 服务器段 |

**修正的既有缺陷**：原 `basic_home` 给光猫配 `192.168.1.1`、路由配 `192.168.2.1`，构成双层 NAT，与知识库第一条原则「光猫桥接、单一 NAT」直接矛盾。

质量约束：`templates.test.ts`（25 个用例）要求每个模板 **零问题**（error/warning/info 全为 0），另有单一 NAT、DNS 端口分工、旁路由网关指向等针对性断言。

## 5. 顺带修复

- 模板确认框按钮原为硬编码英文 `Load` / `Cancel`，中文界面下显示英文；已接入 i18n。
- 模板卡片增加说明行（Lightbulb + note），解释设计意图。

## 最终验证

```
frontend: 80 passed（30 → 80）
  ├ validation 22
  ├ importTopology 14
  ├ knowledge 19（溯源防漂移）
  └ templates 25（零问题约束）
backend:  43 passed
lint:     0 problems
tsc -b:   通过
build:    成功
i18n:     182 keys × 2 语言，0 不对称，123 处 t() 调用 0 缺失
模板自检: 4/4 全部 error=0 warning=0 info=0
```

## 未做（按 A 档约定）

- 配置片段生成（`/etc/config/dhcp` 等）
- opkg 依赖清单提示
- 知识库向量化/真 RAG

## 边界说明

知识库仅 5 篇、约 12k 字符，可提取事实约 50 条，属 demo 级数据密度。结构化质量的上限由「是否有人持续维护文档」决定，代码只能保证「一旦文档变了，数据不会静默撒谎」。


---

# 执行记录（第五批，2026-11-13）—— 知识库分层

## 问题量化

改造前实测：

| 指标 | 数值 |
|---|---|
| 知识库字符数 | 12,446 |
| system prompt 总字符 | 15,819 |
| **知识库占比** | **78.7%** |
| 估算 tokens | ~5,400 / 每次请求 |

用户每发一句「你好」都要付这份钱。诊断结论不是「知识库该删」，而是「不该无差别全量注入」。

## 改造内容

### 1. 拆出常驻层

新增 `RAG/KnowledgeBase/00_Core_Constraints.md`（1,236 字符），只保留最易答错且代价最高的事实：

- 三条设计原则（光猫桥接 / 单一 NAT / 有线回程）
- DNS 栈端口约定（53 只能一个组件持有）
- IP 规划五段
- Wi-Fi 信道（1/6/11、避开 DFS）
- 四条常见误配

### 2. 剔除安装步骤

| 文件 | 移除内容 | 字符 |
|---|---|---|
| `03_OpenClash_Config.md` | opkg 依赖清单、内核下载 | 692 |
| `04_AdGuardHome.md` | curl 安装脚本、Docker run | 664 |

理由：模型本身具备这类通用知识，且版本敏感（19.07/21.02 包名有差异），留在 prompt 里是纯成本。

### 3. 新增跨组件摘要

从 `02_OpenWRT_Basic.md` 抽出 DHCP/DNS 配合章节，独立为 `06_DNS_Interop.md`（557 字符）。同时提到 AdGuard 与 OpenClash 时注入此摘要，而非整篇 3,016 字符的 OpenWRT 文档。

### 4. 压缩 base prompt

`BASE_PROMPT` 从 3,438 → **1,072 字符**（-69%）。原文有三处冗余：角色描述重复两遍、pitfalls 与核心层重复、指令之间重复。

### 5. 按需加载实现

`backend/app/services/knowledge_base.py`：

- `detect_topics()`：扫描最近 6 条 user 消息，关键词命中选主题
- `build_knowledge_section()`：常驻层 + 命中的专题
- `is_dns_cross_topic()`：AdGuard + OpenClash 同时命中时追加摘要

## 实测效果

| 场景 | 改造前 | 改造后 | 相对 |
|---|---|---|---|
| 打招呼 | 13,709 | 2,362 | **21%** |
| 拓扑审查 | 13,709 | 2,362 | **21%** |
| 53 端口冲突 | 13,709 | 4,399 | **40%** |
| 稳定性 | 13,709 | 4,080 | **37%** |
| OpenClash | 13,709 | 5,036 | **48%** |
| 跨组件 DNS | 13,709 | 7,708 | **73%** |

平均降至 **41%**，最坏 73%——**没有任何场景劣于旧行为**。

## 过程中的两次修正

**① 关键词归属错误（第一版）**
`dnsmasq`、`53 端口` 被归进 openwrt 主题，导致一个 DNS 问题拉进整篇 3k 字符的接口/防火墙章节。改为归入 adguard 主题后，该场景从 7,497 降到 4,399 字符。

**② 跨组件场景几乎没省（第一版）**
初版跨组件直接拉三篇文档（95%），比全量注入没省多少。抽出 `06_DNS_Interop.md` 后降到 73%。

两处都是先测出数字、再回头修设计，不是凭感觉写。

## 测试

`backend/tests/test_knowledge_base.py` — **38 个用例**：

| 分组 | 内容 |
|---|---|
| TestDetection | 主题识别、跨组件识别、只扫最近消息 |
| TestLoading | 常驻层存在且 <3000 字符、专题齐全、未知主题忽略 |
| TestPromptSize | 打招呼不携带专题、专题 prompt 含对应文档 |
| TestInstallerStepsRemoved | 安装步骤确已移除，正文仍有实质内容 |
| TestCrossTopicEconomy | 跨组件用摘要而非整篇 |
| TestPromptBudget | 体积硬上限、BASE_PROMPT < 1500 字符 |
| TestMeasuredSavings | **六个场景逐一对比旧行为，平均节省 ≥40%** |

## 最终验证

```
backend:  81 passed（43 → 81）
frontend: 80 passed
lint:     0 problems
tsc -b:   通过
端到端:   /health 正常；chat 鉴权正常；缺 Key 返回可读错误
知识库:   7 文件 12,394 字符（新增 00/06，精简 03/04）
前端溯源测试: 19 passed（引用的 4 个文档仍然存在且引文未变）
```

## 保留的边界

- 跨组件问题仍需 7.7k 字符（73%），因为两个组件的 DNS 章节都得给。这是正确答案的必要成本。
- 关键词表是手工维护的，新增文档需同步更新 `TOPIC_KEYWORDS`。
- 前端 `data/knowledge.ts` 的结构化数据与后端知识库分层是两套机制：前者供检测引擎用（需精确事实），后者供 LLM 用（需上下文）。两者都绑定到同一批 Markdown，靠各自的测试防漂移。
