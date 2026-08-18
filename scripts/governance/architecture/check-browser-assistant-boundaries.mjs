import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

// 简体中文：静态检测 apps/mobile 没有越界引用任何桌面专属的 browser-assistant 模块
async function run() {
  const files = await glob('apps/mobile/**/*.{ts,tsx,js,jsx}', {
    ignore: ['apps/mobile/node_modules/**'],
    onlyFiles: true,
  });
  let violation = false;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('browser-assistant') || content.includes('opencli')) {
      console.error(`❌ [Boundary Violation] 移动端文件引用了桌面浏览器助手: ${file}`);
      violation = true;
    }
  }

  if (violation) {
    process.exit(1);
  } else {
    console.log('✅ [Check Passed] 移动端与桌面浏览器助手隔离边界正常。');
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
