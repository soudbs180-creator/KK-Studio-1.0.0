---
name: recover-interrupted-agent-task
description: 异常中断任务恢复技能，在系统加载初始化或网络恢复时，读取磁盘或后端持久化的待处理批量生成 Job 列表，重新拉起异步轮询队列，恢复中断任务状态。
---

# 恢复中断任务 Skill (recover-interrupted-agent-task)

- **适用场景**: 页面刷新、意外网络中断或浏览器关闭导致批量处理卡死。
- **前置条件**: 存在被中断的排队或执行中的 Job。
- **调用工具**:
  - `generation.getJobStatus`
  - `generation.resumeJob`
- **执行步骤**:
  1. 系统挂载及初始化时，读取本地/后端持久化的 Job 状态列表。
  2. 若检测到 `queued` 或 `running` 状态的批量任务被中断，自动调度 `durableGenerationQueue.processQueue()`。
  3. 通过本地缓存恢复对子任务状态的轮询，直至整批任务完成排版。
