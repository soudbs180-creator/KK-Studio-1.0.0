import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

// 简体中文：静态检测移动端工程中是否存在引入桌面版 OpenCLI 的入口或引用
async function run() {
  const mobileFiles = await glob('apps/mobile/**/*.{ts,tsx,js,jsx}');
  let violation = false;

  for (const file of mobileFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('/browser-assistant/opencli') || content.includes('opencliClient')) {
      console.error(`❌ [Boundary Violation] 移动端模块非法导入了桌面版 OpenCLI 客户端: ${file}`);
      violation = true;
    }
  }

  if (violation) {
    process.exit(1);
  } else {
    console.log('✅ [Check Passed] 移动端未含有任何对 OpenCLI 桌面版的直接或间接导入。');
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
