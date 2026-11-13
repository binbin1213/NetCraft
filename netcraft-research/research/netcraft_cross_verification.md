# NetCraft 交叉验证

Route: C（文件-only）
Evidence Budget: 78 个文件全量清点、5 个后端模块 + 25 个前端源文件逐行阅读、4 次实际执行（构建 / lint / 单测 / 浏览器交互）、0 次外部检索

## 高置信度（可直接作为结论）

这些结论都有「读代码 + 实际运行」双重证据，或者来自可机械核对的客观事实：

**1. 前端生产构建成功，产物 1,387.81 kB（gzip 440.54 kB），触发体积告警。** 实测 `npm run build`，输出可复现。

**2. 密码校验函数不存在，3/4 的测试文件无法运行。** `grep -c "def validate_password" backend/app/auth.py` 返回 0；`auth.py` AST 解析出的函数只有 `verify_password`、`get_password_hash`、`create_access_token`。仅 `test_password_validation_simple.py` 能跑（自带副本，50/50 通过），但它测的是副本。

**3. Docker 本地构建路径不匹配。** `docker-compose.yml` 用 `build: ./backend`，`backend/Dockerfile` 三条 COPY 全部带 `./backend/` 前缀。这两份文件的字面内容即可判定，不依赖推理。CI 用 `context: .` 恰好匹配——两个构建入口的上下文不一致本身是可观测事实。

**4. JWT 有效期常量与实际签发不一致。** `ACCESS_TOKEN_EXPIRE_MINUTES = 60*24*7`（第 10 行），`create_access_token` 无 `expires_delta` 时用 `timedelta(minutes=15)`（第 25 行），`login` 调用未传 `expires_delta`（`main.py` 第 115 行）。三处联合可确定。

**5. `/api/chat` 无鉴权依赖。** 该函数签名只有 `request: ChatRequest`，无 `Depends(get_current_user)`，与同文件其余 5 个项目路由形成鲜明对比。

**6. 本地项目与云端项目是两套互不相通的系统。** `Canvas.tsx` 用组件内 `useState` 存 `currentProjectId`（数字），`useStore` 用 uuid 存 `projects`，`AutoSave` 只调 `saveProject`（写 localStorage），从不调 `api.*`。三条事实交叉确认。

**7. 前端 i18n 两侧 key 完全对齐。** 用 Node 求值两个 locale 文件，en/zh 各 79 个叶子 key，差集为空；代码中 53 个 `t('...')` 字面量全部命中。

**8. 画布缩放控件对比度失效。** 浏览器实测：按钮 `background-color: rgb(254,254,254)`，内部 `svg` 的 `fill: rgb(203,213,225)`。这是运行时计算样式，非推测。

## 中置信度

**1. 「RAG」是整库注入而非检索。** 代码事实明确（glob 全量读 + 拼进 system prompt），但「这是否算 RAG」取决于定义。我按工程惯例称之为「伪 RAG / 上下文注入」，若按广义 RAG（检索增强生成）理解，它确实做了「用外部知识增强生成」，只是没有检索环节。

**2. 生产环境必然使用公开默认 JWT 密钥。** 推理链：compose 的 backend `environment` 只传 `DATABASE_URL` 和 `DASHSCOPE_API_KEY` → 容器内无 `SECRET_KEY` → `os.getenv` 回落到硬编码字符串。链条每一环都有文件证据，但**未实际部署验证**，故定为中置信度。

**3. dagre 单例会污染后续布局。** 模块级 `const dagreGraph` 是事实；`setNode` 覆盖同 id 是 dagre 的行为（未在本仓库内验证）。残留节点是否真的影响输出，取决于 dagre 是否对未连边的孤立节点参与 rank 计算。我保留「隐患」而非「已确认 bug」的措辞。

**4. 窄屏画布塌陷为 0 宽。** 498×870 视口实测 `.react-flow` 宽度为 0，且控制台有 3 条 React Flow 警告。但这是深色桌面应用，移动端本就不在目标场景内，因此定为「非目标场景的缺陷」而非「必修 bug」。

## 低置信度 / 未验证

**1. Docker 构建是否真的失败。** 本机 Docker CLI 24.4.0 存在但 daemon 未运行（`/var/run/docker.sock` 不存在），无法执行构建。结论基于路径字符串比对，未取得构建日志。**这是我给出的最有把握的推断，但仍然不是实测。**

**2. 后端能否启动。** 本机 Python 缺 fastapi/sqlmodel/passlib 等依赖，且配置的 PyPI 清华镜像返回 "no versions"，无法安装。因此所有后端运行时行为（JWT 签发、SSE 输出、JSONB 建表）均**未经运行验证**，仅基于代码阅读。

**3. `ProjectUpdate.updated_at` 是否真的更新。** Pydantic v2 的 `model_dump(exclude_unset=True)` 对 `default_factory` 字段的处理存在版本差异，未做实验验证。

**4. AI 动作正则的实际匹配率。** 未接入真实 LLM 测试，无法量化「模型输出符合正则的比例」。

## 冲突区

**冲突 1：审查报告 vs 代码。**
`审查报告.md` 声称 `SECRET_KEY = os.getenv("SECRET_KEY")` + `raise ValueError`，实际代码是 `os.getenv("SECRET_KEY", "<硬编码>")`。两者不可同时为真。**裁决：以代码为准，报告描述的是未落地的修改。** 交叉证据：`.env.example` 把 SECRET_KEY 标为 "required"，说明「应强制」是设计意图，「未强制」是实现现状——报告把意图写成了结果。

**冲突 2：README「云端自动保存」vs AutoSave 实现。**
README 第 28 行称自动保存到 PostgreSQL；`AutoSave.tsx` 第 13 行只调 `saveProject()`，该函数只 `set({projects: ...})`，经 persist 落 localStorage。**裁决：README 错误。** 交叉证据：`AutoSave` 文件里没有 import `api`，排除「通过其他路径上云」的可能。

**冲突 3：PROJECT_STATUS「待开发」vs 已实现代码。**
文档把图片导出、后端持久化、模板系统列为待开发；三者代码均已存在且构建通过。**裁决：文档滞后于代码。** 交叉证据：`html-to-image` 在 `package.json` 依赖里、`/projects/` 五个路由存在、`TEMPLATES` 数组有 2 项。

**冲突 4：README「完美支持中英文切换」vs 硬编码中文。**
侧栏、属性面板、登录、设置、向导确实走 i18n；但 AI 助手（533 个中文字符）、登录表单按钮（239）、画布工具栏（99）硬编码。**裁决：部分实现，README 夸大。** 注意：i18n 基础设施本身质量高（key 完全对齐），问题是覆盖不完整，不是实现错误。

**冲突 5：`测试清单.md` 的路由 vs 实际路由。**
清单用 `/api/users/`、`/api/token/`、`/api/users/me`；实际是 `/register`、`/token`、`/users/me`。**裁决：清单不可执行。** 交叉证据：`main.py` 的 10 个 `@app.` 装饰器全量列举可确认无 `/api/users/`。

## 未考察项（诚实边界）

- 未做外部同类产品对比（draw.io、NetBox、Lucidchart 等），因此不对「竞争力」下判断。
- 未审计依赖漏洞（未跑 `npm audit` / `pip-audit`）。
- 未评估性能（未做大数据量画布压测）。
- 未检查 git 历史中的其他分支或已删除文件。

## Validation Updates

无。本报告为单轮文件分析，未使用 subagent 交叉复核，所有结论由主 Agent 独立得出并标注置信度。
