/**
 * @file scripts/lib/version-gate.mjs
 * @description 发布前版本一致性硬门禁。
 *
 * 背景：`config/release-manifest.json` 是版本真理源，但仅靠文档约定是脆弱的。
 * CI（cloud-auto-deploy.yml 的 verify job）与 husky pre-commit 已接入
 * `governance:version`，然而 portable 打包发布与 release:hosted 手动发布这两条
 * 路径绕过 GitHub Actions 直连生产，此前没有任何版本校验。本模块补上这道门禁，
 * 供所有发布脚本在产出制品之前调用。
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const CHECK_SCRIPT = path.join("scripts", "governance", "check-version-consistency.mjs");

/**
 * 执行版本一致性校验，不通过则抛出异常中断发布。
 *
 * @param {object} [options]
 * @param {string} [options.context] 发布路径名称，用于错误信息定位。
 * @param {string} [options.rootDir] 仓库根目录，默认取 process.cwd()。
 */
export function assertVersionConsistency(options = {}) {
  const { context = "release", rootDir = process.cwd() } = options;

  const result = spawnSync(process.execPath, [CHECK_SCRIPT], {
    cwd: rootDir,
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`[${context}] 无法执行版本一致性校验: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `[${context}] 版本一致性校验未通过，发布已中止。`
      + ` 请修正与 config/release-manifest.json 的版本漂移后重试。`
    );
  }
}

export default assertVersionConsistency;
