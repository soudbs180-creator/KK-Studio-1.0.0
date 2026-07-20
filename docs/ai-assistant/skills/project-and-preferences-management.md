Status: reference

# 项目与生成偏好管理 Skill

## 目标

让 AI 通过类型化站点能力端口管理当前用户的项目与生成默认值，不模拟项目菜单、设置按钮或表单输入，也不越过用户、计费和密钥边界。

## 关联工具与权限

- 只读：`project.list`、`project.getActive`、`preferences.get`
- 安全导航：`project.open`
- 需确认：`project.create`、`preferences.updateGenerationDefaults`
- 可撤销局部修改：`project.rename`
- 危险操作：`project.delete`

## 执行协议

1. 先读取 `project.list` / `project.getActive` 的实时快照；不得使用对话历史中的旧项目 ID 推断当前目标。
2. 用户使用项目名时，只在名称或 ID 唯一匹配后冻结 `projectId`。多个项目同名或没有匹配项时必须先澄清，不能调用修改工具。
3. 在调用 `project.create` 前展示新项目名称、当前项目切换影响和幂等键；获得 run-bound 确认后才能创建。
4. `project.rename` 必须绑定明确项目 ID、原名称和目标名称，并通过执行后快照验证名称已收敛；失败时保留原名称并报告可重试失败。
5. `project.delete` 必须使用 `dangerous` 二次确认，展示项目名称、ID、画布内容数量和不可恢复影响。禁止删除最后一个项目，禁止模糊目标和跨用户目标。
6. `preferences.updateGenerationDefaults` 只能提交允许字段：生成模式、比例、尺寸、并行数、Prompt 优化、Grounding、搜索和 thinking mode。确认卡必须展示变更前后差异。
7. 每个修改调用必须携带幂等键，并在返回后重新读取实时快照完成 `verify`；工具返回成功本身不代表目标完成。

## 安全边界

- 不得借由项目或偏好工具读取或修改 API 密钥、支付状态、积分余额、账户角色、Provider 凭据或数据库内容。
- `preferences.updateGenerationDefaults` 的并行数仅允许 1–8；任何未知字段、密钥形字段或越界数值都必须在 Host 变更前拒绝。
- `project.create` 和 `project.delete` 必须经过 `confirmationPolicy`；删除必须明确标记影响范围且不可由 takeover 静默执行。
- 所有读取和修改都限定为当前 Runtime owner。项目名称、选择或页面在确认后发生变化时，应使旧授权失效并要求重新确认。

## 验证与恢复

- 创建：验证新项目 ID 存在且成为当前项目。
- 打开：验证 `activeProjectId` 与冻结目标一致。
- 重命名：验证目标项目名称已更新。
- 删除：验证目标项目消失且仍至少保留一个项目。
- 偏好：逐字段验证 Host 快照与确认补丁一致。
- 状态未收敛时标记为可重试失败；已发生部分修改时标记部分成功或回滚失败，不得伪报成功。
