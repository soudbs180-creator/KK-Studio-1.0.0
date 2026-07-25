Status: reference

# OpenAI Codex & OAuth Experimental Specification (v1.6.1)

Last Updated: 2026-06-26
Project Version: 1.6.1

## 1. 实验性范围与 Feature Flag 默认关闭 (Experimental & Hard Flags)
OpenAI OAuth 和 Codex 浏览器助手属于系统的实验性增强特性（Experimental features）。
为确保极致的安全隔离：
* **Feature Flag 锁定**：此特性在前端通过全局 Feature Flag `openaiCodexOAuthExperimental` 进行严密隔离，**其初始状态和线上打包默认值强制为 `false`**。
* **UI 隔离展示**：仅当 Feature Flag 显式开启时，系统才会展示“ChatGPT (Experimental)”和“Gemini (Experimental)”的配额及认证通道；若默认关闭，相关路由直接在 `siteCapabilityMatrix` 和 `decideRoute` 中做拦截保护。

## 2. 官方 OAuth PKCE 与 Server-Side Token Vault (Security Model)
若未来正式发布该能力，必须遵守以下官方 OAuth 凭证安全规范：
1. **基于 PKCE 协议**：严禁采用逆向 API、网页 session 抓取或 cookie 破解。必须使用 OpenAI 官方提供的 OAuth PKCE 流程。
2. **Server-Side Token Vault**：
   * 所有从 OAuth 流程中交换得来的 `access_token` 和 `refresh_token` **必须存放在 Express 后端服务器 (Server-Side Token Vault) 中**。
   * 凭证以 AES-GCM 加密存储，在传输和落盘时不传回客户端，前端 LocalStorage 绝不存储任何真实的第三方 OAuth token。
3. **静默刷新与注销**：
   * Token 的自动刷新（使用 refresh_token 向 OAuth 服务器换取新 access_token）全部由后端中间件静默执行。
   * 提供一键注销端口（Disconnect），销毁后端对应的凭证记录，杜绝残留风险。
