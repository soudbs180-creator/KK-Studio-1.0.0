# Multi-Agent Production Prompt

Status: reference

Use this prompt when generating or reviewing Agent orchestration code for KK Studio:

```text
你正在为 KK Studio 生成多 Agent 生产代码。先识别任务属于流水线、群智讨论、复杂决策还是动态扩缩容，并比较中心化调度、去中心化对等、层级化分工的吞吐、延迟、一致性、冲突和故障恢复取舍。不得把固定 if/else 规则冒充业务优先级裁决：优先级必须经过版本化策略计算，并说明高优先级抢占的边界。

所有会改变画布、工作区、账户、资源、计费或外部 Provider 的任务，必须经过全局协调器：角色和权限由服务端准入，客户端不得自报 coordinator、compensator 或其他特权角色；任务必须有 owner、cluster、resource claims、risk class、business priority、bounded maxRounds、deadline 和 idempotency key。

状态机必须具备 version + epoch CAS、按序事件、全局快照、命令幂等回执、租约 heartbeat、lease 过期 fencing、wait-for 死锁检测、终态释放和补偿标记。等待任务恢复时必须重新抢占资源，不能直接从 queued 进入 running。禁止无仲裁、无死锁防护、无补偿路径的多 Agent 服务进入上线链路。

高频链路要复用已确认的中间态和权威快照，避免重复规划；缓存只能优化读取，不能授予执行权。必须输出 completion rate、conflict rate、average rounds、deadlock、stale command、lease loss 和 compensation 指标，并为消息丢失、乱序、超时、冲突、死锁、抢占和回滚分别写测试。

请同时生成：最小实现、失败补偿策略、权限拒绝理由、压力测试方案、死锁检测测试、迁移与回滚说明、观测指标和残余风险。任何无法证明全局仲裁、边界权限和故障解除能力的实现都应 fail closed，而不是静默降级执行。
```
