# 超级功能实施计划历史库 (docs/superpowers/README.md)

本目录包含 KK Studio 项目在过往开发中落地的**具体业务超级功能（Superpowers）的设计计划与功能规格**。

## 📁 目录文件清单

1. **[plans/](plans/) —— 具体功能实施方案**
   - 包含如独立管理后台（`2026-04-10-independent-admin-project.md`）、局部重绘工作流（`2026-04-11-partial-redraw-flow.md`）、离线本地路由代理（`2026-04-09-kkai-local-edition.md`）等功能的实现步骤。

2. **[specs/](specs/) —— 业务规格定义**
   - 对应 plans 的详细业务功能规格（如 `2026-04-11-partial-redraw-flow-design.md` 等设计详情）。

## ⚠️ 使用原则

- **仅作历史与逻辑参考**：本目录下的文档记录了过往版本的具体业务实现路径和设计构想。在开发全新功能或升级旧功能时，可以从此处的 plans 和 specs 中汲取实现细节，但不可绕过 `AGENTS.md` 规范。
- **与当前版本对齐**：若在阅读历史 plans 时发现其中提到的数据库定义或模块路由与 v1.5.3 目前的事实冲突，应当以 `docs/architecture/` 中的最新架构规范和真实源码为准。
