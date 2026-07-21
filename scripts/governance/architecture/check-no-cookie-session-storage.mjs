import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

// 简体中文：静态检测浏览器助手核心模块中没有任何存取/传输敏感 cookie & session 的非合规调用
async function run() {
  const files = await glob('apps/web/src/features/browser-assistant/**/*.{ts,tsx}');
  let violation = false;

  const forbiddenKeywords = [
    'document.cookie',
    'localStorage.setItem(\'cookie\'',
    'sessionStorage.setItem(\'cookie\'',
    'cookies.set',
    'saveCookie',
    'saveSession'
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const kw of forbiddenKeywords) {
      if (content.includes(kw)) {
        console.error(`❌ [Security Violation] 浏览器助手逻辑中夹带敏感 Cookie/Session 读写: ${file} (关键词: ${kw})`);
        violation = true;
      }
    }
  }

  if (violation) {
    process.exit(1);
  } else {
    console.log('✅ [Check Passed] 浏览器助手模块凭据零存储检查通过。');
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
