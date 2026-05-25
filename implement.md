# 实施细节记录 (implement.md)

本文件是 AGENTS 明确规定的根目录例外文件。记录每个里程碑的开发与代码调整细节。

## 里程碑 1 执行细节
- 创建 `plans.md`、`implement.md`、`status.md`、`validation.md`。
- 清理非规范文件，确认 `docs/` 下各文档归位，合并/删除 `docs/docs`。
- 重构 `scripts/governance/check-agent-docs.mjs`，去除已不存在的 `.agent` 依赖，将硬编码文件指向 `docs` 目录。
- 重构 `scripts/governance/check-version-consistency.mjs`，更新 `versionTargets`，支持把 `readme` 绑定到 `docs/README.md`，剔除 `.agent` 相关逻辑。
- 修正 `scripts/architecture/check-import-boundaries.mjs` 和 `check-legacy-zone-boundaries.mjs`，排除遗留的根目录 `src` 检查，收敛到新结构。
- 更新 `config/release-manifest.json`，确保配置不含敏感密钥并映射正确的路径。
