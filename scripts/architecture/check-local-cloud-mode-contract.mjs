// scripts/architecture/check-local-cloud-mode-contract.mjs
import fs from 'node:fs';

const REQUIRED_MODES = [
  'local-runner',
  'browser-direct',
  'cloud-user-key',
  'cloud-platform-key',
  'account-bridge'
];

async function main() {
  const intentPath = 'apps/web/src/features/generation/generationIntent.ts';
  if (!fs.existsSync(intentPath)) {
    console.error(`[Local Cloud Contract Check] P0 ERROR: ${intentPath} does not exist.`);
    process.exit(1);
  }

  const content = fs.readFileSync(intentPath, 'utf8');
  for (const mode of REQUIRED_MODES) {
    if (!content.includes(mode)) {
      console.error(`[Local Cloud Contract Check] P0 ERROR: Missing RouteMode option in contract: "${mode}"`);
      process.exit(1);
    }
  }

  console.log('[Local Cloud Contract Check] Passed: All 5 routing contract modes are successfully declared.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
