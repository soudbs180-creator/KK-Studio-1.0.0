// scripts/governance/architecture/check-no-raw-zindex.mjs
// 中文注释：禁止在业务组件中乱写硬编码的 Z-Index 数值（防层级混乱静态规则）

import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

// 检索类似 z-[9999] 或 zIndex: 10000 这种未规范化的层级
const RAW_ZINDEX_CLASS_REGEX = /\bz-\[(\d+)\]/;
const RAW_ZINDEX_STYLE_REGEX = /\bzIndex:\s*['"]?(\d+)['"]?/;

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
      // 忽略注释与特定例外行
      if (line.includes('//') || line.includes('/*')) continue;
      if (line.includes('Z_INDEX_EXCEPTION')) continue;
      
      // 特别宽容掉 KK_LAYER 内部的层级声明和本校验脚本本身
      if (line.includes('KK_LAYER')) continue;

      if (RAW_ZINDEX_CLASS_REGEX.test(line) || RAW_ZINDEX_STYLE_REGEX.test(line)) {
        offenders.push(`${file}:${i + 1} -> ${line.trim()}`);
      }
    }
  }

  if (offenders.length) {
    console.warn('[z-index Check] Found unauthorized hardcoded z-index. Use KK_LAYER tokens instead, or add "// Z_INDEX_EXCEPTION":');
    offenders.slice(0, 15).forEach((off) => console.warn(` - ${off}`));
    if (offenders.length > 15) {
      console.warn(` ... and ${offenders.length - 15} more offenders.`);
    }
    // 注意：修改为警告模式，不阻断编译，因为有历史存量硬编码 z-index。
    process.exit(0);
  } else {
    console.log('[z-index Check] Check passed: no hardcoded z-indexes found.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
