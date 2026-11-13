# NetCraft 维度 01：产品定位与功能面

Route: C（文件证据，未检索外部资料）
时间基准：2026-11-13

## 结论

NetCraft 是一个「家庭实验室网络架构设计器」：左侧设备库拖拽到画布、连线、右侧改属性、AI 助手问答，外加账号与云端项目存储。它的形态是单页 Web 应用（非桌面、非 SaaS 多租户平台），目标用户是自建 OpenWrt / PVE / NAS 环境的爱好者。

## 功能清单（以代码为准，而非 README 为准）

| 能力 | 状态 | 证据 |
|---|---|---|
| 拖拽/双击放置 13 类设备节点 | 已实现 | `DeviceType` 联合类型 13 项[^dim01-types]；侧栏 3 组设备表格[^dim01-sidebar] |
| 节点连线 + 线型（1G/2.5G/10G/光纤/Wi-Fi） | 已实现 | `ConnectionType` 与 `SmartEdge` 配色/虚线/流动动画[^dim01-edge] |
| 属性面板双向绑定 | 已实现 | `PropertiesPanel` 直接读 store 的 `selected` 标记[^dim01-props] |
| 自动布局（dagre） | 已实现 | `getLayoutedElements`[^dim01-layout] |
| 导出图片 / 导出 JSON | 已实现 | `html-to-image` 的 `toPng` 与 Blob 下载[^dim01-export] |
| JSON 导入 | **未实现** | 全仓库无 `type="file"` / import 解析逻辑 |
| 云端项目 CRUD | 已实现（需登录） | `/projects/` 5 个受保护路由[^dim01-routes] |
| AI 对话 + 按指令改画布 | 部分实现 | 仅处理 `update_topology`，`auto_layout` 指令被忽略[^dim01-ai] |
| 架构向导（上下文推荐/自动连线） | 已实现 | `RECOMMENDATIONS` + `AUTO_CONNECT_RULES`[^dim01-guide] |
| 网络检测（环路/IP 冲突/瓶颈） | **未实现** | 全仓库无相关算法 |
| 模板库 | 已实现（2 个模板） | `TEMPLATES` 长度 2[^dim01-templates] |
| 撤销/重做 | 已实现 | zundo `temporal` 中间件 + Ctrl+Z/Y[^dim01-undo] |

## 两套并存的「项目管理」

这是产品面最容易被忽略的结构问题：代码里有两个互不相通的项目系统。

1. **本地项目**：`useStore` 里的 `projects`（uuid 主键）+ `ProjectManager` 弹窗 + `AutoSave` 定时器，全部只写 localStorage。
2. **云端项目**：`Canvas.tsx` 内部的 `currentProjectId`（数字主键）+ Ant Design Modal，调用 `/projects/` API。

两者没有共享状态：`Canvas` 用 `useState` 而非 store[^dim01-two-systems]，`AutoSave` 只认 store 里的 uuid 项目，永远不会调用后端。用户会看到两个不同入口的「项目」概念，且本地项目不会出现在云端列表里。

## 文档与实现的三处口头承诺

- README 声称「项目自动保存到云端数据库 (PostgreSQL)」，实际 `AutoSave` 只写 localStorage[^dim01-autosave]。
- README 指导「详见 `backend/README.md`」，该文件不存在。
- 侧栏显示 `v0.1.0 (Beta)`，`package.json` 的 version 是 `0.0.0`。

## 功能的真实完成度判断

不是「待开发清单」里写的那样乐观：`PROJECT_STATUS.md` 把图片导出、后端持久化、模板系统列为「待开发」，但这三项代码里都已存在[^dim01-status-doc]；反过来，它没提的「两套项目系统」「JSON 只能导出不能导入」才是真实缺口。文档滞后于代码约 1 个迭代。

[^dim01-types]: File: frontend/src/types/nodes.ts, lines 1-16.
[^dim01-sidebar]: File: frontend/src/components/Sidebar/Sidebar.tsx, lines 78-98.
[^dim01-edge]: File: frontend/src/components/Canvas/SmartEdge.tsx, lines 25-75.
[^dim01-props]: File: frontend/src/components/Properties/PropertiesPanel.tsx, lines 22-24.
[^dim01-layout]: File: frontend/src/utils/autoLayout.ts, lines 10-43.
[^dim01-export]: File: frontend/src/components/Canvas/Canvas.tsx, lines 203-255.
[^dim01-routes]: File: backend/app/main.py, lines 124-201.
[^dim01-ai]: File: frontend/src/components/AiAssistant/AiAssistant.tsx, lines 174-205; backend/app/services/ai_service.py, lines 77-91.
[^dim01-guide]: File: frontend/src/components/Guide/GuideSystem.tsx, lines 19-63.
[^dim01-templates]: File: frontend/src/data/templates.ts, lines 12-51.
[^dim01-undo]: File: frontend/src/store/useStore.ts, lines 78-80; frontend/src/components/Canvas/Canvas.tsx, lines 129-139.
[^dim01-two-systems]: File: frontend/src/components/Canvas/Canvas.tsx, lines 70-72; frontend/src/store/useStore.ts, lines 91-160.
[^dim01-autosave]: File: frontend/src/components/AutoSave.tsx, lines 9-19; README.md, line 28.
[^dim01-status-doc]: File: PROJECT_STATUS.md, lines 47-91.
