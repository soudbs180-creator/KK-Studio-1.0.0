// scripts/governance/architecture/check-provider-route-engine-required.mjs
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const servicePath = 'apps/web/src/features/generation/generateService.ts';
  if (!fs.existsSync(servicePath)) {
    console.error(`[Route Engine Check] P0 ERROR: ${servicePath} does not exist.`);
    process.exit(1);
  }

  const content = fs.readFileSync(servicePath, 'utf8');
  if (!content.includes('providerRouteEngine.decideRoute')) {
    console.error('[Route Engine Check] P0 ERROR: generateService.ts must use providerRouteEngine.decideRoute to determine execution route.');
    process.exit(1);
  }

  console.log('[Route Engine Check] Passed: providerRouteEngine is correctly integrated in generateService.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
