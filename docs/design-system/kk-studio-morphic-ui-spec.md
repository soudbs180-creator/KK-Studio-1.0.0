# KK Studio Morphic UI 设计系统规范

状态：Active  
适用版本：KK Studio v1.6.1  
设计参照：[Morphic Studio Guest Demo](https://studio.morphic.com/invite/MDE5ZmE3ZTItNjk4MC03M2JhLWE1OTMtOTA3NTAzMTM4NzNi)  
事实来源：`packages/ui/src/core/tokens.ts`、`packages/ui/src/core/layout.ts`、`apps/web/src/styles/morphic-ui.css`

## 1. 目标与边界

本规范把 KK Studio 的公开页、认证、Canvas、Copilot、创作、资产、设置、账户、充值、管理后台和移动端统一为同一个紧凑深色产品系统。

必须保留：

- KK Studio 品牌、业务文案、路由和现有功能。
- `AppSurface`、`WorkspacePanel`、`MobilePrimaryTab`、`GenerationMode` 和既有回调语义。
- 鉴权、计费、Provider、Canvas、Agent、持久化和 API 契约。
- 旧主题偏好的读取兼容；实际产品界面统一归一为深色。

禁止：

- 复制 Morphic 名称、商标、Logo、插画、图片或专有素材。
- 为视觉模仿新增没有业务支撑的路由、时间线或工具。
- 在业务组件内新增原始颜色、任意圆角、阴影或原始 `z-index`。
- 新建第二套 Token、组件前缀或局部主题。
- 恢复 Frost、Clay、棕色长页、彩色渐变卡片或推导式浅色主题。
- 使用 div/CSS art、手写 SVG 或占位图冒充真实产品素材。

## 2. 参考状态矩阵

参考采集日期为 2026-07-28。桌面统一使用 1280×720；移动端参考使用 390×844，仅采集视觉语言，不继承目标站的横向裁切缺陷。

| 状态 | 参考特征 | KK Studio 映射 | 必验交互 |
|---|---|---|---|
| Canvas | 黑色点阵、48px 顶栏、左浮动面板、底部 Composer | 无限画布、历史、收藏、图层、生成输入 | 画布聚焦、面板开关、Prompt 输入、生成 |
| Copilot | 左会话列表、中央对话、底部宽输入区 | Chat、AI Agent Runtime、AI takeover | 打开助手、会话切换、发送、关闭 |
| Compose | 左资产面板、中央创作区、紧凑工具条 | 图片、视频、音频、PPT、编辑、资产 | 模式切换、素材选择、输入聚焦 |
| Login | 412px 深色对话框、36px 控件、14px 圆角 | 登录、注册、找回、Google、微信、临时登录 | 表单校验、密码显示、关闭、键盘 |
| Workflow | 搜索、分类胶囊、卡片网格、紧凑底栏 | 工具、工作流、命令面板 | 搜索、筛选、选择、关闭 |
| Mobile | 同色系顶栏、抽屉、Sheet、底部 Composer | 移动结果流、电商、详情、生成 | 安全区、抽屉、Tab、输入、主操作 |

### 2.1 参考测量

| 对象 | 测量值 |
|---|---:|
| 顶栏 | 48px |
| 左面板 | x=12px、top=48px、bottom=10px、width=262px |
| 左面板圆角 | 14px |
| Composer | max-width=570px、bottom=10px、radius=20px |
| 登录对话框 | width=412px、max-height=546px/90vh、radius=14px |
| 桌面按钮 | 30px |
| 胶囊按钮 | 32px |
| 表单控件 | 36px |
| 移动交互目标 | 至少 44px |
| 点阵 | 16×16px，白色 7% |

## 3. 唯一设计来源

### 3.1 TypeScript

- `UI_SYSTEM_TOKENS`：颜色、字号、字重、间距、圆角、动效、断点。
- `KK_LAYOUT.workspace`：顶栏、面板、Composer、Dialog、桌面控件和移动抽屉几何。
- `TOKENS`：保留旧调用兼容，值必须映射到 `UI_SYSTEM_TOKENS`。
- `KK_LAYER`：唯一层级来源；组件不得写原始层级数字。

### 3.2 CSS

`apps/web/src/styles/morphic-ui.css` 是 Web 适配层：

- `--kk-morphic-*` 是运行时变量。
- 旧 `--frost-*`、`--clay-*` 和已有 `--kk-*` 变量仅作为兼容桥映射到新系统。
- 新组件只能直接使用 `--kk-morphic-*` 或共享 `--kk-*` 语义变量。
- 兼容变量不得成为新代码的依赖。

## 4. 视觉 Token

### 4.1 颜色

| Token | 值 | 用途 |
|---|---|---|
| `color.canvas` | `#000000` | Canvas、Copilot、创作舞台 |
| `color.page` | `#171717` | 首页、设置、账户、管理后台页面 |
| `color.panel` | `oklch(0.235 0 0)` | 侧栏、卡片、Dialog |
| `color.control` | `oklch(0.2603 0 0)` | 输入、按钮、选中项 |
| `color.hover` | `rgba(255,255,255,0.08)` | Hover |
| `color.border` | `rgba(255,255,255,0.06)` | 默认边界 |
| `color.textPrimary` | `oklch(0.97 0 0)` | 标题、正文、主要图标 |
| `color.textSecondary` | `oklch(0.708 0 0)` | 标签、辅助信息 |
| `color.textMuted` | `oklch(0.556 0 0)` | 占位、元数据 |
| `color.textDisabled` | `oklch(0.439 0 0)` | 禁用状态 |
| `color.actionPrimary` | `oklch(0.5926 0.2236 258.42)` | 唯一主操作 |

状态色只用于语义反馈，不得作为大面积装饰。危险操作使用 `--kk-morphic-danger`，成功、警告和错误必须同时提供文字或图标语义，不能只依赖颜色。

### 4.2 字体

- 字族：`Inter, sans-serif`。
- 字号：12 / 14 / 16 / 24px。
- 字重：400 / 500 / 600。
- 12px：元数据、Tab、Tooltip、紧凑按钮。
- 14px：默认正文、表单、菜单。
- 16px：分区标题和移动正文。
- 24px：Dialog、认证和核心页面标题。
- 禁止使用 650、700、800、900 作为常规界面字重。
- 数值可以使用等宽数字特性，但不更换界面字体。

### 4.3 圆角、边界与阴影

| Token | 值 | 用途 |
|---|---:|---|
| `radius.button` | 7px | 小按钮、图标按钮 |
| `radius.control` | 8px | 输入、Select、菜单项 |
| `radius.panel` | 14px | 面板、Dialog、卡片 |
| `radius.composer` | 20px | Composer |
| `radius.pill` | 9999px | Tab、分类胶囊 |

默认不使用阴影。Dialog、Dropdown、Sheet 可以使用低强度浮层阴影，并必须同时有遮罩或边界提供层级。

### 4.4 动效

- Hover/Focus/颜色：100–125ms。
- 面板、Sheet、Drawer：160ms。
- 只允许透明度、颜色和不超过 4px 的位移。
- 禁止弹簧缩放、持续发光、渐变流动和装饰动画。
- `prefers-reduced-motion: reduce` 下取消非必要动效。

## 5. 核心布局

### 5.1 桌面

```text
┌──────────────────────────── 48px Top bar ────────────────────────────┐
│ KK Studio        [ 画布 | Copilot | 创作 ]             Credits/User │
├───────────────┬──────────────────────────────────────────────────────┤
│ 262px panel   │                                                      │
│ inset 12px    │                 Canvas / Copilot / Create            │
│ radius 14px   │                                                      │
│               │                  570px Composer                      │
└───────────────┴──────────────────────────────────────────────────────┘
```

- 顶栏固定 48px，分段切换视觉居中。
- Canvas 不因面板出现而改变坐标系；浮动面板覆盖在舞台上。
- 左面板距左 12px，底部 10px，宽 262px。
- Composer 水平居中，底部 10px，最大宽 570px。
- 打开 Copilot 时复用现有 Chat/Agent Runtime，不创建平行助手。

### 5.2 移动

- 顶栏高度为 `env(safe-area-inset-top) + 48px`。
- Composer 左右 8px，底部 `env(safe-area-inset-bottom) + 8px`。
- 抽屉宽度 `min(88vw, 320px)`。
- 工作流、设置、资产和复杂选择器优先使用 `KkSheet`。
- 375、390、430、768px 都必须无横向滚动、按钮裁切或输入遮挡。
- 软键盘打开时 Composer 保持可见，结果流允许独立滚动。

## 6. 共享组件契约

### 6.1 `KkSurface`

只允许五种 `variant`：

| Variant | 用途 |
|---|---|
| `canvas` | 黑色点阵舞台 |
| `panel` | 侧栏、资产、设置导航 |
| `control` | 紧凑控制容器 |
| `dialog` | 居中浮层 |
| `sheet` | 移动抽屉与 Bottom Sheet |

不得扩展业务专属 Variant。差异通过内容结构和组合实现。

### 6.2 `KkTabs`

- 使用 `role="tablist"` / `role="tab"` / `aria-selected`。
- 高度 32px，内部 Tab 26px。
- Selected 使用 `control` 背景，不使用描边发光。
- Disabled 使用禁用文字色，不响应点击。

### 6.3 `KkComposerShell`

- Canvas、Copilot、创作共用外壳。
- 默认最大宽度 570px、圆角 20px、控制背景。
- 内容区允许自动增高，达到上限后内部滚动。
- 提交按钮是唯一高强调主操作。

### 6.4 `KkSheet`

- 支持 `bottom | left | right`。
- Escape 关闭，关闭后恢复焦点。
- 点击遮罩关闭；内容区点击不冒泡。
- 移动端必须包含安全区。

### 6.5 `KkTooltip`

- 指针 Hover 和键盘 Focus 均可显示。
- 文案 12px，最大宽 240px。
- 不承载表单、按钮或长说明。

### 6.6 基础表单和浮层

`KkButton`、`KkInput`、`KkSelect`、`KkDropdown`、`KkModal` 必须：

- 只通过共享类和 Token 呈现颜色。
- 保留调用方 `className` / `style` 扩展能力，但调用方不得覆盖视觉 Token。
- 保留 Disabled、Loading、Error、Focus 和键盘关闭。
- Modal 默认 412px；非认证大面板可显式传入宽度。
- Modal/Sheet 打开时锁定背景滚动并恢复触发点焦点。

## 7. 状态规范

| 状态 | 视觉 | 行为 |
|---|---|---|
| Default | 6% 边界、主/次文字 | 可交互 |
| Hover | 8% 白色覆盖 | 不移动布局 |
| Focus | 2px 品牌色 Focus ring | 键盘清晰可见 |
| Selected | Control 背景、主文字 | 使用 ARIA selected/current |
| Disabled | 禁用文字、62% 不透明度 | 禁止点击 |
| Loading | 72% 内容、真实进度文案或现有 Loader 图标 | 保持尺寸 |
| Error | 语义边界与可操作文案 | 聚焦首个错误 |
| Empty | 次文字、明确下一步 | 主操作存在时只有一个 |
| Dragging | 72% 不透明度 | 不改变卡片尺寸 |
| Generating | 输入可读、提交禁用、队列状态可见 | 不阻塞已有结果 |

## 8. 页面映射

| 页面/Surface | 结构 | 关键组件 |
|---|---|---|
| 公开首页 | 48px 黑色导航、黑色点阵 Hero、紧凑能力分区 | Header、Primary Button、Panel |
| 登录/注册 | 遮罩 + 412px Dialog | Input、Button、Modal |
| Canvas | Top bar + 左浮动 Panel + Canvas + Composer | Surface、Tabs、Composer |
| Copilot | Top bar + 会话 Panel + 对话区 + Composer | Surface、Tabs、Composer |
| 创作 | Top bar + 资产 Panel + 生成工作区 | Surface、Tabs、Dropdown |
| 资产/收藏/历史 | 262px Panel + Tabs + 列表 | Surface、Tabs、Tooltip |
| 工作流/工具 | Dialog/Sheet + 搜索 + 分类 + 网格 | Modal、Sheet、Input、Tabs |
| 设置 | 左导航 + 主内容 | Surface、Tabs、Input、Select |
| 个人中心/充值 | Dialog 或设置主区 | Modal、Button、表单 |
| 管理后台 | 高密度侧栏 + 表格/筛选/统计 | Surface、Tabs、Dropdown |
| 移动工作区 | 安全区 Header + Feed + Composer + Bottom Nav | Sheet、Composer、Tabs |

## 9. 响应式验收矩阵

| 视口 | 必验项 |
|---:|---|
| 1280×720 | 48px 顶栏；262px 面板；570px Composer；三段切换视觉居中 |
| 1024×768 | 桌面布局不重叠；菜单和 Composer 不越界 |
| 768×1024 | 进入移动规则；Panel 转 Drawer；设置使用移动 Shell |
| 430×932 | 所有主操作完整；底部输入避开安全区 |
| 390×844 | 无横向滚动；Tab、输入、Sheet 无裁切 |
| 375×812 | 最窄文字不撞图标；触控目标至少 44px |

## 10. 实现守卫

- 新组件在 `packages/ui/src/web/` 创建并从 `@kk/ui` 导出。
- 业务页面不得复制 `KkSurface`、`KkTabs`、Composer、Sheet、Tooltip 的实现。
- 图标统一使用项目现有的 Lucide 线性图标。
- 不新增生产依赖。
- 不改变服务端、数据库、计费、鉴权或 Agent ToolRegistry。
- `morphic-ui.css` 必须在旧样式之后加载，作为迁移期统一适配层。
- 后续逐步删除业务组件的兼容 Frost/Clay 变量；不得新增使用。

## 11. 测试与 QA

每次改动至少执行：

1. 对应失败测试，再实现。
2. `morphic-ui-system-contract.test.ts`。
3. `morphic-surface-migration.test.ts`。
4. 受影响的 Workspace、移动端、设置、认证或管理后台测试。
5. `architecture:check`、`governance:check`、`typecheck`、`build`。
6. 1280、768、430、390、375px 浏览器截图。
7. 参考图和实现图同屏比较，记录到根目录 `design-qa.md`。

视觉 QA 的 P0/P1/P2 必须全部清零，文档结尾必须为 `final result: passed` 才能交付。

## 12. 精确输入与 Composer 几何

### 12.1 Canvas Composer

- 桌面外壳固定最大宽度 570px；标准空输入状态高度 127px，距底部 10px，圆角 20px。
- 编辑区标准高度 24px，字号 14px、行高 21px；内容增长后只在既有上限内扩展。
- 引用行和操作按钮高度 30px；模式切换轨道与提示词工具轨道高度 32px，轨内按钮高度 30px。
- Footer 标准高度 32px。不得通过额外边框、阴影或大圆角制造第二套 Composer 外观。

### 12.2 Copilot Composer 与会话栏

- 桌面 Composer 在工作区内最大可用宽度为 968px，标准空输入状态高度 94px。
- 编辑区标准高度 42px，字号 14px、行高 17.5px；底部操作目标高度 30px。
- 会话栏宽度 262px；顶部操作区高度 44px，上下文摘要高度 32px。
- 欢迎消息使用透明、无气泡的平面内容结构；不增加独立头像装饰或无业务支撑的入口。

### 12.3 认证输入

- 认证 Dialog 在 1280 × 720 视口下为 412 × 546px，并受 `90vh` 上限约束。
- 输入框外壳高度 38px，左右内边距 10px，字号 16px、行高 22px。
- 登录、注册、Google、微信、临时登录及密码流程继续复用既有回调和鉴权契约。

### 12.4 移动输入

- Composer 宽度为 `calc(100vw - 16px)`，左侧 8px，底部为
  `calc(env(safe-area-inset-bottom) + 8px)`。
- 输入框和所有可见交互目标最小高度 44px。
- 375、390、430、768px 视口必须满足 `scrollWidth === innerWidth`，不得横向溢出、
  裁切主操作或遮挡输入框。

这些尺寸只约束视觉和交互密度。Canvas 模式、Copilot 模式、Provider、提示词优化、上传及生成
能力仍使用 KK Studio 的现有业务实现，不因参考设计而改写产品内容或新增无业务支撑的能力。

## 13. 布局精确收口补充

- 桌面 Canvas 左面板默认常驻：`x=12px`、`top=48px`、`bottom=10px`、`width=262px`。桌面不使用 Modal Backdrop，也不自动关闭；移动端仍使用 Drawer/Sheet 与遮罩。
- Canvas Composer 标准态固定为 `570×127px`、距底 `10px`；其业务模式数量可以多于参考站，但不得改变外壳几何。
- Canvas 导航默认折叠为右下角 `156×32px` 胶囊，`right=12px`、`bottom=10px`；展开后才显示完整小地图。
- Canvas 与创作模式不显示独立的 AI 侧栏拉手，统一通过顶部三段式切换进入 Copilot，避免重复入口破坏舞台边缘。
- Copilot 左栏固定 `262px`；顶部操作区为 `46px`，搜索/历史控制区为 `28px`。全屏 Copilot 隐藏上下文摘要行和多余快捷操作，但不删除其在其它助手 Surface 中的业务能力。
- Copilot Composer 标准态为 `968×94px`，位于 `x=294px`、`bottom=10px`（1280×720 基准视口）。
- 顶栏左侧顺序为品牌、全局搜索、工作区/项目上下文；AI 入口不与中央 Copilot 切换重复。
- 同视口视觉验收必须把本地截图放在左侧、参考截图放在右侧，组合成单张比较图后再判断差异。

## 14. 工作流浏览器精确规范

- 桌面工作流浏览器距视口顶部和底部各 `12px`，最大宽度 `820px`，高度为
  `calc(100dvh - 24px)`；使用共享 Dialog 遮罩、14px 圆角和低强度浮层阴影。
- Header 必须包含 `工作流 / 工具` 两段式 Tab、36px 搜索框和直接可见的关闭按钮。
- 工作流模式先显示紧凑分类胶囊，再使用三列卡片网格；卡片保持平面 Panel/Control 层级，
  不使用大面积渐变、发光描边或装饰性缩放动效。
- 工具模式使用两列紧凑网格，只展示现有业务入口；工作流模板同样只来自现有模板配置。
- 搜索、分类、Tab、模板应用、关闭、Backdrop 和键盘行为必须保留现有回调与可访问语义。
- `max-width: 768px` 时转换为底部 Sheet：宽度 100%、单列卡片、顶部圆角，并叠加
  `env(safe-area-inset-bottom)`；不得保留桌面固定宽度或造成横向溢出。
- 禁止为了接近参考站而复制专有图片、名称或新增没有 KK Studio 业务支撑的时间线、模板和工具。
