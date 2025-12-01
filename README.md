# NetCraft

> **下一代家庭实验室网络架构设计器**
>
> 专为极客和家庭网络发烧友打造。所见即所得，智能引导，炫酷 UI。

![NetCraft Banner](https://placehold.co/1200x600/0f172a/22d3ee?text=NetCraft+Preview)

## 核心特性 (Features)

### 赛博朋克 UI (Cyberpunk UI)
- **玻璃拟态节点**: 精致的玻璃拟态节点卡片，带有实时状态呼吸灯。
- **智能连线**: 
  - **光纤 (Fiber Optic)**: 炫酷的黄色发光光纤，带有高速数据流动动画。
  - **万兆网线 (10G Ethernet)**: 橙色高亮连接。
  - **Wi-Fi**: 蓝色虚线无线连接。
- **沉浸式暗黑模式**: 深度优化的暗黑配色，专注设计体验。

### AI 智能助手 (AI-Powered Assistant)
- **智能问答**: 内置基于 Qwen 的 AI 专家，解答 OpenWRT 配置、网络拓扑设计等问题。
- **交互式 UI**: 
  - **呼吸悬浮球**: 带有呼吸光环的入口，支持全屏拖拽。
  - **主动提示**: 智能气泡提示，根据上下文主动提供建议。
  - **上下文感知**: 能够读取当前画布中的拓扑结构，提供针对性优化建议。

### 多租户与安全 (Multi-Tenancy & Security)
- **用户系统**: 完整的注册/登录流程，支持多用户隔离。
- **云端同步**: 项目自动保存到云端数据库 (PostgreSQL)，随时随地访问。
- **企业级安全**: 
  - **JWT 认证**: 标准的 JSON Web Token 认证机制。
  - **Argon2 加密**: 采用业界最强的 Argon2 算法加密用户密码。

### 智能架构向导 (Intelligent Guide System)
- **上下文感知**: 系统会根据你当前添加的设备，智能推荐下一步操作。
  - *添加了光猫？* -> 💡 建议添加主路由。
  - *添加了 PVE？* -> 💡 建议创建 Windows/Linux 虚拟机。
- **自动连线**: 点击推荐按钮，自动创建设备并**自动连线**（智能选择 1G/10G/光纤介质）。

### 丰富设备库 (Rich Device Library)
- **基础设备**: 光猫 (Modem), 路由器 (Router), 交换机 (Switch), 无线接入点 (AP), 电脑 (PC), 防火墙 (Firewall).
- **虚拟化平台**: Proxmox VE, ESXi, Unraid.
- **操作系统**: Windows VM, Linux VM, OpenWrt 软路由.

### 生产力工具 (Productivity Tools)
- **自动布局**: 基于 DAG 算法的一键自动布局，瞬间整理凌乱的拓扑。
- **属性面板**: 双向绑定的属性面板，实时修改 IP、名称和连线类型。
- **国际化**: 完美支持中英文切换 (跟随浏览器设置)。

---

## 生产环境部署 (Production Deployment)

我们推荐在生产环境中使用 Docker Compose 进行部署。您可以选择直接使用我们发布到 Docker Hub 的现成镜像（推荐），也可以自行构建镜像。

### 前置要求
- Docker Engine (20.10+)
- Docker Compose (v2.0+)

### 方式一：使用预构建镜像（推荐）

这种方式最简单，无需下载源码，我们已经为您准备好了生产环境配置文件。

1.  **下载配置文件**
    
    如果您已经克隆了仓库，可以直接使用根目录下的 `docker-compose.prod.yml`。
    或者直接下载该文件：
    ```bash
    curl -O https://raw.githubusercontent.com/binbin1213/netcraft/main/docker-compose.prod.yml
    ```

2.  **修改镜像名称**
    
    打开 `docker-compose.prod.yml`，将 `image: binbin1213/netcraft-frontend:latest` 中的 `binbin1213` 替换为实际的 Docker Hub 用户名。

3.  **启动服务**
    ```bash
    # 设置 API Key (如果不设置，AI 功能将不可用)
    export DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx

    # 使用生产环境配置启动
    docker-compose -f docker-compose.prod.yml up -d
    ```

4.  **访问应用**
    打开浏览器访问 `http://localhost` 或您的服务器 IP。

### 方式二：自行构建镜像

如果您需要对代码进行修改，或者希望从源码构建，可以使用此方法。

1.  **克隆仓库**
    ```bash
    git clone https://github.com/binbin1213/netcraft.git
    cd netcraft
    ```

2.  **构建并启动**
    ```bash
    # 设置 API Key
    export DASHSCOPE_API_KEY=your_api_key
    
    # 构建并后台运行
    docker-compose up --build -d
    ```

---

## 开发指南 (Development)

如果您是开发者，想要参与贡献代码，请按照以下步骤配置开发环境。

### 技术栈
- **Frontend**: React 18, TypeScript, Vite, React Flow, Zustand, TailwindCSS.
- **Backend**: FastAPI (Python), SQLModel, Pydantic.
- **Database**: PostgreSQL.

### 本地开发启动

1. **克隆仓库**
   ```bash
   git clone https://github.com/binbin1213/netcraft.git
   cd netcraft
   ```

2. **启动所有服务**
   ```bash
   # 使用 docker-compose 启动所有依赖和服务
   docker-compose up --build
   ```
   或者，您可以分别手动启动前端和后端服务（详见 `frontend/README.md` 和 `backend/README.md`）。

---

## 使用指南 (Usage Guide)

1. **注册/登录**: 首次访问需创建一个新账号。
2. **拖拽设计**: 从左侧 **Sidebar** 拖拽设备到画布。
3. **AI 助手**: 点击右下角的呼吸球，询问 AI 关于网络配置的问题。
4. **连线**: 拖拽节点上的 Handle 进行连线，在右侧属性面板修改连线类型（如改为光纤）。
5. **保存项目**: 点击右上角的 **"保存"** 按钮，将你的杰作存入云端数据库。

---

## 许可证 (License)

**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**

© 2025 NetCraft Team. 

本项目仅供 **非商业用途**。未经书面许可，禁止用于任何商业目的。
