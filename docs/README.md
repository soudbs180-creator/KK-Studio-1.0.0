# KK Studio v1.5.0

KK Studio 是一款面向图像、视频、音频以及演示文稿（Presentation）等工作流的下一代多模态无限画布 AI 工作台。它将提示词创作编排、多模型智能路由、用户自定义 API 密钥管理、工作区云端同步以及商业化计费/运维监控深度融为一体。

## 🌟 核心亮点

- **多模态无限画布 (Multimodal Canvas)**：提供直观的 prompt 编写、资源管理与多模态生成结果的可视化画布，支持组件吸附网络与卡片折叠，助您以搭积木的方式编排创作链路。
- **多模型路由分发**：无缝对接官方接口与第三方中转供应商，具备角色路由与能力分配机制，帮助团队在速度、效果与成本之间取得完美平衡。
- **混合云协同与自主密钥**：提供用户级 API 密钥管理，既支持本地零配置启动，也能通过安全隧道同步至云端，实现隐私与便捷性的统一。
- **商业化闭环与安全管控**：内置完整的充值、计费、积分原子扣减与退款审计（Credits Transaction）机制。管理后台具备精细的分级授权设计。
- **出色的商业级美学设计**：遵循 Apple 级磨砂玻璃态（Glassmorphism）与自适应流式排版设计，搭配丰富的微动效，带来愉悦的使用体验。

## 🛠️ 技术栈 (Tech Layout & Runtime)

- **前端技术**：React 19.2.x, TypeScript 6.0.x, Vite 8.0.x, React Router 7.x
- **样式方案**：Vanilla CSS 变量与现代实用类（Tailwind CSS）
- **移动平台**：Expo (React Native) 移动端应用，提供原生的移动体验
- **后端服务**：基于 PostgreSQL 的 VPS API 运行时，辅以 Supabase 用于 Auth 鉴权及实时数据存取

## 📂 项目结构

根据本项目严格的 AI Agent 架构黄金法则：
- `apps/web/`：唯一的桌面端 Web 前端运行时（Vite + React）。
- `apps/mobile/`：手机端 Expo 应用（React Native）。
- `packages/shared/`：平台无关的共享核心业务包（纯 TS 编写）。
- `packages/api-client/`：统一封装的 HTTP API 客户端。
- `packages/ui/`：跨平台兼容的基础 UI 组件库。
- `server/`：VPS Backend 主服务（Express.js），处理支付 Webhook 及 API 转发。
- `migrations/`：PostgreSQL schema 数据库迁移目录。

## 🚀 本地快速开发

1. **环境准备**：
   确保您已安装 Node.js 22+ 及 npm 10+。
   
2. **复制环境变量**：
   ```bash
   cp .env.example .env
   ```
   如需覆盖前端配置，可创建 `.env.local`。

3. **安装依赖**：
   ```bash
   npm install
   ```

4. **启动本地开发服务**：
   ```bash
   npm run dev:start
   ```
