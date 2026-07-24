import fs from "node:fs";
import path from "node:path";

// OpenSpec 状态一致性检查：防止 proposal/design/tasks 三份文件的阶段状态行漂移。
// 源真值是 tasks.md；proposal.md 与 design.md 的 `> Status:` 行必须与 tasks.md 完全一致。
// 见 openspec/changes/upgrade-ai-creation-core/ 与 AGENTS.md 事实优先级。

const root = process.cwd();
const changeDir = path.join(root, "openspec", "changes", "upgrade-ai-creation-core");
const files = ["proposal.md", "design.md", "tasks.md"];
const failures = [];

function fail(message) {
  failures.push(`[openspec:check] ${message}`);
}

function readStatusLine(filePath) {
  const absolutePath = path.join(changeDir, filePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${filePath} is missing`);
    return null;
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const lines = content.split(/\r?\n/);
  // Status 行位于文件开头附近的 `> Status:` 注释行
  const statusLine = lines.find((line) => /^\s*>\s*Status:/i.test(line));
  if (!statusLine) {
    fail(`${filePath} is missing a \`> Status:\` frontmatter line`);
    return null;
  }

  return statusLine.trim();
}

const statusByFile = new Map();
for (const file of files) {
  const line = readStatusLine(file);
  if (line !== null) {
    statusByFile.set(file, line);
  }
}

if (statusByFile.size !== files.length) {
  // 缺失文件的错误已在上面记录，直接退出
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

// tasks.md 是源真值
const sourceOfTruth = statusByFile.get("tasks.md");

for (const file of files) {
  const current = statusByFile.get(file);
  if (current !== sourceOfTruth) {
    fail(
      `${file} Status line drifted from tasks.md (source of truth).\n` +
      `  expected: ${sourceOfTruth}\n` +
      `  actual:   ${current}`,
    );
  }
}

// 额外结构校验：Status 行必须声明 Phase 3 的完成项与未完成项，避免“X next”这类滞后措辞
const canonicalStatus = sourceOfTruth;
if (!/Phase 3.*complete/i.test(canonicalStatus)) {
  fail("tasks.md Status line must declare at least one Phase 3 completed milestone");
}
if (!/pending/i.test(canonicalStatus)) {
  fail("tasks.md Status line must declare remaining Phase 3 pending work");
}
if (/\bnext\b/i.test(canonicalStatus)) {
  fail("tasks.md Status line uses stale \"next\" wording; use \"complete\" / \"pending\" instead");
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(`[openspec:check] OpenSpec status consistent across ${files.length} files (${path.relative(root, changeDir)}).`);
