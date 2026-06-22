<!-- AI_ROUTING_KEY: version, release, husky, manifest, CI/CD, verify -->
# KK Studio 版本发布与更新规范

> 明确以 `release-manifest.json` 为最高事实的版本发布机制与防退化 TDD 本地校验流程。

项目版本号与分支合并推行严格的防退化保障机制。

## 1. 版本事实控制

- **发布真理源**：以根目录 `config/release-manifest.json` 的版本号 `v1.5.7` 为全项目 Workspace 版本的唯一最高事实。
- **投影同步**：各 Workspace 的 `package.json` 中的 `version` 字段仅作为发布打包时的脚手架自动投影，手动修改无效且会被 CI 拦截。

---

## 2. 本地防退化校验

所有代码变更在推入主分支、提交 PR 或部署前，必须通过完全防退化 TDD 流程：

- **自动化全项校验**：修改完毕必须在本地运行：
  ```bash
  npm run verify:changes
  ```
  该命令执行包含架构设计合规校验、CI 编码格式校验、1290+ 个单元/集成/冒烟契约测试用例。
- **测试修改红线**：禁止为了通过测试而任意改动、抹平测试用例的预期，任何改动必须遵循向下兼容（Backward Compatibility）和设计一致性契约。
