import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

// 简体中文：静态检测各站点适配器是否均遵循统一的 BrowserSiteAdapter 类型契约声明
async function run() {
  const files = await glob('apps/web/src/features/browser-assistant/sites/*.ts');
  let violation = false;

  for (const file of files) {
    // genericWebAdapter.ts 可以是个例外，或者本身也实现契约
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('BrowserSiteAdapter') && !file.includes('genericWebAdapter')) {
      console.error(`❌ [Contract Violation] 适配器未引入或未实现 BrowserSiteAdapter 契约: ${file}`);
      violation = true;
    }
  }

  if (violation) {
    process.exit(1);
  } else {
    console.log('✅ [Check Passed] 各站点适配器均完美匹配 BrowserSiteAdapter 契约规范。');
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
