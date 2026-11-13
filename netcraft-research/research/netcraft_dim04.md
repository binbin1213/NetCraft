# NetCraft 维度 04：构建、部署与 CI

Route: C
时间基准：2026-11-13

## 关键发现：源码构建路径是断的

`docker-compose.yml` 里 backend 用 `build: ./backend`，即以 `backend/` 为构建上下文；而 `backend/Dockerfile` 里三条 COPY 全部以仓库根目录为基准书写：

```
COPY ./backend/requirements.txt /code/requirements.txt
COPY ./backend/app /code/app
COPY ./RAG/KnowledgeBase /code/RAG/KnowledgeBase
```

构建上下文里不存在 `backend/backend/` 这一层，三条 COPY 全部会失败[^dim04-ctx]。也就是说 `docker-compose up --build`（README「方式二」和 `scripts/deploy.sh` 主推的路径）无法构建出镜像。`scripts/publish_images.sh` 同样用 `docker build ... ./backend`，一样会失败。

对比之下 CI 是能过的：workflow 里 backend 用 `context: .` + `file: ./backend/Dockerfile`[^dim04-ci]，恰好匹配 Dockerfile 的写法。**CI 能构建、本地不能构建**——这是最容易让人误判「部署没问题」的陷阱。

## 两套镜像来源并存但配置不同步

| | docker-compose.yml (dev) | docker-compose.prod.yml |
|---|---|---|
| backend 构建 | `build: ./backend`（实际失败） | `image: ghcr.io/binbin1213/netcraft-backend:latest` |
| CI 推送目标 | — | DockerHub + GHCR，tag 为 `latest` 与 `${{ github.sha }}` |
| `update_prod.sh` 拉取 | — | `docker-compose -f docker-compose.prod.yml pull frontend backend` |

`update_prod.sh` 只 pull frontend/backend、不 pull db，注释说明是「避免 Docker Hub 连接问题」[^dim04-update]。这带来一个副作用：db 镜像永远不会被更新，且无提示。

## 部署配置中的安全与稳健性问题

1. **数据库口令硬编码在两份 compose 文件里**：`netcraft:netcraft_secret`[^dim04-db]。`.env.example` 提示要改成 `CHANGE_ME_STRONG_PASSWORD`，但 compose 不读这个变量。
2. **JWT 密钥没有接入 compose**：`.env.example` 里有 `SECRET_KEY`，但两份 compose 的 backend `environment` 只传了 `DATABASE_URL` 和 `DASHSCOPE_API_KEY`[^dim04-env]。生产环境因此必然走 `auth.py` 里那个公开的默认密钥——安全默认值彻底失效。
3. **ALLOWED_ORIGINS 是幻觉配置**：`.env.example` 声明了它，`main.py` 里却写死 `allow_origins=["http://localhost:5173"]`[^dim04-cors]。生产环境从同源 nginx 访问时，浏览器根本不发跨域请求，所以「能用」；但任何真实跨域场景都会失败，且这个环境变量改了没反应。
4. **无 healthcheck**：`depends_on: - db` 只保证启动顺序，不保证 db 就绪。PostgreSQL 冷启动慢时 backend 会在 `create_db_and_tables()` 处失败退出，靠 `restart: always` 反复重启直到 db 起来——能用，但表现为「启动日志里一串连接失败」。
5. **镜像 tag 全是 `latest`**：prod compose 固定 `:latest`，`update_prod.sh` 只能靠 `pull` 拿新版本，**没有回滚路径**。CI 明明推了 `:${{ github.sha }}`，但没有任何地方消费它。
6. **frontend Dockerfile 用 `npm install` 而非 `npm ci`**，且无 `.dockerignore`[^dim04-docker]。`COPY . .` 会把本地 `node_modules` 一起塞进构建上下文（本机实测存在，约数百 MB）。

## CI 只做「构建并推送」

workflow 的 7 个 step 全部是 checkout / buildx / login / build-push[^dim04-ci]。没有 lint、没有测试、没有镜像扫描、没有部署。触发条件限定 `main` 分支且路径命中 `backend/**`、`frontend/**`、`RAG/**`——改 `docker-compose.prod.yml` 或 `nginx.conf`（在 frontend/ 内，会命中）等部署文件时，compose 的变更不会触发重建。

## 脚本质量参差

`dev-start.sh` 里 `echo "\n启动 NetCraft 服务..."` 用双引号包 `\n`，bash 不会转义，会原样打印 `\n`[^dim04-echo]。`deploy.sh` 结尾输出只到 `Frontend: http://localhost` 就截断了，没有后端/数据库地址。`publish_images.sh` 直接对 `./backend` 构建，与前述 Dockerfile 上下文问题同源[^dim04-publish]。

[^dim04-ctx]: File: docker-compose.yml, line 21 (`build: ./backend`); backend/Dockerfile, lines 8, 12, 15 (COPY paths prefixed with `./backend/`).
[^dim04-ci]: File: .github/workflows/docker-publish.yml, lines 47-52 (context `.`, file `./backend/Dockerfile`).
[^dim04-update]: File: update_prod.sh, lines 9-10.
[^dim04-db]: File: docker-compose.yml, lines 25 and 44; docker-compose.prod.yml, lines 24 and 41.
[^dim04-env]: File: docker-compose.yml, lines 24-27; docker-compose.prod.yml, lines 23-26.
[^dim04-cors]: File: .env.example, line 7; backend/app/main.py, line 31.
[^dim04-docker]: File: frontend/Dockerfile, lines 5 and 12; no .dockerignore in repository root or frontend/.
[^dim04-echo]: File: scripts/dev-start.sh, line 38.
[^dim04-publish]: File: scripts/publish_images.sh, lines 31-33.
