// scripts/architecture/check-no-raw-provider-ui-branch.mjs
// 中文注释：禁止在前端组件代码中对具体供应商进行硬编码 UI 条件过滤（架构解耦静态规则）

import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';

// 捕获类似 provider === 'google' 或 providerId === 'suxi' 等分支判定
const PROVIDER_UI_BRANCH_REGEX = /\b(provider|providerId)\s*(===|==)\s*['"](google|12ai|suxi|gpt-best|wuyinkeji|acedata|newapi)['"]/;

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
      if (line.includes('PROVIDER_BRANCH_EXCEPTION')) continue;

      if (PROVIDER_UI_BRANCH_REGEX.test(line)) {
        offenders.push(`${file}:${i + 1} -> ${line.trim()}`);
      }
    }
  }

  if (offenders.length) {
    console.error('[Provider UI Branch Check] [P0 ERROR] UI components must not contain hardcoded logic branching on model providers. Use model metadata or status code instead, or add "// PROVIDER_BRANCH_EXCEPTION":');
    offenders.slice(0, 15).forEach((off) => console.error(` - ${off}`));
    if (offenders.length > 15) {
      console.error(` ... and ${offenders.length - 15} more offenders.`);
    }
    process.exit(1); // 阻断流程
  } else {
    console.log('[Provider UI Branch Check] Check passed: no raw provider UI branches found.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
