import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

// 常见乱码/mojibake特征字词
const SUSPICIOUS_WORDS = [
  '绠€', '绠', '浣撲', '涓', '鏂', '鐢', '锛', '瑙', '杩', '馃', '', '', '囷', '达紝'
];

async function main() {
  const files = await fg([
    'apps/web/src/**/*.{ts,tsx,css}',
    'packages/**/*.{ts,tsx,css}',
  ], {
    ignore: [
      'node_modules/**',
      'dist/**',
    ],
  });

  let hasError = false;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const matched = SUSPICIOUS_WORDS.filter(word => content.includes(word));
    if (matched.length > 0) {
      console.error(`[Mojibake Check] Found suspicious characters in ${file}: ${matched.join(', ')}`);
      hasError = true;
    }
  }

  if (hasError) {
    process.exit(1);
  } else {
    console.log('[Mojibake Check] No suspicious characters found.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
