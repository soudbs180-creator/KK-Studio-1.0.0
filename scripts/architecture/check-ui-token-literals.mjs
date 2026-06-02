import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}/;
const RGBA_REGEX = /rgba?\(/;
const HSLA_REGEX = /hsla?\(/;

async function main() {
  const files = await fg([
    'apps/web/src/components/**/*.{ts,tsx}',
  ], {
    ignore: [
      'node_modules/**',
      'dist/**',
    ],
  });

  const offenders = [];

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 排除注释和例外行
      if (line.includes('//') || line.includes('/*')) continue;
      if (line.includes('UI_TOKEN_EXCEPTION')) continue;

      if (HEX_COLOR_REGEX.test(line) || RGBA_REGEX.test(line) || HSLA_REGEX.test(line)) {
        offenders.push(`${file}:${i + 1} -> ${line.trim()}`);
      }
    }
  }

  if (offenders.length) {
    console.warn('[UI Token Check] Found hardcoded color literals. Consider tokenizing them or adding "// UI_TOKEN_EXCEPTION":');
    offenders.slice(0, 10).forEach((off) => console.warn(` - ${off}`));
    if (offenders.length > 10) {
      console.warn(` ... and ${offenders.length - 10} more offenders.`);
    }
    // 注意：只做警告，不阻断编译，因为有存量硬编码颜色（Phase 3/4 才逐步清理）。
    process.exit(0);
  } else {
    console.log('[UI Token Check] Check passed: no hardcoded color literals found.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
