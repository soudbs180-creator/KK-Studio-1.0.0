# User-Owned Web Provider Safety Boundary (v1.6.0)

Last Updated: 2026-06-26
Project Version: 1.6.0

## 1. 物理隔离边界与用户自带密钥 (Boundary & Own Credentials)
网页会员能力（例如 ChatGPT Plus、小红书会员等）在系统中被定义为 `User-Owned Web Provider`（或个人网页 Provider）。
为了防止个人账号额度被平台滥用或跨用户池化，系统强制执行以下物理隔离限制：
* **零存储原则 (Zero Storage Policy)**：前端及云端 API 服务器绝对禁止以任何形式（LocalStorage、SessionStorage、数据库等）保存用户的外部网站 Cookie、网页登录 Session 或者持久化 Access Token。
* **桌面端独占原则 (Desktop Only)**：所有的网页会员能力（通过 local-runner 唤起 Chrome 桥接的操作）**仅允许在用户的桌面端本地执行**。
* **移动端物理拦截**：如果检测到移动端（Mobile / Tablet）设备请求网页会员能力，`browserActionRouter` 与 `routePolicies` 必须在路由判定阶段强制拦截，不予派发。

## 2. 严禁额度池化 (Anti-Quota Pooling)
* **禁止平台托管**：KK Studio 云端绝不在后台模拟用户网页登录，不为多用户提供额度池分配（Pooling）。
* **任务级单次确认**：涉及到高风险或者需要消耗用户配额的操作，必须在 `browserActionRouter` 安全路由前弹窗提示用户确认。
* **本地沙箱隔离**：所有的网页控制指令通过 `local-runner` 的 `opencliService` 单独封装，确保指令运行环境的纯净性和受控性。
