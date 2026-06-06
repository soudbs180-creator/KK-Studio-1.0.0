# Skill: 工具箱插件多实例运行时 (toolbox-plugin-multi-instance-runtime)

## 触发场景 (Trigger)
- 用户在画布工具箱（Toolbox）中点击打开某个外部 URL 工具（Iframe）或内部 React 辅助工具时。
- 用户右键点击已运行工具，选择“新窗口打开”（多实例行为）时。

## 前置条件 (Preconditions)
- 系统工具注册表已成功加载该工具的定义清单（Manifest）。
- 系统窗口管理器（WindowManager）和常驻工具栏（PinBar）处于可用状态。

## 调用工具 (Tools)
- `ui.openToolWindow`：为指定工具创建或聚焦一个窗口实例。
- `ui.pinTool`：将工具或其实例加入常驻工具栏。
- `ui.updateWindowLayout`：更新特定实例的位置、尺寸、层级和最小化状态。

## 执行步骤 (Steps)
1. **解析工具定义**：获取工具定义模型（Schema），读取 `multiInstance`、`defaultWindowBehavior` 等属性。
2. **窗口实例化**：
   - 如果用户请求“新窗口打开”且工具支持多实例（`multiInstance: true`）：
     - 创建一个新的唯一实例 ID (`instanceId`)。
     - 为该实例分配默认的位置、大小，并渲染内容（通过 iframe 加载 URL 或挂载 React 内部组件）。
     - 将该实例与原有的其他实例隔离开，在常驻工具栏中各自分别显示图标。
   - 如果用户通过普通点击打开，或工具仅支持单实例：
     - 若该工具已有窗口存在，直接聚焦并复用它，不新开窗口。
     - 若没有，则新建单个窗口实例。
3. **窗口常驻处理 (Pinning)**：
   - 检查该工具的默认窗口行为是否声明了自动常驻（`defaultWindowBehavior.autoPinOnOpen = true`）。
   - 如果声明为 true，且用户未手动取消，将该工具实例加入常驻工具栏中。
   - 如果调用方在打开时显式传入了 `autoPin: false`，则应覆盖默认配置，不进行自动常驻。

## 安全与隔离规则 (Safety & Isolation)
- **跨域安全**：对于 Iframe 工具，使用双向 PostMessage 进行通信，对 Origin 进行白名单校验，绝不允许执行不受信任的 JS 或窃取主应用的 Auth Token/密钥。
- **实例隔离**：多实例工具的各个窗口的上下文、位置、持久化状态必须彻底独立，防止实例 A 干扰实例 B 的输入与显示。

## 验证方式 (Validation)
- **多实例验证**：打开支持多实例的工具，选择“新窗口打开”，应成功出现两个独立可拖拽的窗口，且各自具有独立的最小化按钮，且 PinBar 出现两个对应图标。
- **Pin 行为验证**：打开声明 `autoPinOnOpen: true` 的工具，常驻栏应该立刻多出该工具图标；如果传入 `autoPin: false`，则不应多出图标。
