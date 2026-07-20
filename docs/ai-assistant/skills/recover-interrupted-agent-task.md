Status: reference

# 恢复中断任务 Skill (recover-interrupted-agent-task)

- **适用场景**: 页面刷新、意外网络中断或浏览器关闭导致批量处理卡死。
- **前置条件**: 存在被中断的排队或执行中的 Job。
- **调用工具**:
  - `generation.getJobStatus`
  - `generation.resumeJob`
- **执行步骤**:
  1. 系统挂载及初始化时，读取本地/后端持久化的 Job 状态列表。
  2. 若检测到同一 owner 的 `queued` 或可安全重建的 `running` 状态任务，由 `DurableGenerationQueue` 自身恢复调度；不得通过通用 recovery grant 调用工具。
  3. `paused` 任务保持暂停。只有用户确认明确 Job、未完成项与后续费用后，才调用 `generation.resumeJob(jobId)`。
  4. 恢复前后校验 owner、Job ID、幂等键和实时 Queue 状态；账号切换时停止旧 owner 的轮询与写回。
  5. 通过持久队列状态恢复对子任务的轮询，直至整批任务完成排版；不得重复提交已完成子项。
