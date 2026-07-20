Status: historical

# Design: expand-ai-site-capabilities

## 1. 单一领域能力边界

领域工具仅调用 `AssistantExecutionContext.site` 中的实时宿主端口，或复用现有 ToolRegistry 工具；不读取 DOM、不模拟点击，也不复制 React 业务状态。

```text
Planner
  -> ToolRegistry
    -> AssistantExecutionContext.site
      -> CanvasContext / workspace navigation / generation config
```

每个端口的 getter 必须读取最新宿主状态。计划先切换项目再读取画布时，后续步骤不得继续使用计划创建时的旧项目闭包。

## 2. 领域工具集合

- `navigation.openSurface`、`navigation.openSettings`：统一页面和设置导航语义；旧 UI 名称保留为适配器。
- `workspace.getState`：返回当前 surface、协作模式、项目、选区、Queue 和 Run 的脱敏摘要。
- `project.list`、`project.getActive`、`project.open`、`project.create`、`project.rename`、`project.delete`：调用 CanvasContext 项目能力。删除始终为 dangerous；创建需要确认；切换和读取为 safe。
- `canvas.*`：继续复用 CanvasRuntimeState 与既有画布工具。
- `generation.*`：继续复用 DurableGenerationQueue；创建、恢复、重试和成本动作需要确认。
- `assets.list`、`assets.resolveOriginals`、`assets.zipOriginals`：只返回脱敏资源摘要，下载继续生成真实 manifest。
- `export.getCapabilities`、`export.zipOriginals`：导出域只描述或委托既有 `assets.zipOriginals`，不复制 ZIP 实现。
- `history.getState`、`history.undo`、`history.redo`：使用 CanvasContext 历史栈；Undo/Redo 是可撤销局部操作。
- `preferences.get`、`preferences.updateGenerationDefaults`：仅允许明确列出的生成偏好字段；更新需确认，不允许写密钥或付款配置。
- `account.getSummary`、`billing.getSummary`：仅返回 owner 是否存在、API Key 是否已配置的布尔/枚举状态和可展示余额；不返回 Key、令牌、付款状态写入口或管理权限。

## 3. UI 动作分类

业务动作以领域工具表达。下拉菜单开关、侧栏折叠、筛选、焦点样式、对话框开关、画布模式按钮和本地拖拽位置继续 `toolName: undefined`；Agent 不得通过 highlight/click 间接触发这些动作。

## 4. 固定验收旅程

```text
project.open
  -> assets.list + canvas.getSelectedNodes
  -> Planner clarification when goal is incomplete
  -> confirmation preview (count + cost + impact)
  -> generation.createBatchJob
  -> DurableGenerationQueue
  -> CanvasRuntimeState-backed output import
  -> canvas.arrangeNodes
  -> generation.getJobStatus
  -> assets.zipOriginals
```

`generation.createBatchJob` 的幂等键绑定 Run/Step；Queue 的 job、prompt item、输出节点和完成处理均使用稳定标识。折叠助手不会卸载或重建 Queue；刷新从持久快照恢复；页面切换只改变当前 surface，不重放已完成 Provider 调用。

## 5. 权限与验证

- `safe`：只读、导航、项目打开、Undo/Redo 等低风险且可恢复操作。
- `confirm`：项目创建、重命名、偏好写入、生成、批量、成本和 ZIP。
- `dangerous`：项目删除以及任何不可逆删除/公开发布。
- `forbidden`：密钥内容、余额修改、充值审批、支付确认、数据库、任意 Shell。

所有新 mutation 工具都提供对象输入校验、Registry 幂等键、影响/费用/恢复元数据和结构化验证证据。

## 6. 兼容策略

旧 `ui.*`、`zipOutputs` 和生成别名保留，但 Planner 文档、LocalBrain 和新覆盖矩阵只使用领域名称。兼容别名不得降低目标工具的权限、验证或幂等要求。
