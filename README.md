# NetCraft

> **The Next-Gen Network Architecture Designer for Homelab Enthusiasts.**
>
> 专为极客和家庭网络发烧友打造的下一代网络架构设计器。所见即所得，智能引导，炫酷 UI。

![NetCraft Banner](https://placehold.co/1200x600/0f172a/22d3ee?text=NetCraft+Preview)

## Features (核心特性)

### Cyberpunk UI
- **Glassmorphism Nodes**: 精致的玻璃拟态节点卡片，带有实时状态呼吸灯。
- **Smart Edges**: 
  - **Fiber Optic**: 炫酷的黄色发光光纤，带有高速数据流动动画。
  - **10G Ethernet**: 橙色万兆网线。
  - **Wi-Fi**: 蓝色虚线连接。
- **Dark Mode**: 深度优化的暗黑模式，专注设计体验。

### AI-Powered Assistant (智能 AI 助手)
- **Smart Q&A**: 内置基于 Qwen 的 AI 专家，解答 OpenWRT 配置、网络拓扑设计等问题。
- **Interactive UI**: 
  - **Breathing Orb**: 带有呼吸光环的悬浮球入口，支持全屏拖拽。
  - **Proactive Tips**: 智能气泡提示，主动打招呼。
  - **Context Aware**: 能够读取当前画布中的拓扑结构，提供针对性建议。

### Multi-Tenancy & Security (多租户与安全)
- **User System**: 完整的注册/登录流程，支持多用户隔离。
- **Cloud Sync**: 项目自动保存到云端数据库 (PostgreSQL)，随时随地访问。
- **Security**: 
  - **JWT Auth**: 标准的 JSON Web Token 认证机制。
  - **Argon2 Hashing**: 采用业界最强的 Argon2 算法加密用户密码。

### Intelligent Guide System (智能架构向导)
- **Context-Aware**: 系统会根据你当前添加的设备，智能推荐下一步操作。
  - *添加了光猫？* -> 💡 建议添加主路由。
  - *添加了 PVE？* -> 💡 建议创建 Windows/Linux 虚拟机。
- **Auto-Connect**: 点击推荐按钮，自动创建设备并**自动连线**（智能选择 1G/10G/光纤介质）。

### Rich Device Library (丰富设备库)
- **Basic**: Modem, Router, Switch, AP, PC, Firewall.
- **Virtualization**: Proxmox VE, ESXi, Unraid.
- **Systems**: Windows VM, Linux VM, OpenWrt Soft Router.

### Productivity Tools (生产力工具)
- **Auto Layout**: 基于 DAG 算法的一键自动布局，瞬间整理凌乱的拓扑。
- **Properties Panel**: 双向绑定的属性面板，实时修改 IP、名称和连线类型。
- **i18n**: 完美支持中英文切换 (跟随浏览器设置)。

---

## Getting Started (快速开始)

### Prerequisites (前置要求)
- Docker & Docker Compose

### Installation (安装)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/netcraft.git
   cd netcraft
   ```

2. **Start All Services**
   ```bash
   # Set your API key (required for AI features)
   # You can also set this in docker-compose.yml
   export DASHSCOPE_API_KEY=your_api_key
   
   docker-compose up --build -d
   ```
   
3. **Access the Application**
   Visit `http://localhost` to start designing!

---

## Architecture (架构)

- **Frontend**: React 18, TypeScript, Vite, React Flow, Zustand, TailwindCSS, Ant Design.
- **Backend**: FastAPI (Python), SQLModel, Pydantic.
- **Database**: PostgreSQL (with JSONB support for flexible schema).
- **Auth**: JWT + Argon2 Password Hashing.
- **AI**: DashScope API (Qwen Turbo).

---

## Usage Guide (使用指南)

1. **Register/Login**: 创建一个新账号并登录系统。
2. **Drag & Drop**: 从左侧 **Sidebar** 拖拽设备到画布。
3. **AI Help**: 点击右下角的呼吸球，询问 AI 关于网络配置的问题。
4. **Connect**: 拖拽节点上的 Handle 进行连线，在右侧属性面板修改连线类型（如改为光纤）。
5. **Save**: 点击右上角的 **"保存"** 按钮，将你的杰作存入云端数据库。
6. **Manage**: 点击 **"加载"** 按钮，查看、选择或删除你的历史项目。

---

## License

**Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**

© 2025 NetCraft Team. 

This project is strictly for **Non-Commercial Use Only**. You may not use this software, or any derivative works, for commercial purposes without prior written consent.
