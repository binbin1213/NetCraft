# NetCraft 维度 02：前端架构与状态管理

Route: C
时间基准：2026-11-13

## 技术栈实测

React 18.3 + TypeScript 5.9 + Vite 6.4 + React Flow 11.11 + Zustand 4.5 + zundo 2.3 + Ant Design 5.22 + Tailwind 3.4 + i18next 25。构建实测通过：`tsc -b && vite build` 成功，产物为单一 JS chunk 1,387.81 kB（gzip 440.54 kB），触发 Vite 500 kB 体积告警[^dim02-build]。

生产构建能过、但 lint 不干净：`npm run lint` 报 31 个问题（29 errors / 2 warnings），其中 20 个 `no-explicit-any`、3 个未使用变量、2 个 hooks 依赖缺失[^dim02-lint]。

## 状态管理：单 store 承担了四类职责

`useStore` 一个文件 279 行，同时装：认证态、本地项目列表、画布 nodes/edges、图算法动作，并被 `persist` + `temporal` 两层中间件包裹[^dim02-store]。

具体代价：

- **持久化范围过大**：`partialize` 把 `token`、`user`、`projects`、`nodes` 一并写进 localStorage[^dim02-persist]。JWT 落在可被 XSS 读取的存储里，且 `projects` 里的 nodes/edges 与顶层 nodes/edges 是重复存储——同一份拓扑在 localStorage 里存两遍。
- **历史栈未限深**：`temporal(...)` 未传 `limit`，长时间拖拽会持续累积画布快照，内存随会话线性增长。
- **持久化版本迁移只做清洗**：`migrate` 只校验数组与去重边，不处理 v1 之后的字段演进[^dim02-migrate]。

## 渲染层三个真实缺陷

1. **dagre 图是模块级单例**：`const dagreGraph = new dagre.graphlib.Graph()` 定义在模块顶层，`setNode/setEdge` 只增不清[^dim02-dagre]。每次点「自动布局」都会把当前 nodes 再灌进同一个图。由于 dagre 按 id 覆盖，同 id 不会翻倍，但对已删除节点的残留节点仍留在图里，布局结果会受历史状态影响——这是一次「布局越用越怪」的隐患。

2. **画布控件配色失效**：`Controls` 传了 `className="bg-slate-800 ... fill-slate-300"`，但 React Flow 的按钮自带 `background: #fefefe`，图标 fill 被 `fill-slate-300` 覆盖成浅灰。实测按钮背景 `rgb(254,254,254)`、图标 `rgb(203,213,225)`，对比度约 1.5:1，缩放/适应视图/锁定四个按钮在深色界面上几乎不可见[^dim02-controls]。这是纯视觉缺陷，功能正常。

3. **布局依赖视口宽度且无响应式降级**：1600×950 视口下三栏为 256 / 1056 / 288 px；在 498 px 宽视口下实测 React Flow 容器宽度为 0，触发 React Flow 的 "parent container needs a width and a height" 警告（页面加载时记录 3 次）[^dim02-zero-width]。原因是侧栏固定 `w-64`、`w-72` 加画布 `flex-1`，没有最小宽度或折叠逻辑，窄屏直接塌成 0。

## 键盘与交互

Ctrl+C/V 复制粘贴节点、Ctrl+Z/Y 撤销重做、Ctrl+S？——**没有 Ctrl+S**。保存只能点按钮。复制逻辑只复制节点不复制节点间的边，粘贴时统一重新分配 IP[^dim02-shortcuts]。

## 国际化

`en.ts` 与 `zh.ts` 各 101 行、79 个叶子 key，两侧完全对齐（实测无单边缺失），代码里用到的 53 个字面量 key 全部有定义[^dim02-i18n]。这部分质量明显高于其他模块。

但 i18n 只覆盖了部分界面：`AiAssistant.tsx`（533 个中文字符）、`Login.tsx`（239）、`Canvas.tsx`（99）里的中文全部硬编码，切到英文界面后仍是中文[^dim02-hardcoded]。README 声称「完美支持中英文切换」，实际是「部分支持」。

[^dim02-build]: Ran `npm run build` in frontend/ on 2026-11-13; output: dist/assets/index-qbL6ALkn.js 1,387.81 kB, gzip 440.54 kB.
[^dim02-lint]: Ran `npm run lint` in frontend/ on 2026-11-13; 31 problems (29 errors, 2 warnings).
[^dim02-store]: File: frontend/src/store/useStore.ts, lines 78-277.
[^dim02-persist]: File: frontend/src/store/useStore.ts, lines 234-245.
[^dim02-migrate]: File: frontend/src/store/useStore.ts, lines 246-273.
[^dim02-dagre]: File: frontend/src/utils/autoLayout.ts, lines 4-28.
[^dim02-controls]: Observed in managed browser at http://127.0.0.1:5199/ on 2026-11-13: `.react-flow__controls-button` computed backgroundColor rgb(254,254,254), svg fill rgb(203,213,225).
[^dim02-zero-width]: Observed in managed browser at 498x870 viewport on 2026-11-13: `.react-flow` width 0; 3 console warnings "The React Flow parent container needs a width and a height to render the graph".
[^dim02-shortcuts]: File: frontend/src/components/Canvas/Canvas.tsx, lines 85-146.
[^dim02-i18n]: File: frontend/src/i18n/locales/en.ts and zh.ts, 101 lines each; verified 79 leaf keys on both sides with no asymmetric keys.
[^dim02-hardcoded]: File: frontend/src/components/AiAssistant/AiAssistant.tsx (533 CJK chars), Auth/Login.tsx (239), Canvas.tsx (99).
