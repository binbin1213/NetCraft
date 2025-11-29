# NetCraft 项目开发进度文档

本文档详细记录了 NetCraft 项目当前的开发状态、已实现功能的技术细节以及未完成功能的实施规划。

## 🟢 已完成功能 (Implemented Features)

### 1. 核心架构与基础设施
- **技术栈**: React 18 + Vite + TypeScript + TailwindCSS。
- **状态管理**: 使用 `Zustand` 替代 Redux。
  - **实现细节**: 创建了 `useStore` hook，集中管理 `nodes` (节点) 和 `edges` (连线)。通过 `selector` 和 `shallow` 比较优化渲染性能，避免不必要的重绘。
- **国际化 (i18n)**: 集成 `i18next`。
  - **实现细节**: 配置了 `en` (英文) 和 `zh` (中文) 语言包。使用 `LanguageDetector` 自动检测浏览器语言，支持在组件中通过 `useTranslation` hook 动态获取文本。

### 2. 交互式画布 (Interactive Canvas)
- **引擎**: 基于 `React Flow 11`。
- **拖拽生成 (Drag & Drop)**:
  - **实现细节**: 
    - `Sidebar` 组件设置 `draggable` 属性，并通过 `dataTransfer` 传递节点类型。
    - `Canvas` 组件监听 `onDrop` 事件，根据鼠标坐标转换为 React Flow 内部坐标 (`screenToFlowPosition`)，动态创建新节点并更新 Store。
- **自动布局 (Auto Layout)**:
  - **实现细节**: 引入 `dagre` 算法库。编写 `getLayoutedElements` 工具函数，计算有向图的层级结构，自动计算并更新所有节点的 `x, y` 坐标。

### 3. 自定义节点系统 (Custom Nodes)
- **组件**: `DeviceNode.tsx`
- **视觉风格**: 采用“玻璃拟态 (Glassmorphism)”设计，深色半透明背景 + 1px 精细边框。
- **功能特性**:
  - **动态端口**: 顶部 WAN 口，底部多个 LAN 口，方便布线。
  - **状态指示**: 内置呼吸灯动画 (Online/Warning/Offline)。
  - **交互**: 支持 Hover 高亮，点击 IP 地址自动复制到剪贴板。

### 4. 智能连线系统 (Smart Edges)
- **组件**: `SmartEdge.tsx`
- **多介质支持**:
  - **光纤 (Fiber)**: 黄色高亮，带有发光滤镜 (`drop-shadow`)。
  - **千兆/万兆网线 (Ethernet)**: 不同深浅的灰色/橙色实线。
  - **Wi-Fi**: 蓝色虚线 (`strokeDasharray`)。
- **动画效果**: 使用 SVG `<animateMotion>` 实现数据包沿线缆流动的动画，光纤模式下流动速度更快。

### 5. 属性面板 (Properties Panel)
- **双向绑定**: 
  - **实现细节**: 面板监听 Store 中的 `selectedNode` 和 `selectedEdge`。
  - **实时更新**: 修改表单 (Input/Select) 会立即触发 Store 的 `updateNodeData` 或 `updateEdgeData` action，画布上的元素无需刷新即可实时变化。
- **动态内容**: 根据选中对象的类型（节点或连线）动态渲染不同的配置表单。

---

## 🟡 待开发功能 (Planned Features) & 实现思路

### 1. 图片导出 (Export as Image)
- **目标**: 将当前拓扑图导出为 4K 高清 PNG/JPG。
- **实现流程**:
  1. 使用 `html-to-image` 库。
  2. 获取 React Flow 的视口容器 DOM 元素 (`.react-flow__viewport`)。
  3. 调用 `toPng()` 方法生成 Base64 数据。
  4. 创建一个隐藏的 `<a>` 标签触发下载。
  5. **难点处理**: 导出时需要临时关闭“Grid 背景”和“MiniMap”，只保留核心拓扑，导出后再恢复。

### 2. 后端持久化 (Backend Persistence)
- **目标**: 保存和加载用户的拓扑设计。
- **技术栈**: Python FastAPI + SQLite (SQLModel)。
- **实现流程**:
  1. **API 设计**:
     - `POST /projects`: 保存当前 Store 中的 `nodes` 和 `edges` JSON 数据。
     - `GET /projects/{id}`: 读取数据。
  2. **前端对接**:
     - 在顶部工具栏增加 "Save" 和 "Load" 按钮。
     - 使用 `fetch` 或 `axios` 调用后端接口。
     - 加载数据时，调用 Store 的 `setNodes` 和 `setEdges` 恢复状态。

### 3. 智能检测引擎 (Logic Engine)
- **目标**: 检测网络环路、IP 冲突、带宽瓶颈。
- **实现流程**:
  1. **环路检测**: 使用 DFS (深度优先搜索) 算法遍历 `edges`，如果发现访问已访问过的节点，则标记为环路。
  2. **IP 冲突**: 遍历 `nodes` 数组，检查 `data.ip` 是否有重复值。
  3. **瓶颈分析**: 检查连线两端的设备端口速率（例如：2.5G NAS 连到了 100M 交换机），如果速率不匹配，在连线上显示警告图标。

### 4. 键盘快捷键 (Shortcuts)
- **目标**: 提升专业用户的操作效率。
- **实现流程**:
  1. 监听 `document.keydown` 事件或使用 `react-hotkeys-hook`。
  2. 绑定按键逻辑：
     - `Backspace` / `Delete`: 删除选中元素 (调用 Store `deleteElements`)。
     - `Ctrl+C` / `Ctrl+V`: 复制粘贴节点（需处理 ID 生成和位置偏移）。
     - `Ctrl+S`: 触发保存。

### 5. 模板系统 (Templates)
- **目标**: 提供预设的家庭网络模板（如 "三室两厅 Mesh 组网"）。
- **实现流程**:
  1. 在 `src/data/templates` 中预定义几组 `nodes` 和 `edges` 的 JSON 数据。
  2. 在 Sidebar 增加 "Templates" 标签页。
  3. 拖拽模板到画布时，将模板中的所有节点和连线追加到当前 Store 中。
