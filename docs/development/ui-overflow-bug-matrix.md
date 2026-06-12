# UI 层级遮挡与溢出 Bug 诊断矩阵 (UI Overflow Bug Matrix)

本文件记录治理前典型的 UI 层级冲突、遮挡以及长文本/长表单在容器内溢出的案例，用作防回归和诊断对照。

---

## 1. UI Bug 诊断记录格式

每次在不同端或不同设备发现 UI 布局与层级问题，须按以下格式登记：

```markdown
### UI-Bug-[编号]：[问题简述]
- **页面/组件**：[例如：ImageCard2.tsx / ChatSidebar.tsx / PartialRedrawModal.tsx]
- **屏幕尺寸**：[桌面宽屏 / 移动端竖屏 / 笔记本常见分辨率]
- **是否移动端**：[是/否]
- **是否画布缩放**：[是/否，缩放比例]
- **是否有 Modal/Drawer/Toast**：[是/否]
- **溢出方向**：[水平 / 垂直 / 无]
- **遮挡元素**：[A 遮挡了 B，例如：Canvas 遮挡了 Settings Dropdown]
- **对应 z-index**：[治理前 A 与 B 的 z-index 设置]
- **解决方案与约束**：[例如使用 LayerPortal / min-width: 0 等]
```

---

## 2. 冻结期诊断案例清单

### UI-Bug-001：ImageCard2 底部动作菜单（Dropdown）被 Canvas 其他卡片或节点遮挡
- **页面/组件**：`ImageCard2.tsx` 内部的 `downloadMenu`
- **屏幕尺寸**：全尺寸
- **是否移动端**：否
- **是否画布缩放**：是 (任何缩放比例)
- **是否有 Modal/Drawer/Toast**：有 (Dropdown 浮层)
- **溢出方向**：无
- **遮挡元素**：画布上的其他节点或者连接线遮挡了当前 ImageCard 的下载选项下拉列表。这是因为下拉列表是在卡片内部 DOM 树渲染的，而卡片本身的层级（如 `z-index: 10`）可能低于其他选中节点的层级（如 `z-index: 30`）。
- **对应 z-index**：ImageCard 自身 z-index 在 10-30 波动，而下拉菜单无独立 Portal 提升层级。
- **解决方案**：统一将下拉菜单通过 `LayerPortal` 投递至 body 层，并使其 z-index 符合 `KK_LAYER.dropdown` (1100)。

### UI-Bug-002：移动端侧边栏（ChatSidebar）遮挡底部输入框
- **页面/组件**：`ChatSidebar.tsx` 与底部输入框 `PromptBar`
- **屏幕尺寸**：375px - 768px (移动端/平板竖屏)
- **是否移动端**：是
- **是否画布缩放**：否
- **是否有 Modal/Drawer/Toast**：有 (Drawer)
- **溢出方向**：垂直
- **遮挡元素**：由于 Sidebar 没有针对移动端键盘弹起和底栏进行安全区域 (Safe Area) 规避，导致遮挡了用户的底部输入区和提币/积分显示。
- **对应 z-index**：Sidebar 自身 `z-index` 随意设置（如 `z-index: 50`），未与全局 Modal 级和 Toast 级层级拉开绝对差距。
- **解决方案**：引入 `SafeOverflowContainer` 并使用 `KK_LAYER.drawer` (600)。

### UI-Bug-003：超长 prompt、长模型名或长错误信息撑破 ImageCard2 卡片宽度
- **页面/组件**：`ImageCard2.tsx` 底部信息栏
- **屏幕尺寸**：全尺寸
- **是否移动端**：否
- **是否画布缩放**：是
- **是否有 Modal/Drawer/Toast**：否
- **溢出方向**：水平溢出，撑开容器导致布局崩溃
- **遮挡元素**：文本直接溢出到卡片边框外，或者在 flex 子元素中由于没有设置 `min-width: 0`，导致整个卡片尺寸被撑大，产生不规则的横向滚动条或布局错乱。
- **对应 z-index**：无
- **解决方案**：给所有 flex/grid 子元素默认应用 `.kk-min-w-0` 类，并使用 `.kk-break-anywhere` 强制长词换行。
