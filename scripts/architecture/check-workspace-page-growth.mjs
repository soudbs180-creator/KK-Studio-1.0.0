// scripts/architecture/check-workspace-page-growth.mjs
import fs from 'node:fs';

const MAX_ALLOWED_LINES = 7000;

async function main() {
  const filePath = 'apps/web/src/pages/Workspace/WorkspacePage.tsx';
  if (!fs.existsSync(filePath)) {
    console.error(`[WorkspacePage Growth Check] ERROR: ${filePath} does not exist.`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;

  console.log(`[WorkspacePage Growth Check] Current line count: ${lines} (Limit: ${MAX_ALLOWED_LINES})`);

  if (lines > MAX_ALLOWED_LINES) {
    console.error(`[WorkspacePage Growth Check] P1 WARNING: ${filePath} has grown to ${lines} lines, exceeding the limit of ${MAX_ALLOWED_LINES}. Please refactor and offload hooks/logic!`);
    process.exit(1);
  }

  console.log('[WorkspacePage Growth Check] Passed: WorkspacePage size is within acceptable boundaries.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
