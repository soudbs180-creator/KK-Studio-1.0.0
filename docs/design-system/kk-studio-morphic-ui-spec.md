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
┌──────────────────────────── 48px Top bar ─────────────────────────────┐
│ 项目 1                         画布              Avatar/Credits/设置 │
├──────┬───────────────┬───────────────────────────────────────────────┤
│ Rail │ Project panel │                    Canvas                     │
│ 38px │ 262px         │                                               │
│ x=12 │ x=50          │                570px Composer                 │
└──────┴───────────────┴───────────────────────────────────────────────┘
```

- 顶栏固定 48px，采用“项目 / 画布 / 账户”三列结构；“画布”严格按视口居中。
- Canvas 不因面板出现而改变坐标系；浮动面板覆盖在舞台上。
- 左侧一级轨道距左 12px、垂直居中；项目面板从轨道右侧 `x=50px` 展开，宽 262px。
- Composer 水平居中，底部 10px，最大宽 570px。
- 打开 Copilot 时复用现有 Chat/Agent Runtime，在右侧显示 420px Companion Panel，不跳转页面、不创建平行助手。

### 5.2 移动

- 顶栏高度为 `env(safe-area-inset-top) + 48px`。
- Composer 左右 8px，底部 `env(safe-area-inset-bottom) + 8px`。
- 抽屉宽度 `min(88vw, 320px)`。
- 工作流、设置、资产和复杂选择器优先使用 `KkSheet`。
- 手机默认是轻量结果流，不显示或预留常驻四按钮底栏；账户与次级能力从顶部菜单、结果卡或上下文操作进入。
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
| Canvas | Top bar + 左侧 Rail/Panel + Canvas + Composer | Surface、Composer、Canvas Navigation |
| Copilot | Canvas + 右侧 420px Companion Panel + 对话区 + 内部 Composer | Surface、Sheet、Composer |
| 创作 | Top bar + 资产 Panel + 生成工作区 | Surface、Tabs、Dropdown |
| 资产/收藏/历史 | 262px Panel + Tabs + 列表 | Surface、Tabs、Tooltip |
| 工作流/工具 | Dialog/Sheet + 搜索 + 分类 + 网格 | Modal、Sheet、Input、Tabs |
| 设置 | 左导航 + 主内容 | Surface、Tabs、Input、Select |
| 个人中心/充值 | Dialog 或设置主区 | Modal、Button、表单 |
| 管理后台 | 高密度侧栏 + 表格/筛选/统计 | Surface、Tabs、Dropdown |
| 移动工作区 | 安全区 Header + 结果 Feed + 任务状态 + Composer | Sheet、Composer、Result Card |

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

- 桌面外壳固定最大宽度 570px；标准空输入状态高度 94px，距底部 10px，圆角 20px。
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

## 16. Canvas V3 双参考融合规范

Canvas V3 的产品外壳继续遵循 Morphic 的黑色舞台、弱边界、紧凑按钮和内容留白；节点卡片、连线与触控交互吸收 Tapnow 的节点化工作流思路。KK Studio 的 Prompt、Image、Workflow、Agent、Provider、计费与持久化对象仍是唯一业务事实，不复制参考产品的名称、素材或不存在的能力。

### 16.1 展示适配层

- `CanvasCardViewModel`、`CanvasCardAction`、`CanvasCardStatus`、`CanvasPortViewModel` 与 `CanvasEdgeViewModel` 只负责展示。
- 旧项目加载后直接由 Adapter 转换，不迁移数据库，不修改 Canvas DTO。
- Prompt 与 Image 业务实体是主卡来源；Workflow 图中的镜像 `prompt` / `image` 节点不得重复渲染。
- 卡片宽度只允许 `280 / 320 / 420px`，Header 与 Footer 均为 `36px`，圆角为 `14px`。
- Body 使用内容高度；禁止通过固定 176/200/420px 高度制造空白。
- 缩放细节等级统一为 `full → compact → thumbnail-shell`。

### 16.2 卡片语义

| 卡片 | Body | Footer |
|---|---|---|
| Prompt / Text | 提示词摘要、模式和运行反馈 | 模型、规格、消耗 |
| Image / Video / Audio | 主媒体、Poster 或波形 | 模型、尺寸、时长 |
| PPT / Storyboard | 封面、页数或镜头完成度 | 版本、页数、状态 |
| Ecommerce | 商品任务摘要与当前阶段 | 输出数、规格、消耗 |
| Agent / Workflow | 目标、步骤摘要和错误 | 类型、状态、输出 |
| Preview / Save | 来源摘要、格式和目标 | 来源数、状态、数量 |
| Pending / Error | 骨架或可操作错误原因 | 取消、重试或详情 |

Hover 只改变边界。Selected 使用主操作色边界和低透明外环，不改变尺寸和位置。Dragging 禁止位置过渡；落位后才允许 `160ms` 以内的轻微位置收口。

- 已提交卡片位置只允许一个布局坐标源；桌面统一由 `left/top` 表达，实时 `transform` 只用于其它卡片的相对跟随，不得与绝对位置叠加。
- 拖拽从 Pointer Down 到 Commit 必须冻结同一套 `renderOrigin / zoomScale`；实时位置清理使用 `null`，禁止用 `{ x: 0, y: 0 }` 伪造清理事件。
- 松手后的首个提交帧与稳定帧位置误差不得超过 1px；卡片不得因 Selected、LOD、分组边界或位置持久化重新归一化而跳动。

### 16.3 连线与端口

- 默认连线为白色 18% 的 1px 实线三次贝塞尔曲线；选中为 1.5px 主操作蓝色。
- Canvas2D 绘制常规边，SVG Overlay 只承载选中、运行和交互状态。
- 连线使用圆角端点；SVG 状态使用 `vector-effect="non-scaling-stroke"`。
- 运行状态仍为实线，可选单个柔和高亮点；Reduced Motion 下关闭。
- 端口视觉直径 6px；鼠标命中区 20px；触控命中区 44px。
- 业务 Renderer 不得自行设置虚线、颜色、线宽或另建边几何算法。

### 16.4 卡片工具栏避让

桌面选择工具栏统一调用 `resolveCanvasV3ToolbarPlacement`，顺序为：

1. 卡片右侧居中；
2. 卡片右上；
3. 卡片右下；
4. 卡片左侧；
5. 在视口内钳制。

每个候选都必须检测未选中 Prompt、Image 与 Workflow 卡片。右侧存在相邻卡片时，候选先沿水平方向越过阻挡卡片，再验证视口；不得覆盖卡片内容。移动端不使用悬浮侧工具栏，统一转为安全区上方的 Bottom Sheet Inspector。

## 17. 移动工作区与兼容 Canvas V3

### 17.1 信息架构

- 手机工作区不显示常驻四按钮导航，也不为旧底栏保留高度。
- 默认只挂载轻量结果流、任务状态和必要 Composer；账户通过顶部头像进入。
- `library / chat / me / canvas` 等旧状态继续兼容读取，但不得据此重新挂载可见的持久底栏。
- 完整触控 Canvas 作为兼容能力保留，只能由明确的上下文入口按需挂载，不得成为手机默认 DOM 负担。

### 17.2 触控与布局

- 创作默认使用结果优先流；需要完整画布时在同一 Workspace 内按需切换，不新增生产路由。
- 画布空白区域单指平移，卡片单指拖动并在释放时写回现有位置 API。
- 移动画布在同一画布挂载周期内保持固定场景原点；节点写回后不得重新按最小坐标归一化整个场景。
- 双指围绕触点中点同时缩放和平移；变换由 `requestAnimationFrame` 合并。
- 卡片轻触选中；检查器显示在 Bottom Navigation 上方，二者间不得重叠。
- 连接必须先进入显式连接模式，再轻触目标卡片。
- Composer 默认折叠为“输入提示词”按钮；展开后位于安全区上方，不得被任务状态或 Inspector 遮挡。
- 手机默认以 `0.72` 可读缩放聚焦首个 Prompt；平板默认以 `1.0` 展示完整卡片；“适应画布”允许进入低缩放概览。
- 任务中心折叠入口固定在顶部 Chrome 下方，不得覆盖 Composer、Inspector 或 Bottom Navigation。

### 17.3 响应式验收

| 视口 | 必须满足 |
|---:|---|
| 375×812 | 结果卡和任务状态完整可见；Composer 与安全区至少保留 8px |
| 390×844 | Inspector 与 Composer 不重叠；全部触控目标至少 44px |
| 430×932 | 无横向页面溢出；安全区和主要文案完整 |
| 768×1024 | 使用轻量结果流；完整触控画布仅按需挂载 |
| 834×1112 | 使用平板结果流；进入兼容画布后使用 1.0 卡片档 |

所有视口必须满足 `scrollWidth <= innerWidth`。画布世界可平移超出屏幕，但页面自身不得产生横向滚动条。

## 18. 当前唯一实现来源

- 几何与 Token：`packages/ui/src/core/layout.ts`、`packages/ui/src/core/tokens.ts`
- Canvas V3 类型、Adapter、卡片、边：`apps/web/src/canvas/v3/`
- 桌面选择工具栏碰撞：`apps/web/src/app/useSelectionMenuOverlay.ts`
- 移动触控画布：`apps/web/src/components/mobile/MobileCanvasV3Surface.tsx`
- 移动主导航：`apps/web/src/components/mobile/MobileTabBar.tsx`
- Web 视觉适配：`apps/web/src/styles/morphic-ui.css`、`apps/web/src/styles/canvas-v3.css`

后续功能卡片必须先扩展 ViewModel / Adapter，再进入共享卡片渲染器；不得恢复旧 Frost/Clay 卡片、虚线 Edge Renderer 或平行移动画布。

## 13. 布局精确收口补充

- 桌面 Canvas 左面板默认常驻：`x=12px`、`top=48px`、`bottom=10px`、`width=262px`。桌面不使用 Modal Backdrop，也不自动关闭；移动端仍使用 Drawer/Sheet 与遮罩。
- Canvas Composer 标准态固定为 `570×94px`、距底 `10px`；其业务模式数量可以多于参考站，但不得改变外壳几何。
- Canvas 导航默认折叠为右下角 `156×32px` 胶囊，`right=10px`、`bottom=10px`；展开后保持同一底边与右边锚点，只允许面板向上生长。
- Composer 展开 Copilot 后，Canvas 导航整体使用 `right=chatSidebarWidth+10px` 向左避让；小地图、缩放与画布视图操作不得分开移动或被隐藏。
- Canvas 不显示独立的 AI 侧栏拉手；Copilot 的唯一工作区入口位于 Composer 发送键右侧，并处于 Composer 外框内部。
- Copilot 作为右侧 420px Companion Panel 展开，保持 Canvas 可见；面板使用 `top=48px`、`right=10px`、`bottom=10px`。
- Companion Panel 内的聊天记录与 Composer 必须复用现有 Assistant Runtime；关闭时恢复中央 Composer，不导航到其它页面。
- 顶栏左侧只显示项目上下文；AI 入口不与 Composer 内的 Copilot 开关重复。
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

## 15. 布局避让、内容密度与动效收口

### 15.1 容器高度模型

- `Layers / Assets / Copilot` 属于主导航面板，桌面端保持 `top=48px`、`bottom=10px`、`width=262px` 的满高结构。
- 项目选择器、快捷设置、上下文菜单属于 Utility Panel，必须使用 `height: max-content`，上限为
  `calc(100dvh - 58px)`；列表达到上限后仅列表区滚动。
- 空状态不得用固定最小高度撑大 Utility Panel。主导航面板即使内容为空仍可保持满高，但空状态卡本身只按内容收高。
- Modal、Sheet 和工作流浏览器可以使用视口约束高度；普通卡片、提示条和工具条禁止借用 Modal 几何。

### 15.2 工具栏碰撞避让

- 画布选择工具条默认锚定选区右侧，间距 `12px`。
- 右侧存在相邻卡片时，工具条保持右侧锚点并优先上移到选区右上方；上方空间不足时回退到选区左侧。
- 计算候选位置时必须同时检查视口边缘、未选中 Prompt/Image/Workflow 卡片，以及已打开的左侧面板和竖向工具栏。
- 桌面工具条不得覆盖选中卡片或邻卡，不得产生横向页面滚动；标签最大宽度 `112px`，超出使用省略号。
- 移动端工具条固定在底部安全区上方，左右各 `8px`，横向内容可在工具条内部滚动，所有操作目标至少 `44px`。
- 项目面板打开时，竖向工具栏从 `x=12px` 移动到面板右侧 `x=282px`，不得隐藏或被面板遮挡。

### 15.3 文字、卡片与留白

- 面板外边距使用 `12px`；卡片内部主间距使用 `12px`，紧凑控制组使用 `8px`，图标与短标签使用 `6px`。
- 标题、描述、计数和操作按钮必须处于独立布局槽位。禁止用绝对定位让文字压到图标、徽标、关闭按钮或高亮背景上。
- 单行上下文使用 `text-overflow: ellipsis`；正文默认允许自然换行，窄面板描述使用 `12px / 18px` 行高。
- Selected/Focus 只改变背景、边界或 Focus Ring，不改变元素尺寸。Composer 内部输入获得焦点时不再生成第二层蓝色矩形框，由 Composer 外壳承担焦点边界。
- 卡片之间至少保留 `8px`，面板与浮动工具之间至少保留 `8px`，画布卡片与上下文工具条至少保留 `12px`。

### 15.4 Surface 去重

- 桌面顶栏只允许三个区域：左侧当前项目、中间唯一 `画布` 状态、右侧账户区；不得再把
  `Copilot / 创作` 作为并列顶部模式。
- 右侧账户区依次承载头像与个人中心、积分与充值、设置三个紧凑入口；设置必须直接可见，
  不再藏进头像下拉菜单。
- `Copilot` 由 Composer 发送键右侧的展开入口控制。展开后隐藏中央 Composer，复用现有
  Chat/Agent Runtime 在右侧展示聊天记录和输入框；收起后恢复画布与中央 Composer。
- 资产、历史、收藏继续复用既有 Surface 和业务入口，不为顶部导航建立重复入口。
- 未激活的 Chat、资产、收藏面板必须 `aria-hidden`、`inert` 且禁止指针事件；Chat 关闭时不保留重复的可交互 DOM 子树。

### 15.5 动效

- 控件状态使用 `125ms`，快速透明度使用 `100ms`，面板位移使用 `160ms`。
- 标准缓动统一为 `cubic-bezier(0.4, 0, 0.2, 1)`，与参考站实测的 `100–150ms` 控件反馈保持一致。
- 仅允许颜色、边界、透明度和不超过 `4px` 的必要位移；禁止 `scale` 点击回弹、`280ms` 通用过渡和持续发光。
- 布局避让只过渡 `left / top / opacity`，不得使用 `transition: all`。

### 15.6 响应式验收

- 桌面 `1024px` 边界下，Composer 左侧必须避开已展开项目面板和竖向工具栏，且保持标准 `570×94px`。
- `768×1024`、`430×932`、`390×844`、`375×812` 必须同时满足：
  `scrollWidth <= innerWidth + 1`、无 Chrome/Composer 重叠、主操作完整、结果流与安全区不冲突。
- 每次修改布局避让规则后必须运行 `scripts/test/verify-canvas-responsive-cdp.mjs` 并保留同视口截图。

## 19. 左侧项目轨道停靠规则

- 桌面竖向项目轨道是 Canvas 最左侧的一级入口，固定为
  `x=12px`、`top=50%`、`transform: translateY(-50%)`、`width=38px`；必须保持视口垂直居中，
  且不得因项目面板展开而横向移动。
- 项目面板从轨道右侧展开，固定为 `x=50px`、`top=48px`、`width=262px`；
  轨道与面板之间保持 `8px` 间距。
- 面板收起时轨道位置保持不变；重新展开只显示内容面板，不得让一级入口跳位。
- 该规则覆盖 15.2 中“面板打开时将工具栏移动到 `x=282px`”的旧避让规则。
- Canvas 卡片坐标系不随轨道或项目面板开关改变；卡片、Composer 和选择工具条仍须避开
  轨道与已展开面板的实际边界。

## 20. Composer 配置控件规则

- 模型、生成参数和生成张数必须使用同一 `kk-composer-config-control` 视觉契约：桌面高度 30px、
  8px 圆角、12px 中等字重、弱边界和 125ms 状态过渡；移动端统一提升为 44px 触控目标。
- 模型选择宽度为 `112–164px`，生成参数宽度为 `118–150px`，张数选择宽度为 74px；
  文字过长时只允许单行省略，不得挤压发送按钮或覆盖输入区。
- 控件只通过文字颜色、背景、边界和 Chevron 方向表达 Hover、Expanded、Selected 状态，
  不得缩放、弹跳、增加厚重阴影或生成第二层输入框。
- 张数弹层标准宽度 176px，使用 14px 面板圆角、8px 内边距和四列紧凑网格；
  每项高度 36px，当前值采用低透明主色背景和边界，不使用大面积纯白高亮。
- 生成参数使用 Dialog 语义，模型和张数使用 Listbox 语义；Trigger 必须同步暴露
  `aria-expanded`，选项必须暴露 `aria-selected`。

## 21. 按钮内容几何与对齐规则

- 唯一按钮内容适配层为 `apps/web/src/styles/morphic-button-geometry.css`，加载顺序必须位于
  `morphic-ui.css` 之后；业务组件不得为相同角色再次声明一套图标盒、Gap 或内边距。
- 桌面独立图标按钮为 `30×30px`，图标盒为 `16×16px`，四边留白均为 7px；移动端提升为
  `44×44px` 触控目标，视觉图标仍保持 16–18px。
- 紧凑组合工具栏使用 32px 外壳、2px 内边距和 `26×26px` 内部图标按钮；不得把内部按钮
  强行放大到 30px 后溢出外壳。
- 普通功能按钮使用 `kk-morphic-function-button`：内容整体水平和垂直居中、图标与文案间距
  6px、左右内边距 12px、单行文字 `line-height: 1`；移动端最小高度 44px、左右内边距 14px。
- Composer 的创作类型、工作流、工具、参考、模型、参数和张数控件必须让图标、文案与 Chevron
  共享同一垂直中心；发送按钮的文案盒与图标盒不得超过 30px 外框。
- 列表行和导航行保持左对齐，但必须使用对称的上下内边距、对称的左右内边距和稳定图标槽；
  “普通功能按钮居中”不得误用于项目列表、设置导航或层级菜单。
- 手机顶部个人信息、积分和菜单按钮必须使用对称 `padding-block: 0`，内容中心与 48px 外框中心
  偏差不得超过 1px；安全区只由 Header 外层承担，不得通过模糊的 `[class*="mobile-header"]`
  规则把安全区 Padding 施加到内部按钮。

## 22. Workspace 与 Settings V3 信息架构

### 22.1 五级文字

| 层级 | Token | 大小 | 使用范围 |
|---|---|---:|---|
| Display | `typography.display` / `--kk-type-display` | 24px | 页面主标题、设置页一级标题 |
| Title | `typography.title` / `--kk-type-title` | 16px | 卡片标题、模块标题、弹层标题 |
| Body | `typography.body` / `--kk-type-body` | 14px | 正文、设置项内容、结果说明 |
| Button | `typography.button` / `--kk-type-button` | 12px | 按钮、Tab、模式、工作流、工具、模型与参数 |
| Caption | `typography.caption` / `--kk-type-caption` | 11px | 状态、元数据、解释说明 |

- 同一层级必须使用相同字号与行高，禁止根据容器临时缩小文字来解决拥挤。
- `选择模式 / 工作流 / 工具` 与 Composer 当前模式统一使用 Button 层级；内容放不下时优先省略、
  收纳或增加容器宽度，不得降级为 Caption。
- 字重只表达信息强度：标题 600、按钮和重点 500–600、正文与说明 400；禁止通过随意增大字号强调状态。

### 22.2 三级图标

| 层级 | Token | 大小 | 使用范围 |
|---|---|---:|---|
| Feature | `icon.feature` / `--kk-icon-feature` | 20px | 功能模块入口、设置页一级功能 |
| Button | `icon.button` / `--kk-icon-button` | 16px | 顶栏、工具栏、普通按钮 |
| Assist | `icon.assist` / `--kk-icon-assist` | 13px | Chevron、状态、元数据与辅助提示 |

- 图标层级由功能语义决定，不得在同一按钮组混用 13/16/20px。
- 图标视觉尺寸与命中区分离；手机触控目标仍为 44px，图标不得跟随扩大。

### 22.3 语义色

- `content`：信息容器背景；`accent`：主操作与 Selected；`support`：进行中与信息提示；
  `success`：完成；`warning`：需注意；`danger`：失败和危险确认。
- 页面背景、内容区和控件区必须具有可辨识的明度层级，不允许容器与页面使用完全相同的背景后
  只靠文字区分。
- 状态色只用于状态、焦点和主操作，不得作为大面积装饰背景；Selected 不得改变组件几何。

### 22.4 桌面 Workspace

- 顶栏为 `项目 / 画布 / 账户` 三列网格：项目靠左、画布严格按视口居中、账户靠右。
- 项目名默认显示 `项目 1`，实际项目存在时显示当前项目名；项目名订阅必须隔离，不得让整个顶栏
  跟随 Canvas 节点位置高频重绘。
- 左侧 38px 轨道只容纳项目、搜索、收藏、正常画布模式、画板模式、点阵开关和主题切换。
  适应全部、重置视图和自动整理归属于右下 Canvas 导航，不得在左右两侧重复出现。
- 正常画布模式使用多功能指针图标；画板模式使用画笔图标；点阵开关只控制背景网格显示，
  三者必须是独立按钮和独立状态。
- 右下 Canvas 导航只有一个定位来源：收起态显示地图与缩放胶囊；展开态在同一锚点显示小地图，
  并在地图内容区集中展示适应全部、重置视图和自动整理。展开/收起不得跳回右上角。
- Composer 的 AI 展开按钮位于发送键右侧，间距 7px；展开/收起使用 160ms 的位置与透明度过渡，
  不使用缩放或弹跳。

### 22.5 手机结果流

- 手机不显示固定底部四按钮导航，也不为其保留高度；主要操作通过顶部菜单、结果卡和 Composer 完成。
- 生成任务状态固定在结果区等待位置，单一紧凑 Surface 同时展示结果图片总数、完成数、
  等待/失败状态和进度条。
- 375/390px 可隐藏次要的“完成数”文字，但图片数与任务状态必须保持可见；不得横向溢出或挤压
  标准/详细视图按钮。
- 手机默认只展示结果流，不挂载完整触控画布 DOM；保留既有移动画布组件作为兼容能力，但不得
  通过持久底栏重复暴露。

### 22.6 Settings V3

- 桌面设置使用 248px 侧栏、76px 顶栏、最大 1160px 内容列；页面段落间距 24px、卡片内边距
  20px、控件组间距 12px。
- 设置卡片必须按“标题与说明 / 内容 / 操作”分区；相邻设置行至少保留 12px 上下间距，
  不得让 Label、说明、Input 和按钮贴边。
- 手机设置为全高页面，左右内边距 14px；设置入口最小高度 72px，卡片内边距 16px，
  表单与双列设置行统一收敛为单列。
- 桌面和手机共用同一 Token、语义色、文字层级和组件状态；禁止在移动端另建旧 Frost/Clay 外观。

### 22.7 强制回归

- `scripts/test/verify-canvas-responsive-cdp.mjs` 必须覆盖 1440–1023px 桌面/横屏画布与
  834/768/430/390/375px 结果流，验证无横向溢出、三段 Chrome 完整、38px 左轨道和手机无底栏。
- 浏览器回归必须点击 Composer AI 展开键，并验证中央 Composer 隐藏、右侧聊天记录和输入框可见、
  收起后恢复 Canvas。
- 设置页必须同时运行桌面和手机 Smoke，并保留 Overview、Model Center、直接路由与工作区弹层截图。

## 23. Canvas 卡片、排列与 Companion Copilot V4

本节是 Canvas 卡片呈现、排列方向、Composer 二级控件和右侧 Copilot 的当前唯一规范；与前文历史
描述冲突时以本节为准。

### 23.1 卡片目录

`apps/web/src/canvas/v3/cardCatalog.ts` 是持久化卡片类型到 UI 家族的唯一目录。所有卡片共享
`CanvasCardShell` 的 Header、Body、Footer、状态与留白，不得在 Renderer 内重建平行外壳。

| 持久化 Kind | UI 家族 | 默认尺寸 | 主内容 | Footer |
|---|---|---:|---|---|
| `prompt-result-group` | Prompt 与结果组 | 320px | 提示词、生成状态、关联结果 | 模型、模式、结果数 |
| `prompt-only` | Prompt | 320px | 提示词摘要与运行反馈 | 模型、规格、消耗 |
| `media-only` | Image / Video | 280px | 主媒体或 Poster | 模型、尺寸、时长 |
| `ecommerce` | Ecommerce | 420px | 商品任务与当前阶段 | 输出数、规格、状态 |
| `ppt-deck` | PPT / Storyboard | 420px | 封面、页数或镜头完成度 | 版本、页数、状态 |
| `audio` | Audio / Music | 320px | 波形、时长、风格 | 模型、时长、状态 |
| `text` | Text | 320px | 正文摘要 | 字数、来源、状态 |
| `notebook` | Notebook | 320px | 笔记与上下文 | 修改时间、来源 |
| `multi-image` | Multi Image | 420px | 多图引用与顺序 | 图片数、规格、状态 |
| `workflow-panel` | Workflow / Agent | 420px | 目标、步骤与执行状态 | 类型、输出、状态 |
| 未识别 Kind | Unknown | 320px | 可诊断的降级说明 | 原始类型、状态 |

- Pending、Running、Success、Error 是卡片状态，不是另一套卡片外观；状态变化不得改变卡片宽度、
  圆角、Header/Footer 几何或主内容槽位。
- 普通项目在画布缩放时保持固定卡片 DOM 与视觉密度，不因 Pan/Zoom 临时切换 Skeleton、
  Thumbnail 或另一套样式；只有 large/huge 场景可以按性能档进入既定 LOD。
- Hover、Selected、Dragging、Canvas Transforming 只改变边界、Focus Ring、光标或必要透明度，
  不得替换卡片内容、重新测量固定槽位或触发位置归一化。

### 23.2 两种排列模式与端口

| 排列模式 | UI 命名 | 主方向 | 父卡端口 | 子卡端口 | 适用场景 |
|---|---|---|---|---|---|
| `row` | 思维导图 | 向右 | 右侧 | 左侧 | 主题分支、知识结构、横向工作流 |
| `column` | 瀑布式 | 向下 | 底部 | 顶部 | 生成步骤、任务阶段、纵向结果链 |
| `grid` | 网格整理 | 行列自适应 | 保留当前语义 | 保留当前语义 | 无父子关系的批量整理 |

- 选择菜单和 Composer“工具”菜单必须使用同一 `onArrangeCanvas` 业务回调，不维护第二套排列状态。
- 右键卡片或框选后的上下文菜单提供“思维导图 / 瀑布式”；Composer 工具菜单提供相同入口，
  便于在未选中和已选中场景使用。
- 排列完成后，`CanvasEdgeLayer` 根据排列模式选择对应端口；实线贝塞尔曲线、命中区和选中状态
  继续使用共享 Edge 契约。
- 排列只写回现有卡片位置，不修改父子关系、Canvas DTO、生成链路或持久化格式。

### 23.3 Composer 内部控件

- 创作类型、工作流、工具、模型、参数、张数、业务开关、发送和 Copilot 展开都必须位于
  Composer 外框内部；禁止把发送或展开按钮悬挂在外框之外。
- 模型、参数、张数与开关统一使用 `kk-composer-config-control`：30px 桌面高度、8px 圆角、
  12px Button 字级、16px Button 图标、13px Assist Chevron、6px 内容间距。
- 二级菜单统一使用 Panel 背景、14px 圆角、8px 内边距、弱边界和内容自适应高度；不得混入旧
  Frost/Clay、装饰渐变、厚阴影或任意缩放动效。
- 发送键为稳定的 `30×30px` 圆形主操作，Disabled、Ready 与 Sending 状态保持相同几何。
- Copilot 展开键位于发送键右侧、间距 7px；点击只切换右侧 Companion Panel，不触发路由变化。
- 工作流触发必须同时支持已挂载订阅与挂载前短暂请求；打开后继续使用现有搜索、分类、模板和
  关闭回调，不改变工作流业务逻辑。

### 23.4 右侧 Companion Copilot

- 桌面面板固定为 `width=420px`、`top=48px`、`right=10px`、`bottom=10px`、`radius=14px`。
- 面板内从上到下只有 Header、可滚动聊天记录、Composer 三个主槽位；空内容不得撑出额外卡片。
- 面板展开时中央 Composer 隐藏，Canvas 保持可见；右下地图、缩放和画布操作整体移动到
  `right=430px`，不得被面板覆盖。
- 面板关闭后 Canvas 导航回到 `right=10px`，中央 Composer 恢复；切换过程中卡片坐标、缩放和
  选择状态保持不变。
- 项目面板位于 `x=50px`、`top=52px`，与 48px 顶栏保持 4px 间隙，并与 38px 左轨道保留
  8px 水平间隙。

### 23.5 验收

- 浏览器回归必须验证：展开键在 Composer 内、Companion Panel 为 420px、Canvas 仍可见、
  中央 Composer 隐藏、右下导航从 10px 移到 430px、关闭后全部恢复。
- 工作流回归必须从 Composer 点击打开，验证搜索框、分类、模板和关闭。
- 卡片拖动回归必须记录 Pointer Up、稳定帧与视图变换后的坐标；任一卡片漂移不得超过 1px。
- 1440/1280/1180/1024/1023px 桌面与 834/768/430/390/375px 手机均不得产生页面横向溢出。

## 24. Settings 与移动 Composer 精修规则

本节是设置工作台、个人中心、能力来源和移动结果流的当前唯一补充规范；与旧版 Frost/Clay
描述冲突时以本节为准。

### 24.1 移动 Composer

- 收起态只显示位于视口中心的 64×44px 拖动条热区；外围停靠区透明且不响应点击。
- 展开态按“提示词输入 / 创作类型 / 模型、参数与发送”三层排列。输入层必须位于面板顶部，
  文本框、参考图与语音按钮共享同一 14px 控制面。
- 语音输入在桌面为 30×30px，在手机为 44×44px；监听状态只改变颜色和图标，不改变几何。
- 手机模型、参数、高级设置和发送按钮统一为 44px 高；比例选项使用四列 44px 网格和 7px
  圆角，不使用横向滚动、嵌套卡片或旧 Clay 高亮。
- 生成任务状态与相邻结果视图按钮统一为 44px 高，只保留一处任务入口；状态区同时显示结果
  数量与任务状态，不再挂载右上角重复任务按钮。

### 24.2 设置页信息架构

- 手机设置首页就是总览，不再把“总览”作为可点击模块重复展示。首页依次展示产品说明、
  三项判断指标和创作设置、能力配置、自动化、系统维护四组入口。
- 首页顶部标题固定为“系统设置”并居中，不显示返回按钮；进入子页面后标题左对齐并显示返回
  按钮。标题、按钮和网格列使用 160ms 位置与透明度过渡。
- 设置卡片最多保留两层 Surface。模块标题和说明优先放在外层，字段、状态与操作放在内层；
  禁止“页面卡片 / 模块卡片 / 字段卡片 / 预览卡片”四层嵌套。
- 内容少的模块必须按内容收缩。移动模型预设目录默认显示四项并使用两列紧凑卡，隐藏重复的
  协议与 URL 文案；展开后仍沿用相同网格。
- 浏览器助手的功能卡在手机端使用单列 `minmax(0, 1fr)`，不得继承桌面 285px 最小列宽，
  不得产生裁切或伪空白。

### 24.3 共享控件

- 设置工作台所有 Switch 统一为 42×24px、20px 视觉轨道和 18px 圆点；`aria-checked`、
  `data-state` 与视觉状态必须同步。业务页面不得再实现本地开关外观。
- 主按钮、次按钮和字段操作按钮统一消费 `data-settings-button-tone`，桌面最小高 36px、
  手机最小高 44px。单个字段操作左对齐；同组两个及以上操作在同一行等宽或居中排列。
- 单选档位使用紧凑分段控件，不使用三张独立大卡。选中状态不改变按钮尺寸。
- 个人中心 Tab 在手机端固定四等分；用户 ID 整行可点击复制，不再展示独立复制图标按钮。
- Select/Listbox 在手机端进入普通文档流，展开后父卡片必须自动增高；不得使用绝对定位把
  选项裁切在卡片边缘。

### 24.4 响应式验收

- 357/375/390/430/768px 必须满足 `scrollWidth === innerWidth`，所有可见触控目标至少
  44px，文本与容器边缘保持至少 12px 有效留白。
- 1440px 桌面 Composer 保持 570×94px 标准空状态；模型、参数、张数、语音、发送和
  Copilot 控件保持 30px 同高。
- 浏览器验证必须同时检查设置首页、能力来源、AI 接管展开态、浏览器助手、高级性能、
  个人中心和移动 Composer 展开/收起态。

## 25. 移动创作与设置收口规范

本节以 2026-07-31 的手机端逐项标注为最新事实；与 24.1、24.2 中的 Composer 层级、设置顶栏
和个人中心描述冲突时，以本节为准。桌面端复用相同组件状态和视觉 Token，只保留 30px 的高密度
控制尺寸。

### 25.1 Composer 三层结构

- 展开态固定为“参考素材 / 提示词正文 / 操作区”三层。没有参考素材时第一层不预留空高度；
  文本输入与正在操作期间不得自动折叠。
- 操作区从左到右固定为上传、模型、参数、语音、发送。生成数量属于参数面板，不再作为 Footer
  的独立按钮；手机和桌面必须复用 `ComposerGenerationCountField`。
- 参数面板承载当前模型支持的比例、分辨率、时长、生成数量和业务开关；不支持的字段不渲染，
  禁止使用 Disabled 空位维持旧布局。
- 手机操作目标统一为 44px；桌面统一为 30px。发送按钮使用白色圆形 Surface 和向上箭头，
  Ready、Disabled、Sending 只改变颜色和反馈，不改变尺寸。
- 折叠态只有中央指示条响应点击或上滑，外部透明停靠区不得拦截结果流操作。

### 25.2 设置顶栏与总览

- 手机设置顶栏为圆角半透明磨砂 Surface，左右图标按钮不使用独立边框或背景框。
- 设置首页没有返回按钮，标题占用原返回键位置并左对齐；进入二级页面后显示返回按钮，标题移动
  到中间。两种状态使用 160ms 的位置与透明度过渡，关闭按钮始终保留。
- 设置首页总览必须展示真实基础信息：剩余积分、当日消耗、已认证网页账户、可用路由、默认执行
  位置和体验模式。禁止使用“设置项数量 / 功能模块数量”作为主要信息。
- 二级页的 Kicker、标题和说明直接放在页面内容列，不再包入 Hero 卡片；正文从下一层 Surface
  开始，整个页面最多两层容器。

### 25.3 个人中心与状态

- 个人中心只保留“账户资料 / 账单余额 / 安全设置”三个一级入口；不显示“概览”、独立资料编辑
  Tab 或头部充值按钮。
- 账户资料展示用户身份、登录账号和可复制用户 ID；账单余额展示可用积分、累计消耗、金额与
  交易记录；安全设置展示修改密码和双重验证。
- 状态 Badge 使用内容自适应宽度和单行文字，不能被压缩成逐字换行。空交易记录使用紧凑空状态，
  不用固定大高度填满屏幕。

### 25.4 移动全屏 Surface 与任务中心

- Copilot、收藏和“更多”中的复杂模块在手机端使用 `100dvh` 全屏 Surface，结构和业务回调与
  桌面一致；不得把桌面浮动侧栏压缩成窄屏卡片。
- “更多”入口使用单列列表行：16–18px 图标、标题、说明和 Chevron；禁止使用两列大方卡。
- 结果区的生成状态只负责摘要和打开动作。点击后必须通过共享事件打开同一个
  `TaskCenterTray` 居中 Dialog，禁止创建第二套移动任务列表或顶部重复入口。
- 移动 Task Center 宽度不超过 `calc(100vw - 32px)`、最大高度不超过 `72dvh`，包含任务总量、
  执行中、已完成、失败、进度和可用操作；Escape 和关闭按钮均恢复触发点焦点。

### 25.5 电商移动面板

- 顶栏与设置顶栏使用相同圆角、磨砂和安全区几何。
- 灵感库触发器与展开内容属于同一个容器；手机使用三列紧凑选项，文字超长时省略并保留
  可访问标题。
- 构图比例与生成参数使用同一分段选择结构；比例项提供明确 Selected 状态，不使用伪复选框。
- 底部输入、语音和发送三个模块统一为 48px；发送键为白色圆形向上箭头，输入区不得被安全区、
  键盘或其它悬浮入口遮挡。

### 25.6 强制契约

- 旧 `DesktopComposerCountControl` 不再进入生产树；生成数量只能出现在共享参数层。
- `SettingsMobileDashboard` 是手机设置首页唯一总览；治理脚本不得重新要求静态
  `SettingsConsoleMobileHome`。
- 手机结果流、Copilot、收藏、电商和 Task Center 必须在 359×718、375×812、390×844、
  430×932、768×1024 下无页面级横向溢出，所有主操作触控目标至少 44px。

## 26. 逐屏验收后的唯一收口规则

### 26.1 移动 Composer 停靠与状态

- 展开面板固定使用左右各 8px 的视口留白，CSS 定位不得再叠加 `margin-inline`；最终几何为
  `width: calc(100vw - 16px)`。
- 展开期间只允许通过顶部指示条显式收起。草稿输入、语音、参数选择、模型选择和页面空白点击
  均不得触发自动折叠。
- 展开期间隐藏结果区的任务摘要与其它底部竞争控件；收起后恢复任务摘要，避免两个底部操作层
  同时占用安全区。
- 手机发送按钮固定为 44×44px 白色圆形，桌面发送按钮固定为 30×30px；Disabled、Ready 和
  Sending 不改变几何。

### 26.2 移动全屏工具

- Copilot、收藏和电商面板的手机投影必须从 `x=0 / y=0` 覆盖 `100dvw × 100dvh`，只保留一层
  顶栏和一层内容区，不允许在全屏 Surface 内再次嵌套桌面浮动面板外壳。
- Copilot 消息区只对用户消息使用强调 Surface；助手消息保持平面正文。底部 Composer 固定包含
  附件、协作方式和发送三个区域，任何控件组都必须满足 `scrollWidth === clientWidth`。
- 收藏空状态隐藏没有内容的详情列；电商灵感项在三列内使用单行省略，完整名称通过可访问标签保留。

### 26.3 设置工作台标题与内容密度

- 手机设置首页直接展示真实模块路由，不再使用会跳转到错误功能的聚合卡片；二级页切换时必须在
  首次绘制前把内容滚动位置复位到 0。
- 手机二级页说明是无框正文；伪元素装饰渐变必须关闭。空数据区域按内容收缩，推荐高度为
  88–112px，不使用固定大空白撑满卡片。
- 桌面设置 Shell 是页面标题和说明的唯一拥有者。内容区的 `dashboard-console-header` 和
  `settings-hero-flat-header` 在桌面投影中隐藏，禁止形成上下两套重复标题。
- 设置按钮、Switch、Segmented Control、Select、Badge 和空状态必须同时复用共享 Token 与状态
  组件；新增业务页不得通过更高优先级的局部样式恢复旧 Frost/Clay 外观。

### 26.4 浏览器验收证据

- 359×778 必须验证 Composer 展开/收起、Task Center、更多菜单、设置首页与二级页、Copilot、
  收藏、电商和个人中心；1440×900 必须验证工作区、Composer 与设置 Shell。
- 每个视口至少检查页面级横向溢出、可见控件命中区、标题重复、文本截断、容器空白和浮层遮挡。
  截图只作为证据，验收还必须记录关键 DOM 几何与 `scrollWidth/clientWidth`。
