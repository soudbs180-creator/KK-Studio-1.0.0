// scripts/governance/architecture/check-desktop-local-default.mjs
import fs from 'node:fs';

async function main() {
  const policyPath = 'apps/web/src/core/routing/routePolicies.ts';
  if (!fs.existsSync(policyPath)) {
    console.error(`[Desktop Local Default Check] P0 ERROR: ${policyPath} does not exist.`);
    process.exit(1);
  }

  const content = fs.readFileSync(policyPath, 'utf8');

  // Statically check that desktop default routes to local-runner
  if (!content.includes('localRunnerAvailable && hasLocalUserKey')) {
    console.error('[Desktop Local Default Check] P0 ERROR: routePolicies.ts must prioritize local runner when key and runner are available.');
    process.exit(1);
  }

  const localPrioritizedBlock = content.split('localRunnerAvailable && hasLocalUserKey')[1]?.split('}')[0] || '';
  if (!localPrioritizedBlock.includes('local-runner')) {
    console.error("[Desktop Local Default Check] P0 ERROR: Local prioritized block must route to 'local-runner'.");
    process.exit(1);
  }

  console.log('[Desktop Local Default Check] Passed: Desktop default routing prioritizes local runner when available.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
