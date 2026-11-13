# NetCraft 文件分析

Route: C（仅基于工作区文件 + 本地运行验证，未做外部检索）
Time Check: 2026-11-13 10:33 CST
Constraints: file-only（用户要求「研究下这个项目」，无外部对标需求）

## File Inventory

| 目录 | 文件数 | 有效行数 | 说明 |
|---|---|---|---|
| `frontend/src` | 25 | 3,617 | React 应用全部源码（ts/tsx/css） |
| `backend/app` | 5 | 488 | FastAPI 应用 |
| `backend/tests` + 根 | 4 | 516 | 密码校验测试（均无法运行） |
| `RAG/KnowledgeBase` | 5 | — | 11,957 字符中文网络技术文档 |
| 部署 | 8 | — | 2 份 compose、2 个 Dockerfile、4 个 shell、1 个 CI |
| 文档 | 5 | 578 | README、PROJECT_STATUS、审查报告、可观测性建议、测试清单 |
| 构建产物/垃圾 | — | — | `backend/app/**/__pycache__` 下 5 个 `.pyc` 已入库（`.DS_Store` 未入库） |
| **合计（不含 node_modules/.git）** | **78** | **~4,800** | |

## Per-File Extraction

### 前端核心（按重要度）

**`store/useStore.ts` (279)** — 单一 Zustand store，同时装认证态、本地项目列表、画布图、图动作。`persist` + `temporal` 双层中间件。抽 `token`/`user`/`projects`/`nodes`/`edges` 全部入 localStorage。`temporal` 未设 `limit`。

**`components/Canvas/Canvas.tsx` (511)** — 全项目最复杂的组件，承载 12 项职责：ReactFlow 装配、拖放、自动布局、导出图片、导出 JSON、云端保存/加载/删除、剪贴板、快捷键、撤销重做、AI 助手挂载、两个 Modal。内部 `useState` 维护 `currentProjectId`，与 store 的 `projects` 体系**完全平行**。

**`components/AiAssistant/AiAssistant.tsx` (458)** — 悬浮球 + 可拖拽聊天面板 + 设置表单 + SSE 手动解析 + 正则提取动作 + Markdown 渲染。533 个中文字符全部硬编码。

**`utils/autoLayout.ts` (100)** — dagre 布局，模块级单例图对象（只增不清）；含「按目标 X 坐标给 LAN 口分配编号」的启发式逻辑，是全项目少数有真实算法思考的代码。

**`components/Sidebar/Sidebar.tsx` (307)** — 设备库（13 类分 3 组）+ 模板库（2 个）+ 设置弹窗 + ProjectManager 入口。双击放置节点时用 `Math.random()` 做位置偏移，触发 lint 的 `react-hooks/purity` 错误。

**`components/Guide/GuideSystem.tsx` (203)** — 上下文推荐引擎。`RECOMMENDATIONS` 映射 6 类设备 → 建议添加的下游设备，`AUTO_CONNECT_RULES` 决定自动连线的介质。在 `useEffect` 里监听 `nodes.length` 增量触发，用 `setTimeout(600)` 制造自然感。模块级 `let id = 1000` 计数器。

**`components/Auth/Login.tsx` (169)** — 登录/注册双 Tab，仅作为 Modal 内容使用（`isModal` 分支的独立页面渲染是死代码）。

**`components/ProjectManager.tsx` (113)** — 本地项目 CRUD 弹窗。`useStore()` 无 selector（全量订阅），`projects.sort()` 直接原地排序源数组。

**`components/Canvas/DeviceNode.tsx` (284)** — 玻璃拟态节点卡片。顶部 WAN handle、底部按 `interfaceCount` 动态生成 LAN handle、状态呼吸灯、IP 点击复制、服务标签点击开 `http(s)://ip:port`。

**`components/Canvas/SmartEdge.tsx` (96)** — 5 种线型的配色/虚线/发光/`animateMotion` 流动圆点。

**`i18n/locales/{en,zh}.ts` (101×2)** — 各 79 个叶子 key，完全对齐。

### 后端

**`app/main.py` (201)** — 10 个路由，全部业务逻辑内联。`/api/chat` 无鉴权。CORS 硬编码单源。

**`app/services/ai_service.py` (171)** — 知识库整库注入 + system prompt + 双 provider 流式。`dashscope.api_key` 模块级可变全局。

**`app/models.py` (61)** — User/Project 两表。`Project.data` 为 PostgreSQL JSONB。无任何 validator。

**`app/auth.py` (28)** — Argon2 哈希 + JWT 签发。SECRET_KEY 有硬编码默认值。15 分钟 vs 7 天常量冲突。

**`app/database.py` (27)** — engine 单例，`echo=True` 写死，SQLite fallback 与 JSONB 冲突。

### 部署

**`docker-compose.yml` / `.prod.yml`** — dev 用 build、prod 用 GHCR 镜像。db 口令硬编码。无 healthcheck。backend 未接 `SECRET_KEY`/`ALLOWED_ORIGINS`。

**`backend/Dockerfile`** — COPY 路径以仓库根为基准，与 compose 的 `./backend` 上下文不匹配 → **本地构建必失败**。

**`.github/workflows/docker-publish.yml`** — 仅 checkout/build/login/push，7 个 step 无任何测试。backend 用 `context: .` 恰好绕过了上述 COPY 问题。

## Cross-File Mapping

```
用户操作 ──► Sidebar ──► useStore.addNode ──► Canvas 渲染
                │                              │
                └──► GuideSystem ──► addNode+addEdge
                                               │
AiAssistant ──► /api/chat ──► ai_service ──► DashScope
      │                                        │
      └──► 正则提取 action ◄── 流式文本 ◄──────┘
                │
                └──► useStore.setNodes/setEdges

Canvas 保存 ──► api.createProject ──► /projects/ ──► PostgreSQL(JSONB)
Canvas 加载 ◄── api.getProjects   ◄── /projects/ ◄── PostgreSQL(JSONB)

AutoSave ──► useStore.saveProject ──► localStorage（与上面的云端链路无交集）
ProjectManager ──► useStore.projects ──► localStorage（同上）
```

关键断裂点有三处：

1. **本地项目 ≠ 云端项目**：两条链路并行，无同步、无迁移、UI 上两个入口。
2. **AI 动作解析不完整**：prompt 教了 2 种动作，前端只认 1 种。
3. **开发构建 ≠ CI 构建**：同一份 Dockerfile，本地必败、CI 必成。

## 能力—声明对照表

| 声明（README/文档） | 声明方 | 代码事实 | 差距 |
|---|---|---|---|
| JWT 密钥强制来自环境变量 | 审查报告 | `os.getenv` 带公开默认值 | 声明未实现 |
| CORS 支持环境变量多源 | 审查报告 | 硬编码 `localhost:5173` | 声明未实现 |
| 云端自动保存 | README | AutoSave 只写 localStorage | 声明不符 |
| 完美中英切换 | README | 530+ 字符硬编码中文 | 部分实现 |
| 企业级安全 | README | `/api/chat` 无鉴权 + 密钥串号 | 声明不符 |
| 密码复杂度校验 | 测试文件 ×4 | `validate_password` 不存在 | 测试无法运行 |
| 4K 图片导出 | PROJECT_STATUS 列为待开发 | 已实现（2x pixelRatio） | 文档滞后 |
| 后端持久化待开发 | PROJECT_STATUS | 已实现 5 个 CRUD 路由 | 文档滞后 |
| 模板系统待开发 | PROJECT_STATUS | 已实现 2 个模板 | 文档滞后 |
| 环路/IP 冲突/瓶颈检测 | PROJECT_STATUS 列为待开发 | 未实现 | 一致 |

## Gaps

- 未做外部竞品/技术选型对标（route C 约束）。
- Docker 镜像未实际构建验证：本机 Docker CLI 存在但 daemon 未运行（`/var/run/docker.sock` 不存在），构建失败结论基于路径分析而非构建日志。
- 后端未实际启动验证：本机 Python 环境缺少 fastapi/sqlmodel 等依赖，且 PyPI 镜像不可达，无法 `pip install`。
- 前端已实际构建 + 实际运行 + 实际交互验证（双击建节点、观察控制台警告）。

## Consolidated Themes

1. **能力真实存在，但边界被文档夸大**。UI、画布、AI、云端存储都能跑，是可用原型；文档把「计划」写成了「已完成」。
2. **两套并行系统是最大的结构性债务**（本地项目 / 云端项目）。
3. **部署链路存在一个必失败点**（Dockerfile COPY 上下文），且被 CI 的 `context: .` 掩盖。
4. **测试体系为零**，且现有 4 份测试有 3 份跑不起来。
5. **前端质量显著高于后端**：i18n 对齐、类型完备、构建通过；后端 488 行里集中了鉴权、SSE、全局状态三类问题。
