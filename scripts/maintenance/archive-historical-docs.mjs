// scripts/maintenance/archive-historical-docs.mjs
// 中文注释：把已标记为 historical / pending-archive 的文档移动到 docs/archive/，
// 然后重新生成 docs/governance/DOCUMENTATION_INDEX.md 并运行文档治理检查。
// 用法：
//   node scripts/maintenance/archive-historical-docs.mjs --dry-run   # 只预览
//   node scripts/maintenance/archive-historical-docs.mjs             # 实际移动
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dryRun = process.argv.includes("--dry-run");

// 移动清单：全部为 Status: historical 或治理索引中 pending-archive 的文件。
const moves = [
  // docs/superpowers 已完成的 2026-07 计划与设计（对应 archive/superpowers 既有目录结构）
  ["docs/superpowers/plans/2026-07-12-api-documentation.md", "docs/archive/superpowers/plans/2026-07-12-api-documentation.md"],
  ["docs/superpowers/plans/2026-07-13-api-client-boundary-convergence.md", "docs/archive/superpowers/plans/2026-07-13-api-client-boundary-convergence.md"],
  ["docs/superpowers/plans/2026-07-13-architecture-convergence-phase-1.md", "docs/archive/superpowers/plans/2026-07-13-architecture-convergence-phase-1.md"],
  ["docs/superpowers/specs/2026-07-13-api-client-boundary-convergence-design.md", "docs/archive/superpowers/specs/2026-07-13-api-client-boundary-convergence-design.md"],
  ["docs/superpowers/specs/2026-07-13-api-runtime-full-remediation-design.md", "docs/archive/superpowers/specs/2026-07-13-api-runtime-full-remediation-design.md"],
  ["docs/superpowers/specs/2026-07-13-architecture-convergence-phase-1-design.md", "docs/archive/superpowers/specs/2026-07-13-architecture-convergence-phase-1-design.md"],
  // docs 根目录散落的 historical 文档
  ["docs/canvas-performance-refactor-plan.md", "docs/archive/canvas-performance-refactor-plan.md"],
  ["docs/canvas-performance-implementation-audit.md", "docs/archive/canvas-performance-implementation-audit.md"],
];

let moved = 0;
let skipped = 0;
for (const [from, to] of moves) {
  const src = path.join(repoRoot, from);
  const dst = path.join(repoRoot, to);
  if (!fs.existsSync(src)) {
    console.log(`[skip] 不存在（可能已移动过）：${from}`);
    skipped += 1;
    continue;
  }
  if (fs.existsSync(dst)) {
    console.error(`[abort] 目标已存在，拒绝覆盖：${to}`);
    process.exit(1);
  }
  console.log(`${dryRun ? "[dry-run] " : ""}${from} -> ${to}`);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.renameSync(src, dst);
    moved += 1;
  }
}

// 清理已经腾空的目录
if (!dryRun) {
  for (const dir of ["docs/superpowers/plans", "docs/superpowers/specs", "docs/superpowers"]) {
    const abs = path.join(repoRoot, dir);
    if (fs.existsSync(abs) && fs.readdirSync(abs).length === 0) {
      fs.rmdirSync(abs);
      console.log(`[rmdir] ${dir}`);
    }
  }
}

console.log(`${dryRun ? "计划移动" : "已移动"} ${moved || moves.length - skipped} 个文件，跳过 ${skipped} 个。`);

// 无论是否发生移动，都重新生成索引：本次整理还新增了归档分卷等 md 文件，索引需要一并收编。
if (!dryRun) {
  console.log("\n重新生成文档治理索引 ...");
  const write = spawnSync(process.execPath, ["scripts/governance/check-documentation-governance.mjs", "--write"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (write.status !== 0) process.exit(write.status ?? 1);
  const check = spawnSync(process.execPath, ["scripts/governance/check-documentation-governance.mjs"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  process.exit(check.status ?? 0);
}
