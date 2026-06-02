import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

async function main() {
  const files = await fg([
    'apps/web/src/**/*.{ts,tsx}',
    'packages/**/*.{ts,tsx}',
  ], {
    ignore: [
      'packages/ui/src/web/**',
      'node_modules/**',
      'dist/**',
    ],
  });

  const offenders = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes("from '@lobehub/ui'") || text.includes('from "@lobehub/ui"')) {
      offenders.push(file);
    }
  }

  if (offenders.length) {
    console.error('[UI Boundary] Direct @lobehub/ui imports are forbidden outside packages/ui/src/web:');
    offenders.forEach((file) => console.error(` - ${file}`));
    process.exit(1);
  } else {
    console.log('[UI Boundary] Check passed: no direct @lobehub/ui imports found.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
