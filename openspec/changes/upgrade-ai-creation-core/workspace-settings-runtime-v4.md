# Workspace / Composer / Settings / Runtime v4 增量规范

> Status: implementation active
> Parent change: `upgrade-ai-creation-core`
> Last verified: 2026-08-02

本文件是 41 条产品注释在既有 AI Creation Core 中的增量验收规范。它不建立新的 AI Runtime、Provider Registry、任务队列或助手；所有状态继续来自现有 Task Center、DurableGenerationQueue、AgentRunStore、ToolRegistry、Capability Graph 与服务端权威数据面。

## 1. 不变量

1. 顶部任务胶囊是唯一 Task Center 入口；不得恢复独立任务触发按钮或底部 Task tray。
2. 手机 OpenCLI 执行目标永远是 owner-bound 配对电脑；VPS 只做身份、调度、状态与审计。
3. Provider 排序是服务端路由优先级，不是本地 UI 偏好；并发冲突必须以 revision 显式解决。
4. Quote 冻结 Connection/Binding；运行中失效返回 stale 并重新 Quote，不得暗换通道。
5. 平移、缩放和性能模式不得改变已显示卡片的结构、文字、端口或视觉完整度。
6. 桌面和手机共享导航注册表、领域状态和控件语义，只替换响应式外壳。

## 2. 纵向切片

### Workspace（注释 1–9、17–23、25）

- 顶部项目/任务/账户三簇、项目菜单 12px 间隙、充值胶囊、单一画布/画板切换与网格状态。
- 小地图底栏为缩放 → 整理 → 展开；地图上方展开，交互后才显示确认/取消。
- 36px 画笔控件、pointer capture 拖动、持久化与视口夹紧。
- 卡片 LOD 稳定、连接装饰移除但命中区保留；版本引导与标准 Command Palette。

### Composer（注释 10–16、24）

- layout registry 根据左右占用计算居中与最大宽度；占位“随心输入”，最多 10 行后内部滚动。
- 第一排媒体、第二排上下文；稳定 ID、从左到右编号、拖动挤开动画与视频首/尾帧角色随排序更新。
- Footer 左侧参考/模型/参数，右侧语音/发送；发送为带文字胶囊。
- 收藏桌面支持拖动、边缘宽高调整与角落等比缩放，420×360 下限、视口 12px 上限；手机禁用自由拖动。
- AI 侧栏复用同一 Runtime 与 Composer 视觉结构，桌面磨砂内嵌并与小地图保持间距。

### Settings（注释 26–41）

- 同源 IA：总览；集成/API 配置/能力配置/AI 代理；系统维护/数据与安全/性能配置/系统日志。
- 总览消费趋势位于快捷决策上方；系统状态与插件能力等高。
- API 配置为 65/35 等高双栏；供应商横卡可鼠标、触摸和键盘排序，预设每页 6 项。
- 新增/编辑使用 Provider schema 驱动协议、endpoint、认证、预算和扩展字段；桌面双栏、手机单栏。
- 性能模式为自动/流畅/标准/高性能/自定义，只有自定义显示细项。
- 系统日志分别探测 API Gateway、Local Runner、CLIProxyAPI、OpenCLI、浏览器会话、延迟、版本和恢复动作。

### Runtime / Data

- migration 029：`routing_priority` + owner revision；`PUT /v1/provider-connections/order` 原子排序。
- migration 030：配对运行时、短期凭据、capability manifest、心跳/吊销、幂等租约命令。
- migration 031：Skill/MCP/Plugin manifest、权限和加密 secret reference；旧 Skill 幂等导入与只读过渡。
- OpenCLI 只接受注册站点和 strict Zod envelope；进程监管必须使用绝对路径、hash 校验、固定参数和 `shell:false`。

## 3. 回滚与兼容

- v1 Provider Connection 列表和旧 settings route 保留一个版本；v2 列表 additive 增加排序字段。
- 视觉回滚不删除 029–031 表、不改写 routing priority、不撤销配对或扩展 manifest。
- 旧 `referenceImages` 通过 adapter 转换为规范媒体引用；旧收藏位置记录按 v2 geometry schema 读取并补默认尺寸。

## 4. 验收门禁

- 视口：1099×720、1133×720、1440×900、390×844，同主题同状态参考/实现并排对照。
- Workspace、Composer、Settings、路由、配对安全和 migration 测试按父 change `tasks.md` 执行。
- 受控 PostgreSQL 必须验证 029–031 的空库、存量库与重复执行；本机无 PostgreSQL 时不得把该 gate 标记完成。
- 完成前运行 architecture/governance/typecheck/build/10K/verify:changes，并记录 `design-qa.md` 与 session handoff。
