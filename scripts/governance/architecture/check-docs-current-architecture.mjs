// scripts/governance/architecture/check-docs-current-architecture.mjs
import fs from 'node:fs';

const REQUIRED_DOCS = [
  'docs/architecture/NEW_ARCHITECTURE_SOURCE_OF_TRUTH.md'
];

async function main() {
  let failed = false;

  for (const doc of REQUIRED_DOCS) {
    if (!fs.existsSync(doc)) {
      console.error(`[Docs Current Architecture Check] P0 ERROR: Missing architecture documentation file: "${doc}"`);
      failed = true;
      continue;
    }

    const content = fs.readFileSync(doc, 'utf8');
    const keywords = ['CanvasSpatialIndex', 'CanvasMeasurementScheduler', 'ProviderRouteEngine'];
    for (const word of keywords) {
      if (!content.includes(word)) {
        console.error(`[Docs Current Architecture Check] P0 ERROR: Document "${doc}" is missing critical keyword reference: "${word}"`);
        failed = true;
      }
    }
  }

  if (failed) {
    process.exit(1);
  }

  console.log('[Docs Current Architecture Check] Passed: Current architecture source of truth is correctly documented.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
