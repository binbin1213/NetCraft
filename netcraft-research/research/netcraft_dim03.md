# NetCraft 维度 03：后端架构与安全

Route: C
时间基准：2026-11-13

## 后端体量

FastAPI 应用只有 5 个 Python 文件、488 行：`main.py`(201)、`ai_service.py`(171)、`models.py`(61)、`auth.py`(28)、`database.py`(27)[^dim03-loc]。10 个路由，无中间件层、无 service 层、无 repository 层——业务逻辑全部写在路由函数里。

## 认证：能用，但有三处硬伤

**1. JWT 密钥有硬编码默认值。** `SECRET_KEY = os.getenv("SECRET_KEY", "09d25e09...d3e7")`[^dim03-secret]。环境变量缺失时不会报错，而是静默使用仓库里公开的固定密钥——任何拿到这份源码的人都能伪造任意用户的 token。`.env.example` 里写着「required」，但代码并不强制。

**2. token 有效期与常量不一致。** 定义了 `ACCESS_TOKEN_EXPIRE_MINUTES = 60*24*7`（7 天），但 `create_access_token` 在未传 `expires_delta` 时用的是 `timedelta(minutes=15)`，而唯一的调用点 `login` 也没传 `expires_delta`[^dim03-token]。结果：注释说 7 天，实际签发 15 分钟。用户登录后一刻钟就被踢下线，`ACCESS_TOKEN_EXPIRE_MINUTES` 是死代码。

**3. 密码策略只存在于测试里。** 四份测试文件都在 `from app.auth import validate_password`，但 `auth.py` 只有 `verify_password` / `get_password_hash` / `create_access_token` 三个函数，`models.py` 里没有任何 validator[^dim03-novalidate]。也就是说这四份测试**必然 ImportError**，密码复杂度校验从未实现——注册接口接受 `"1"` 作为密码。

顺带：`requirements.txt` 同时装了 `passlib[argon2]`、`pyjwt`、`python-jose` 三套（实际只用 passlib + jose），依赖未固定版本（0 个 `==`）[^dim03-req]。

## 授权：项目级隔离做对了

`read/update/delete` 三个路由都校验 `project.user_id != current_user.id` 并返回 403[^dim03-authz]。这部分是全后端质量最高的地方。

## 但 `/api/chat` 完全裸奔

`chat_endpoint` 没有任何 `Depends(get_current_user)`，也不限流[^dim03-chat]。后果：

- 未登录即可消耗服务器配置的 `DASHSCOPE_API_KEY`；
- 请求体里可带任意 `config.api_key` / `base_url`，服务端会用它发起出站请求——是一个可被用作 SSRF/代理的开放端点；
- 更糟的是 `dashscope.api_key` 是**模块级全局变量**，`_stream_dashscope` 里 `dashscope.api_key = api_key` 直接改写全局[^dim03-global]。A 用户带自己的 key 请求后，B 用户不带 key 的请求会用 A 的 key。多用户场景下这是凭据串号。

## SSE 流式其实不成立

后端用 `StreamingResponse(..., media_type="text/event-stream")`，但 `chat_stream` 逐段 `yield` 的是**裸文本**，没有 `data: ` 前缀、没有 `\n\n` 分隔[^dim03-sse]。前端也没按 SSE 解析，而是直接 `reader.read()` 拼字符串——所以它能工作，纯属两端「一起不规范」。一旦中间加了标准 SSE 代理或换客户端就会坏。同时 nginx 配置里没有 `proxy_buffering off`，生产环境下流式会被缓冲成一次性输出[^dim03-nginx]。

## 数据层

- `create_engine(..., echo=True)` 写死在代码里[^dim03-echo]，生产环境每个 SQL 都打日志，含参数值。
- 无 Alembic / 无迁移，靠 `SQLModel.metadata.create_all`[^dim03-migrate]。改字段就得手工改库。
- `Project.data` 用 PostgreSQL 专有 `JSONB`，但 `database.py` 的 fallback 是 SQLite；一旦真的回退到 SQLite，建表会直接失败。
- `ProjectUpdate.updated_at` 用 `default_factory`，但 `model_dump(exclude_unset=True)` 会把它当作已设置字段[^dim03-updated]，实际能不能刷新取决于 Pydantic 对 default_factory 的处理——语义脆弱，且 `create_project` 完全没有设置 `updated_at` 的逻辑。

## 健康检查与可观测性

无 `/health` 端点、`docker-compose` 无 healthcheck、`depends_on` 无 `condition`[^dim03-health]。后端进程挂了，前端容器不会知道，nginx 只会返回 502。全后端**没有任何 `logging` 调用**（`grep` 结果为 0），只有 `echo=True` 的 SQL 日志。

[^dim03-loc]: Counted 5 Python files / 488 lines under backend/app on 2026-11-13.
[^dim03-secret]: File: backend/app/auth.py, line 8.
[^dim03-token]: File: backend/app/auth.py, lines 10 and 20-27; backend/app/main.py, line 115.
[^dim03-novalidate]: File: backend/app/auth.py, lines 14-28 (only 3 functions); backend/app/models.py, no validators; backend/tests/test_password_validation.py, line 5 imports validate_password.
[^dim03-req]: File: backend/requirements.txt, 12 lines, 0 pinned versions.
[^dim03-authz]: File: backend/app/main.py, lines 153-201.
[^dim03-chat]: File: backend/app/main.py, lines 79-92 (no auth dependency).
[^dim03-global]: File: backend/app/services/ai_service.py, lines 11 and 124-129.
[^dim03-sse]: File: backend/app/main.py, lines 89-92; ai_service.py yields raw text at lines 145, 147, 150.
[^dim03-nginx]: File: frontend/nginx.conf, lines 5-13 (no proxy_buffering directive).
[^dim03-echo]: File: backend/app/database.py, line 20.
[^dim03-migrate]: File: backend/app/database.py, lines 22-23.
[^dim03-updated]: File: backend/app/models.py, line 61; backend/app/main.py, line 179.
[^dim03-health]: File: docker-compose.yml, lines 19-33; no /health route in backend/app/main.py.
