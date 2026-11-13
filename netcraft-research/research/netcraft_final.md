# NetCraft 项目研究报告

**研究日期**：2026-11-13
**研究对象**：`/Users/binbin/Desktop/NetCraft`（GitHub: binbin1213/NetCraft）
**研究方法**：全量源码阅读（78 个文件）+ 4 项实际执行验证（生产构建 / ESLint / 单元测试 / 浏览器交互）+ 文档与代码逐条比对
**证据边界**：后端未实际启动（本机缺少依赖且 PyPI 镜像不可达），Docker 未实际构建（daemon 未运行）

---

## 一、这是什么

NetCraft 是一个**家庭实验室网络架构设计器**。左侧设备库拖到画布、连线、右侧改属性、右下角 AI 助手问答，登录后可把拓扑存到云端。

技术栈：React 18 + TypeScript + Vite + React Flow 11 + Zustand（前端）／FastAPI + SQLModel + PostgreSQL（后端）／Docker Compose + GitHub Actions（部署）。

规模：前端 25 个源文件 3,617 行，后端 5 个文件 488 行，知识库 5 篇约 12,000 字符。整体是一个约 4,800 行的独立项目，13 次提交，单人开发特征明显。

**一句话判断**：前端是真实可用的产品级代码，后端是还没长成型的原型，文档跑在代码前面。

---

## 二、实际能用的功能（已实测）

我在浏览器中实际启动了前端并做了交互验证：

- **画布**：13 类设备（光猫/路由/交换机/AP/PC/防火墙/服务器 + PVE/ESXi/Unraid + 三种 VM），拖拽或双击放置，节点卡片为玻璃拟态 + 状态呼吸灯，点击 IP 可复制。
- **连线**：5 种介质（1G / 2.5G / 10G / 光纤 / Wi-Fi），不同配色、线宽、虚线，光纤模式带流动光点动画。
- **自动布局**：基于 dagre，还带一个「按目标节点 X 坐标分配 LAN 端口号以减少交叉」的启发式——这是全项目少数有真实算法思考的地方。
- **导出**：PNG（`html-to-image`，2x 像素比）+ JSON。**注意：只能导出，不能导入。**
- **架构向导**：添加光猫后自动弹「要不要加路由器」，点确认后自动创建节点**并自动连线**，介质由规则表决定。这个交互做得很顺。
- **AI 助手**：可拖拽悬浮球 + 聊天面板，流式输出，支持 6 家 provider。
- **撤销重做**：zundo 中间件，Ctrl+Z / Ctrl+Y 可用。
- **中英切换**：设置面板切换，i18n key 两侧完全对齐（79 个叶子 key，零缺失）。

生产构建实测通过，产物 1,387.81 kB（gzip 440.54 kB）。

---

## 三、必须知道的问题

### 3.1 安全问题（按真实风险排序）

| 问题 | 位置 | 后果 |
|---|---|---|
| `/api/chat` **无任何鉴权** | `main.py:79` | 未登录即可盗刷服务器 API 额度；请求体可指定任意 `base_url`，构成 SSRF 代理 |
| `SECRET_KEY` **有硬编码默认值** | `auth.py:8` | 环境变量缺失时静默使用仓库公开的密钥，可伪造任意用户 token |
| `dashscope.api_key` **是模块级全局变量** | `ai_service.py:11,126` | A 用户带自己的 key 请求后，B 用户的请求会用 A 的 key——多用户下凭据串号 |
| 数据库口令硬编码 | 两份 compose | `netcraft:netcraft_secret` |

**而 `审查报告.md` 声称这三项中前两项「已修复」并「✅ 全部通过审查」**——报告里贴的 `if not SECRET_KEY: raise ValueError` 代码在仓库中不存在。

### 3.2 部署：本地构建必失败

`docker-compose.yml` 里 backend 用 `build: ./backend`（上下文 = `backend/` 目录），但 `backend/Dockerfile` 三条 COPY 全写成 `./backend/xxx` 前缀。构建上下文里没有 `backend/backend/`，COPY 全部失败。

**但 CI 能过**——workflow 用的是 `context: .` + `file: ./backend/Dockerfile`，恰好匹配。

结果是：CI 绿灯、`docker-compose up --build` 报错。README 的「方式二：自行构建镜像」和 `scripts/deploy.sh` 都指向这条失败路径。

### 3.3 测试：4 份文件，3 份跑不起来

| 文件 | 状态 |
|---|---|
| `test_password_validation_simple.py` | 能跑（实测 50/50 通过），但**自带校验函数副本**，测的是自己 |
| 其余 3 份 | 全部 `from app.auth import validate_password` — **该函数不存在**（`auth.py` 只有 3 个函数） |

最新提交信息是 `feat: add password validation tests`，实际效果是**加了 4 份测试、0 份能验证功能**。注册接口目前接受 `"1"` 作为密码。

### 3.4 两套互不相通的项目系统

- **本地项目**：`useStore.projects`（uuid 主键）+ `ProjectManager` 弹窗 + `AutoSave` 定时器 → 只写 localStorage。
- **云端项目**：`Canvas.tsx` 内的 `currentProjectId`（数字主键）+ Ant Design Modal → 调 `/projects/` API。

两者无共享状态。`AutoSave` 文件里**没有 import `api`**，永远不会上云。

**README 第 28 行却写着「项目自动保存到云端数据库 (PostgreSQL)，随时随地访问」。**

### 3.5 三个低调但真实的前端缺陷

1. **画布缩放控件几乎不可见**：`Controls` 传了 `fill-slate-300`，但 React Flow 按钮自带 `background: #fefefe`。实测背景 `rgb(254,254,254)`、图标 `rgb(203,213,225)`，对比度约 1.5:1——深色界面上四个按钮基本看不清。
2. **`dagreGraph` 是模块级单例**：`const dagreGraph = new dagre.graphlib.Graph()` 定义在模块顶层，只增不清。反复点自动布局会累积历史节点。
3. **窄屏画布塌成 0 宽**：498px 视口下实测 `.react-flow` 宽度为 0，控制台 3 条 React Flow 警告。侧栏固定 `w-64`+`w-72` 无折叠逻辑。

### 3.6 AI 动作协议半实现

后端 system prompt 教模型输出两种动作（`update_topology` / `auto_layout`），前端只处理 `update_topology`。模型返回 `auto_layout` 时，用户看到「我帮你重新布局了」，画布纹丝不动。

另外 AI 加边时直接 `[...currentEdges, ...actionData.edges]` 拼接，不去重；而手动连线路径 `onConnect` 是做了双向去重的——两条路径规则不一致。

### 3.7 "RAG" 其实是整库注入

`load_knowledge_base()` 用 glob 读全部 `.md` 拼成字符串，模块导入时执行一次，整段塞进 system prompt。没有切片、没有检索、没有向量库。当前 5 篇 / 12k 字符的规模下这是合理折中，但涨到 50 篇必然爆上下文。

---

## 四、文档可信度评级

仓库有 5 份 Markdown 描述工程状态。逐条核对后：

| 文档 | 可信度 | 关键偏离 |
|---|---|---|
| `README.md` | ⚠️ 中 | 「云端自动保存」「完美中英切换」「企业级安全」均不符；引用不存在的 `backend/README.md` |
| `PROJECT_STATUS.md` | ⚠️ 中 | 把已实现的图片导出/后端持久化/模板系统列为「待开发」；持久化写成 SQLite（实际 PostgreSQL） |
| `审查报告.md` | ❌ 低 | 描述的三项安全修复**均未落地**，贴出的代码在仓库中不存在 |
| `可观测性增强建议.md` | ⚠️ 中 | 是好建议，但一条未实施；全后端 `logger` 出现次数为 0 |
| `测试清单.md` | ❌ 低 | 引用 `/api/users/`、`/api/token/` 等不存在的路由，curl 示例跑不通 |

**共同模式**：文档写的是「目标状态」，开发完没回填。危害是误导下一个读者——包括下一个 AI 助手。

---

## 五、真正值得肯定的三点

1. **定位清晰不漂移**。13 类设备、5 种介质、向导规则、知识库 5 个主题，全部指向「家庭实验室网络设计」这一个具体场景，没有滑向通用画图工具。这个清晰度比代码质量更难得。

2. **前端 i18n 基础设施质量高**。en/zh 各 79 个叶子 key 完全对齐，代码中 53 个 `t()` 字面量全部命中，用 `LanguageDetector` 自动跟随浏览器。问题只是覆盖不全（AI 助手 533 个中文字符、登录 239 个硬编码），不是实现错误。

3. **知识库是真资产**。`RAG/KnowledgeBase/` 具体到「AdGuard Home 占 53 端口、Dnsmasq 退到 5353」这种可执行细节。画布 UI 谁都能写，把 OpenClash 与 AdGuard 的端口冲突讲清楚需要真实踩坑经验——这是最难被复制的部分，目前却只当 prompt 附件用。

---

## 六、如果要继续做

**P0 — 不修就不能给别人用**
1. `/api/chat` 加 `Depends(get_current_user)`；`dashscope.api_key` 改为按请求传参（去掉全局改写）。
2. `SECRET_KEY` 去掉默认值，缺失即启动失败；两份 compose 补传 `SECRET_KEY` 与 `ALLOWED_ORIGINS`。
3. 修 `backend/Dockerfile` 的 COPY 路径（或把 compose 的 context 改成 `.`），让本地构建与 CI 一致。

**P1 — 结构性债务**
4. 合并两套项目系统：明确「未登录=本地 / 登录=云端」并做同步，或直接废掉本地那套。
5. 前端补 `auto_layout` 分支；AI 加边复用 `onConnect` 的去重逻辑。
6. 决定 `validate_password` 的命运：要么实现它让 4 份测试有意义，要么删掉测试。当前状态最差。
7. 修 JWT 有效期矛盾（常量说 7 天、实际签发 15 分钟，`ACCESS_TOKEN_EXPIRE_MINUTES` 是死代码）。

**P2 — 质量**
8. 后端拆层（`api/` + `services/` + `repositories/`），`main.py` 只留路由注册。488 行值得重写而非逐行修。
9. 引入 Alembic；`echo=True` 改由环境变量控制（现在生产每个 SQL 都打日志含参数）。
10. i18n 补齐 AiAssistant / Login / Canvas 硬编码文案。
11. 修 `Controls` 配色；`temporal` 加 `limit`；`dagreGraph` 改为函数内创建。

**P3 — 产品**
12. 把知识库结构化（设备/服务/端口/依赖），让 AI 生成的拓扑可追溯到具体文档条目——AI 从「聊天窗口」变成「知识驱动的配置生成器」。
13. 补 JSON 导入（现在只能导出，是单向的）。
14. 实现环路 / IP 冲突 / 瓶颈检测——这是 `PROJECT_STATUS.md` 里唯一「说没做也确实没做」的功能，也是这个产品区别于普通画图工具的核心。

---

## 七、方法与证据限制

**已验证（可复现）**
- `npm run build` → 通过，1,387.81 kB / gzip 440.54 kB
- `npm run lint` → 31 problems（29 errors, 2 warnings），其中 20 个 `no-explicit-any`
- `python3 test_password_validation_simple.py` → 50 passed / 0 failed
- 浏览器实测：页面渲染、双击建节点、控制台警告、控件计算样式、窄屏宽度塌陷

**未验证（结论基于代码阅读，置信度中）**
- 后端启动与运行时行为：本机 Python 缺 fastapi / sqlmodel / passlib 等依赖，且 PyPI 镜像返回 "no versions"，无法安装
- Docker 构建失败：本机 Docker CLI 24.4.0 存在但 daemon 未运行（`/var/run/docker.sock` 缺失），无构建日志
- `ProjectUpdate.updated_at` 是否真正刷新：涉及 Pydantic v2 对 `default_factory` 与 `exclude_unset` 的处理差异，未做实验
- AI 动作正则的实际匹配率：未接入真实 LLM 测试

**未考察**
- 未做外部同类产品对比（draw.io / NetBox / Lucidchart），因此不对竞争力下判断
- 未审计依赖漏洞（未跑 `npm audit` / `pip-audit`）
- 未做性能压测（大数据量画布）
- 未检查其他分支或已删除文件

---

## 附：研究产物索引

本报告的支撑材料位于 `netcraft-research/research/`：

| 文件 | 内容 |
|---|---|
| `netcraft_file_analysis.md` | 78 个文件逐项清点、跨文件依赖映射、能力-声明对照表 |
| `netcraft_dim01.md` | 产品定位与功能面（含两套项目系统分析） |
| `netcraft_dim02.md` | 前端架构与状态管理（构建/lint/渲染实测） |
| `netcraft_dim03.md` | 后端架构与安全（认证、授权、SSE、数据层） |
| `netcraft_dim04.md` | 构建、部署与 CI（Dockerfile 上下文断裂） |
| `netcraft_dim05.md` | 工程实践、测试与文档可信度 |
| `netcraft_dim06.md` | AI 能力链路（RAG 实现与动作协议） |
| `netcraft_cross_verification.md` | 置信度分级、5 处文档-代码冲突裁决、未验证边界 |
| `netcraft_insight.md` | 6 条跨维度洞察与优先级建议 |
| `netcraft_evidence.json` | 15 条实体绑定证据（12 条已核证、3 条标注未核证原因） |
| `qa/netcraft_research_check.json` | 校验报告：`delivery_mode: full`，6/6 维度覆盖 |
