# NetCraft 维度 05：工程实践、测试与文档可信度

Route: C
时间基准：2026-11-13

## 测试：四份文件、零个可运行的测试

仓库里有 4 个后端测试文件、共 516 行，全部围绕 `validate_password`：

| 文件 | 行数 | 导入方式 | 能跑吗 |
|---|---|---|---|
| `backend/test_password_validation.py` | 119 | `from app.auth import validate_password` | 否，函数不存在 |
| `backend/test_password_validation_simple.py` | 116 | 自带函数副本 | **能**（不测产品代码） |
| `backend/tests/test_password_validation.py` | 136 | `from backend.app.auth import ...` | 否 |
| `backend/tests/test_password_validation_unittest.py` | 145 | `from app.auth import ...` | 否 |

我实际执行了唯一能跑的那个：`python3 test_password_validation_simple.py` → 50 passed / 0 failed[^dim05-run]。但它是把校验函数**复制**到测试文件里再测自己，等于自己测自己，对产品代码零覆盖。

另外三个文件全部会因为 `validate_password` 不存在而 ImportError——`auth.py` 里只有 3 个函数，没有这个[^dim05-noexport]。这意味着 git 最新提交 `feat: add password validation tests` 加进来的是**四份测试，零份能验证功能**。

前端测试：0 个（`*.test.ts(x)` 匹配数 0），`package.json` 无 `test` 脚本，无 vitest/jest 依赖。

## 文档与代码的偏离（这是本项目最系统性的问题）

仓库里有 5 份 Markdown 自称描述了工程状态，逐条核对后：

**`审查报告.md`** 声称已完成三项修改并「✅ 全部通过审查」：
- 「JWT 密钥改为从环境变量读取，缺失则 `raise ValueError`」→ 实际是 `os.getenv` 带默认值，无校验[^dim05-audit1]。
- 「添加基于环境变量的 CORS 配置，支持逗号分隔多源」→ 实际 `allow_origins` 是硬编码单值[^dim05-audit2]。
- 「所有敏感配置均通过环境变量管理」→ 数据库口令仍硬编码在 compose 里。

报告里贴出的代码片段（`if not SECRET_KEY: raise ValueError`）在仓库中**不存在**。这是一份描述「假想中的修改」的审查报告。

**`可观测性增强建议.md`** 建议加 `logger.info("JWT SECRET_KEY loaded successfully...")` 等日志，验收标准写得很细。但全后端 `logger` 出现次数为 0，一条都没落地[^dim05-obs]。文档停留在「建议」状态，却和「审查报告」一起被提交，容易被读成「已完成」。

**`测试清单.md`** 的用例更严重：它引用了 `/api/users/`、`/api/token/`、`/api/users/me` 这些路由[^dim05-list]，而实际路由是 `/register`、`/token`、`/users/me`（无 `/api` 前缀）。清单里给的 curl 示例跑不通。用例 1.1.2「未设置 SECRET_KEY 时服务启动失败」在当前代码下必然不成立。

**`PROJECT_STATUS.md`** 把已实现的功能列为「待开发」（图片导出、后端持久化、模板系统都已存在），且把持久化技术栈写成「SQLite」，实际是 PostgreSQL + JSONB。

**README** 的「企业级安全」「完美支持中英文切换」「云端自动保存」三处均与实现不符（分别见 dim02/dim03 的对应条目）。

## 版本与元数据不一致

- `package.json` version `0.0.0`，界面显示 `v0.1.0 (Beta)`，README 无版本号。
- README banner 用 `placehold.co` 占位图，无真实截图。
- `LICENSE` 是 CC BY-NC-SA 4.0，git 历史里有一次 `Add MIT License` 后改为 CC——许可从宽松改为禁商用，属于重大变更但无迁移说明。
- `frontend/README.md` 仍是 Vite 官方模板原文，未改一字。

## 数据卫生

- `.DS_Store` **未**被提交（`git ls-tree -r HEAD` 命中 0 次），仅存在于工作区，`.gitignore` 规则生效。（更正：初版报告误写为已入库，实际核验后不成立。）
- `backend/app/__pycache__/` 下 5 个 `.cpython-314.pyc` 被提交入库（`git ls-tree` 确认），原因是 `.gitignore` 写的是 `backend/__pycache__/`，未覆盖 `backend/app/__pycache__/`。
- 仓库根目录在本会话中新增了 `netcraft-ui*.png` 等截图（本次分析产物，非仓库原有）。

## 代码风格

- 注释语言混用：`SmartEdge.tsx` 中文注释，`autoLayout.ts` 英文，`Canvas.tsx` 中英混杂并残留调试性注释（"// ... rest of the component logic (no changes to logic...)"）[^dim05-comment]。
- `AiAssistant.tsx` 458 行单文件承载拖拽、SSE 解析、Markdown 渲染、设置表单、localStorage 读写五类职责，是全前端最重的组件。
- `@ts-ignore` 出现在 `main.tsx`，而该行并无类型错误。

[^dim05-run]: Ran `python3 test_password_validation_simple.py` in backend/ on 2026-11-13: "Total tests: 50 / Passed: 50 / Failed: 0 / Success rate: 100.0%".
[^dim05-noexport]: File: backend/app/auth.py, lines 14-28 (verify_password, get_password_hash, create_access_token only).
[^dim05-audit1]: File: 审查报告.md, lines 13-18 vs backend/app/auth.py, line 8.
[^dim05-audit2]: File: 审查报告.md, lines 26-29 vs backend/app/main.py, line 31.
[^dim05-obs]: File: 可观测性增强建议.md, lines 20-56; grep for "logging" / "logger" in backend/app returns 0 matches.
[^dim05-list]: File: 测试清单.md, lines 89-92 vs backend/app/main.py, lines 96-120.
[^dim05-comment]: File: frontend/src/components/Canvas/Canvas.tsx, lines 60-64.
