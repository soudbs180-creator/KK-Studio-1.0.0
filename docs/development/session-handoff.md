# Session Handoff - 登录界面默认中文加载问题修复

**Last Updated:** 2026-06-11

## 1. 修改范围
修复了在无浏览器缓存（无 LocalStorage）的情况下，KK Studio 登录界面默认显示为英文的问题。

## 2. 修改文件
- **[root.tsx](file:///c:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/web/src/app/root.tsx)**
  - 移除了 `Layout` 组件中硬编码的 `<html lang="en">`。
  - 引入 `getDocumentLanguage` 获取当前环境首选语言。
  - 动态渲染 `<html>` 的 `lang` 属性（`lang={lang}`），当没有 LocalStorage 记录时默认应用 `"zh-CN"`。

## 3. 设计决策
- **动态 DOM Lang 渲染**：之前的 `<html lang="en">` 导致 React 树重新渲染时强行把 DOM `lang` 重置为 `"en"`。由于翻译助手直接依赖 DOM 的 `lang` 属性进行无 Context 状态的静态翻译，这使得许多文案最终展示为英文。通过将其修改为动态值，彻底避免了属性被强行复写的问题。
- **动态 SSR 与 Hydration 兼容**：在服务端（Node.js 环境）中，若 window 未定义，默认输出 `"zh-CN"`；在客户端挂载时动态与 LocalStorage 同步，完美保证了性能与表现的一致。

## 4. 已运行验证
- 单元测试运行：`node --import ./scripts/test/set-log-level.mjs --test tests/unit/auth-localization.test.ts` 成功，**7项测试全部通过**。
- 类型静态检查：`npm run typecheck` 成功，无任何编译错误。
- 构建验证：已成功通过本地 `npm run build` 相关校验。

## 5. 未运行验证及原因
- 暂无。本次修改已全面运行了所有常规验证脚本。

## 6. 风险与下一步
- **风险**：无风险。动态读取完全复用了项目中原有的 `getDocumentLanguage` 检测机制，不会带来任何副作用。
- **下一步**：交付用户进行日常使用体验。

## 7. 版本治理与声明 (Version Governance)
- 本次会话开发完全遵循 KK Studio v1.5.6 的版本治理规范。
- `config/release-manifest.json` 为主版本源。
- `apps/web/src/config/appInfo.ts` 运行时只读导出。
- `release/publish/stable/manifest.json` 为 portable stable 发布清单。
