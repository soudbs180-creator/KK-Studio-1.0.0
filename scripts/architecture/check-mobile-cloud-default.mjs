// scripts/architecture/check-mobile-cloud-default.mjs
import fs from 'node:fs';

async function main() {
  const policyPath = 'apps/web/src/features/generation/routePolicies.ts';
  if (!fs.existsSync(policyPath)) {
    console.error(`[Mobile Cloud Default Check] P0 ERROR: ${policyPath} does not exist.`);
    process.exit(1);
  }

  const content = fs.readFileSync(policyPath, 'utf8');
  
  // Statically check that mobile checks fall back to cloud-user-key/cloud-platform-key
  if (!content.includes("deviceType === 'mobile'")) {
    console.error("[Mobile Cloud Default Check] P0 ERROR: routePolicies.ts must branch on deviceType === 'mobile'.");
    process.exit(1);
  }

  const mobileBlock = content.split("deviceType === 'mobile'")[1]?.split('}')[0] || '';
  if (!mobileBlock.includes('cloud-user-key') && !mobileBlock.includes('cloud-platform-key')) {
    console.error("[Mobile Cloud Default Check] P0 ERROR: Mobile device type must default to cloud relay or platform credits.");
    process.exit(1);
  }

  console.log('[Mobile Cloud Default Check] Passed: Mobile default routing satisfies cloud first rule.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
