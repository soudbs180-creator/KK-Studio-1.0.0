import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

async function main() {
  const forbiddenImports = [
    '@lobehub/ui',
    '@lobehub/icons',
    '@lobehub/fluent-emoji',
    'antd',
  ];
  const files = await fg([
    'apps/web/src/**/*.{ts,tsx}',
    'packages/**/*.{ts,tsx}',
  ], {
    ignore: [
      'node_modules/**',
      'dist/**',
    ],
  });

  const offenders = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const matchedImports = forbiddenImports.filter((pkg) => {
      const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(?:from\\s+|import\\s*(?:\\(|\\s))(['"])${escaped}(?:/[^'"]*)?\\1`);
      return pattern.test(text);
    });
    if (matchedImports.length) {
      offenders.push({ file, imports: matchedImports });
    }
  }

  if (offenders.length) {
    console.error('[UI Boundary] Direct heavy UI/icon package imports are forbidden in app/package source:');
    offenders.forEach(({ file, imports }) => console.error(` - ${file}: ${imports.join(', ')}`));
    process.exit(1);
  } else {
    console.log('[UI Boundary] Check passed: no direct heavy UI/icon package imports found.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
