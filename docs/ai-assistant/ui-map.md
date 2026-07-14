# UI 映射表 (UI Map)

本文件维护 KK Studio v1.6.0 各界面入口、面板及其对应的 CSS 选择器或高亮标记，供 AI 助手进行组件聚焦与定位。

---

## 1. 核心面板选择器

| 功能组件 | CSS 选择器 / 标识符 | 描述 |
| :--- | :--- | :--- |
| **API 设置面板** | `.settings-api-management` / `#settings-panel` | 系统设置中的 API 密钥管理面板 |
| **系统日志面板** | `action://open-settings-logs` / `system-logs` | AI 接管与聊天 action 链接可直接打开系统日志维护面板 |
| **个人中心设置页** | `user-profile` / `/settings/user-profile` | 设置页中的个人中心入口，AI 助手通过 `openSettings({ tab: 'user-profile' })` 打开 |
| **设置功能路由** | `dashboard` / `api-management` / `consumption-records` / `storage-settings` / `system-logs` / `user-profile` | AI 助手快速导航的稳定功能 ID；UI 按钮位置变化时仍以这些 ID 调用底层能力 |
| **能力分配卡片** | `[data-testid="settings-workbench-capability"]` / `.settings-capability-card` | API 工作台高级模式的能力路由分配卡片，非 AI 助手卡片不保留不可见占位行 |
| **大卡片输入区** | `.input-bar` / `textarea` | 底部生图与聊天输入框 |
| **项目列表侧边栏** | `.project-manager-sidebar` | 左侧项目与画布切换面板 |
| **协作模式：直接操作** | `#btn-ai-direct-mode` | 保持画布原生点击、拖拽、编辑和普通聊天，不触发 Agent 工具执行 |
| **协作模式：AI 辅助** | `#btn-ai-assist-mode` | 同步当前页面与选区并显示建议；提交后先展示执行预览 |
| **协作模式：AI 接管** | `#btn-ai-takeover-toggle` | 目标进入统一 AgentRuntime；低风险可执行，高风险仍需确认 |
| **AI 辅助上下文建议** | `.ai-context-suggestions` | 显示已同步的页面/选区摘要与可编辑建议；点击建议只填充输入框 |
| **三态聊天输入框** | `#chat-composer-input` / `#ai-assist-composer-input` / `#ai-takeover-composer-input` | 分别标识直接、辅助和接管输入状态；三者仍属于同一聊天侧栏和会话 |
| **资源管理器 Plus 按钮**| `#btn-takeover-plus-button` | 接管模式下的资源连结加号按钮 |
| **AI 助手选项菜单** | `#btn-takeover-menu-container` | Plus 按钮弹出的文件/文件夹导入菜单 |
| **无限画布容器** | `#canvas-container` | 主无限画布 DOM 容器 |
| **缩放控制卡片** | `.desktop-zoom-rail` | 左下角毛玻璃缩放与版本展示面板 |

---

## 2. UI 变更通知原则

当开发人员修改或重构上述 DOM 的 id、class 或相对位置时，**必须**在此文件中同步更新，防止 AI 助手的 `highlightElement` 与聚焦指令失效。

AI 助手默认控制底层功能线路而不是 UI 坐标：打开设置页、提交生成、整理卡片、批量生成等操作应优先调用 ToolRegistry 或 Context API。按钮移动到别的位置时，需要更新本 UI Map 和对应 Skill/Runbook，但不应改变 `ui.openSettings`、`generation.submitComposer` 等工具语义。

## 2.1 三态协作控件规则 - 2026-07-15

- `direct`、`assist`、`takeover` 是互斥的单一状态，控件应以 `radiogroup` / `radio` 或等价的可访问语义暴露当前值；不得恢复两个可同时开启的独立开关。
- 直接操作不是“禁用 AI”：用户仍可普通聊天，同时继续点击、拖拽、框选和编辑画布。
- AI 辅助根据实时 `CanvasRuntimeState.currentPage` 和选区生成建议。点击建议只预填输入，提交后的可执行计划必须先显示预览并等待确认。
- AI 接管使用同一个 AgentRuntime、ToolRegistry、时间线和持久队列；低风险动作可按策略执行，高风险、批量、成本或外部副作用动作继续确认。
- 切换模式不得添加阻断画布的遮罩，也不得清空 `AgentRunStore` 或 `DurableGenerationQueue`。

Current AI selector source of truth for KK Studio v1.6.0.

## 3. Canvas Group Controls - 2026-06-05

| Component | Selector / State | Assistant meaning |
| :--- | :--- | :--- |
| Manual canvas group frame | `.group-container` | Expanded group shell. `group.color` renders as a weak inner glow, defaulting to `#ffffff`; it is not a hard border stroke. |
| Collapsed canvas group strip | `.canvas-group-collapsed-card` | Compact storage strip. `group.collapsed=true` removes member cards from render queues until expanded. |
| Group toolbar eye button | `group.hidden` | Visual hide/blur only. It keeps member nodes rendered and applies a blurred overlay; it must not call the collapse helper. |
| Group toolbar archive button | `group.collapsed` | Collapses the group into a single strip. This is the only toolbar action that hides member nodes from render queues. |
| Group context menu | right-click on group frame | Rename remains in the right-click menu. Glow color selection also lives here; do not add a separate settings button for this. |
| Hidden group title | centered overlay label | When `group.hidden=true`, render the group label in the center of the blurred group. Size is computed from group bounds and zoom, with truncation to avoid overflow. |

Runtime note: hidden groups are raised above their member cards so the blur overlay can visually cover cards. Dragging a group writes member positions into `liveNodePositionByIdRef` before committing `moveSelectedNodesImmediate`, preventing the group frame from moving ahead of its cards.

## 4. Favorites And @ References - 2026-06-05

| Component | Selector / State | Assistant meaning |
| :--- | :--- | :--- |
| Desktop favorites rail button | `[data-testid="project-manager-favorites"]` / `#project-manager-favorites` | Opens the global favorites surface from the left ProjectManager tool rail, directly below search. |
| Mobile favorites entry | `[data-testid="mobile-more-menu-favorites"]` | Opens favorites from the More sheet. It is not a bottom tab. |
| Favorites panel | `[data-testid="favorites-panel"]` / `.workspace-favorites-panel.is-floating` | Global liked library for favorite images and prompts. It is a draggable floating window above the workspace, starts centered, and restores the last closed drag position from `kk_favorites_panel_position_v1`. |
| Favorites drag handle | `[data-testid="favorites-panel-drag-handle"]` / `.workspace-favorites-drag-handle` | The title area moves the Favorites panel. This surface is separate from the `@` reference popup. |
| Reference mention panel | `[data-testid="reference-mention-panel"]` / `.reference-mention-panel.is-floating` | Opens while a registered composer has an active `@` token. It anchors near the typed `@` and uses tabs 上传内容, 标签, 喜欢. |
| Canvas prompt composer | composer id `promptbar` | Default focused composer. Prompt favorites insert text; image references insert `@name` and add attachable images to `config.referenceImages`. |
| Chat assistant composer | composer id `assistant` | Inserts `@name` into the chat input and attaches selected images/files as assistant context when available. |
| AI takeover dock composer | composer id `ai-dock` | Inserts `@name` into the dock input and uses the takeover resource pool as context. |

Rule: favorites are global browser/app state. Workspace mirroring, when a file-system handle exists, writes `favorites/manifest.json`, `favorites/originals/`, and `favorites/thumbnails/` without deleting canvas originals. The heart entry opens the Favorites collection window with Chinese UI copy; typing `@` opens only the lightweight reference popup above the typed token.

## 5. AI Run Timeline - updated 2026-07-15

| Component | Selector / State | Assistant meaning |
| :--- | :--- | :--- |
| AI run timeline shell | `.ai-takeover-run-timeline` | Compact status rail shared by assist and takeover. It is derived from the active `AgentRunRecord` in `AgentRunStore`, not from a separate assistant runtime. |
| AI takeover run timeline step | `.ai-takeover-run-timeline__step[data-status]` | One of the canonical execution stages: `IntentGate`, `Planner`, `PermissionPolicy`, `Executor`, `Verification / Memory`. |
| Timeline step status | `data-status="pending|active|done|needs_confirmation|failed|cancelled"` | Machine-readable status for automation and visual QA. Confirmation-heavy actions should surface `needs_confirmation` on `PermissionPolicy`; tool execution should surface `active` on `Executor`. |

Rule: the run timeline must continue to reflect the single `IntentGate -> Planner -> ToolRegistry -> PermissionPolicy -> Executor -> Verification -> Memory / Knowledge Update` flow. Assist pauses executable plans at the preview/confirmation boundary; takeover may advance low-risk actions under policy. Do not add a parallel assistant entry or a second runtime just to power this UI.
