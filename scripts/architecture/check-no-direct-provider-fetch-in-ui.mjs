// scripts/architecture/check-no-direct-provider-fetch-in-ui.mjs
import fs from 'node:fs';
import fg from 'fast-glob';

const FORBIDDEN_DOMAINS = [
  'api.openai.com',
  'generativelanguage.googleapis.com',
  'api.anthropic.com',
  'dashscope.aliyuncs.com'
];

async function main() {
  const files = await fg([
    'apps/web/src/components/**/*.{ts,tsx}',
  ], {
    ignore: [
      'node_modules/**',
      'dist/**',
    ]
  });

  const offenders = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('//') || line.includes('/*')) continue;

      for (const domain of FORBIDDEN_DOMAINS) {
        if (line.includes(domain) && (line.includes('fetch(') || line.includes('axios.'))) {
          offenders.push(`${file}:${i + 1} -> ${line.trim()}`);
        }
      }
    }
  }

  if (offenders.length > 0) {
    console.error('[No Direct Provider Fetch Check] P0 ERROR: UI components must not make direct network calls to providers. Use generateService instead:');
    offenders.forEach(off => console.error(` - ${off}`));
    process.exit(1);
  } else {
    console.log('[No Direct Provider Fetch Check] Passed: No UI components bypass the routing engine.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
