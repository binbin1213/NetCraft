# NetCraft 项目状态

**最后核对日期**：2026-11-13
**核对方式**：逐项对照源码，并实际执行构建 / 测试 / 端到端验证

> 本文只记录**能在代码里找到、能跑出结果**的内容。不写计划、不写意图。
> 如需记录规划，请放在 `docs/proposals/`。

---

## 已完成（有代码 + 有验证）

### 画布与拓扑

- **13 类设备**：`modem` / `router` / `switch` / `ap` / `pc` / `server` / `firewall` / `pve` / `esxi` / `unraid` / `vm_windows` / `vm_linux` / `vm_openwrt`。定义见 `frontend/src/types/nodes.ts`。
- **放置方式**：从侧栏拖拽，或双击设备卡片。拖拽使用 `dataTransfer` + `screenToFlowPosition`。
- **连线**：5 种介质（`fiber` / `eth_1g` / `eth_2.5g` / `eth_10g` / `wifi`），各有配色与动效。重复连线（含 A→B 与 B→A）会被去重。
- **属性面板**：双向绑定名称、IP、品牌、型号、OS、CPU、内存、硬盘、服务与端口。
- **自动布局**：基于 dagre，每次调用新建图实例，并按下游节点的 X 坐标分配 LAN 端口以减少交叉。
- **导出 / 导入**：PNG（`html-to-image`，2x 像素比）+ JSON。导入支持导出文件与云端项目格式，会校验结构、去重连线、跳过悬空边，并对未知设备类型/介质降级并提示。
- **拓扑检测**：自动分析环路、IP 冲突、无效 IP、链路超规格、带宽瓶颈、端口不足、孤立设备、缺少出口设备、**服务端口冲突（知识库规则）**、IP 不在推荐地址段；面板可点击定位到对应节点。
- **撤销/重做**：zundo，历史上限 50 步，`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`。
- **快捷键**：`Ctrl+C` / `Ctrl+V` 复制粘贴节点（粘贴时重新分配 IP）。

### 架构向导

- 添加特定设备后主动推荐下一步，并可一键创建 + 自动连线。
- 规则表见 `frontend/src/components/Guide/GuideSystem.tsx`（`RECOMMENDATIONS`、`AUTO_CONNECT_RULES`）。

### 模板

- 4 个预设，见 `frontend/src/data/templates.ts`：
  - `basic_home`：光猫桥接 + 主路由 + AP + 电脑（单一 NAT）
  - `bypass_router`：主路由 + 旁路由（关闭 DHCP，客户端网关/DNS 指向旁路由）
  - `dns_stack`：AdGuard Home 占 53、dnsmasq 退到 5353
  - `advanced_homelab`：软路由 + 2.5G 交换机 + PVE + NAS + 虚拟机
- 每个模板都必须通过 `analyzeTopology()` 且**零问题**（error/warning/info 均为 0），由 `data/__tests__/templates.test.ts` 保证。

### 账号与云端存储

- 注册 / 登录（Argon2 密码哈希 + JWT）。
- 密码复杂度校验：≥8 位、含大小写/数字/特殊字符，≤128 位。见 `backend/app/auth.py::validate_password`。
- 项目 CRUD：`POST/GET/PUT/DELETE /projects/`，按 `user_id` 隔离，越权返回 403。
- **自动保存**：登录且已打开云端项目时，停止编辑 3 秒后自动同步到后端（`frontend/src/components/AutoSave.tsx`）。
- 项目管理弹窗：新建 / 打开 / 删除，数据源为后端 API（`frontend/src/components/ProjectManager.tsx`）。

### AI 助手

- 流式对话，支持 DashScope 与 OpenAI 兼容接口。
- **知识库按需注入**：常驻层只含核心约束（约 1.2k 字符），专题文档仅在对话命中关键词时加载。实测平均 prompt 体积降至原来的 **41%**（见下表）。
- 可执行 `update_topology` 与 `auto_layout` 两种画布动作。

### 国际化

- 中 / 英双语，171 个文案键两侧完全对齐，跟随浏览器语言。
- 覆盖范围：侧栏、属性面板、画布工具栏、向导、模板、设置、AI 助手、登录、项目管理、导入导出、拓扑检测。
- 文案全部来自 `src/i18n/locales/*.ts`；代码中的 `t('...')` 字面量经脚本校验无缺失。

---

## 已知限制

| 限制 | 说明 |
|---|---|
| 前端测试覆盖有限 | 仅覆盖拓扑检测与 JSON 导入两个纯函数模块（30 个用例），无组件/e2e 测试 |
| 检测规则为启发式 | 速率上限按设备类别估算，非真实端口规格 |
| AI 对话需登录 | `/api/chat` 已加鉴权，未登录会提示先登录 |
| 画布非响应式 | 侧栏固定宽度，窄屏（<900px）下画布会被压缩，无折叠逻辑 |
| 前端测试 | `npm run test`，30 个用例（拓扑检测 + JSON 导入） |
| 前端 lint | `npm run lint`，0 error / 0 warning |
| 后端测试 | `pytest -q`，43 个用例（认证 / 项目 / 密码策略 / 配置） |
| 依赖版本已锁定 | `backend/requirements.txt` 与 `frontend/package-lock.json` |

---

## 验证方法

### 后端测试

```bash
cd backend
pip install -r requirements-dev.txt
export SECRET_KEY=test-secret
pytest -q        # 43 passed
```

### 前端测试与构建

```bash
cd frontend
npm ci
npm run test     # vitest run -> 30 passed
npm run build    # tsc -b && vite build
```

### 本地启动

```bash
# 后端（需要 SECRET_KEY，否则启动即失败）
export SECRET_KEY=$(openssl rand -hex 32)
export DATABASE_URL="sqlite:///./netcraft.db"
uvicorn app.main:app --reload --app-dir backend

# 前端
cd frontend && npm run dev
```

### Docker

```bash
cp .env.example .env      # 填入 SECRET_KEY 等
docker compose up --build
```

后端镜像的构建上下文是**仓库根目录**（Dockerfile 需要同时复制 `backend/` 与 `RAG/`），
这一点与 CI 保持一致。

---

## 知识库分层

`RAG/KnowledgeBase/` 共 7 个文件，分两层使用：

| 文件 | 字符 | 加载时机 |
|---|---|---|
| `00_Core_Constraints.md` | 1,236 | **每次都加载**（设计原则、53 端口约定、IP 规划、Wi-Fi 信道、常见误配） |
| `01_Network_Architecture.md` | 1,422 | 提到拓扑 / 旁路由 / VLAN / 网段 |
| `02_OpenWRT_Basic.md` | 3,016 | 提到接口配置 / 防火墙 / 端口转发 |
| `03_OpenClash_Config.md` | 2,586 | 提到 OpenClash / 代理 / 分流 / Fake-IP |
| `04_AdGuardHome.md` | 1,959 | 提到 AdGuard / 去广告 / DoH / dnsmasq |
| `05_Stability_Optimization.md` | 1,618 | 提到断网 / 卡顿 / 信道 / BBR |
| `06_DNS_Interop.md` | 557 | 同时提到 AdGuard 与 OpenClash 时追加 |

**实测 prompt 体积**（含固定 base prompt 1,072 字符）：

| 场景 | 字符 | 相对旧行为 |
|---|---|---|
| 打招呼 | 2,362 | 21% |
| 拓扑审查 | 2,362 | 21% |
| 53 端口冲突 | 4,399 | 40% |
| 稳定性问题 | 4,080 | 37% |
| OpenClash 问题 | 5,036 | 48% |
| 跨组件 DNS | 7,708 | 73% |
| **旧行为（全量注入）** | **13,709** | 100% |

平均降至 41%，最坏情况 73%——**任何场景都不再劣于旧行为**。

设计要点：`dnsmasq`、`53 端口` 等词归到 DNS 主题而非 OpenWRT 主题，避免一个 DNS 问题拉进 3k 字符的接口/防火墙章节；跨组件问题用 557 字符的 `06` 摘要，而非整篇 `02`。

## 知识库结构化

`frontend/src/data/knowledge.ts` 把 `RAG/KnowledgeBase/` 中可执行的事实抽成结构化数据：

| 数据 | 条数 | 用途 |
|---|---|---|
| 服务端口注册表 | 5 | 端口冲突检测 |
| 端口冲突规则 | 3 | dnsmasq / AdGuard Home / OpenClash 争用 53 |
| IP 规划段 | 5 | 判断设备 IP 是否落在推荐区间 |
| 设备类型 → 地址段映射 | 13 | IP 规划校验 |

**防漂移机制**：每条数据都记录 `{file, quote}`，`data/__tests__/knowledge.test.ts`
会重新读取 Markdown 并断言引文仍然存在。文档改动导致引文消失时测试立即失败，
避免出现「结构化数据与文档静默不一致」。

## 可观测性

- 统一日志入口：`backend/app/core/logging.py`，输出到 stdout，格式
  `时间 级别 [模块] 消息`。
- 记录内容：启动时的 CORS 配置、注册、登录成功/失败、JWT 校验失败、项目增删改、越权访问。
- `LOG_LEVEL` 环境变量控制级别；`echo=True` 已移除，SQL 语句仅在 DEBUG 时输出，避免密码哈希进入日志。
- 健康检查：`GET /health` 返回 `{"status":"ok"}`，可用于容器探针。

## 目录结构

```
backend/
├── app/
│   ├── api/
│   │   ├── deps.py        # get_current_user 等依赖
│   │   └── routes/
│   │       ├── auth.py    # /register /token /users/me
│   │       ├── projects.py# 项目 CRUD
│   │       └── chat.py    # /api/chat
│   ├── core/
│   │   ├── config.py      # 环境变量集中读取与启动期校验
│   │   ├── logging.py     # 日志配置
│   │   └── security.py    # 密码哈希、JWT、密码策略
│   ├── auth.py            # 兼容层（re-export，供旧导入使用）
│   ├── database.py        # engine 与 session
│   ├── main.py            # 仅做装配：中间件 + 路由注册 + 健康检查
│   ├── models.py          # User / Project
│   └── services/
│       ├── ai_service.py  # 知识库注入 + 流式对话
│       └── project_service.py # 归属校验与更新逻辑
├── tests/                 # pytest：auth / projects / password policy
├── requirements.txt       # 运行时依赖（已锁定）
└── requirements-dev.txt   # 测试依赖
frontend/
└── src/
    ├── api/               # fetch 封装
    ├── components/        # Canvas / Sidebar / Properties / AiAssistant / Guide ...
    ├── data/              # 模板
    ├── i18n/              # en / zh
    ├── store/             # Zustand（认证 + 画布 + 当前项目）
    ├── types/             # 设备与连线的类型定义
    └── utils/             # autoLayout / network / graph / validation / importTopology
RAG/KnowledgeBase/         # 5 篇中文网络技术文档
docs/proposals/            # 未实施的提案
```
