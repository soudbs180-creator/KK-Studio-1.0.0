import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

// 简体中文：静态检测云端后端服务（services/api/）绝对不依赖且不使用网页浏览器自动化脚本
async function run() {
  // 1. 检验 services/api/package.json
  const pkgPath = 'services/api/package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps.puppeteer || allDeps.playwright || allDeps.selenium) {
      console.error(`❌ [Security Violation] 云后端依赖了非合规的浏览器自动化库。`);
      process.exit(1);
    }
  }

  // 2. 检验 services/api/ 中的代码导入
  const files = await glob('services/api/**/*.{js,ts}');
  let violation = false;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('require(\'puppeteer\')') || content.includes('require(\'playwright\')') || content.includes('import puppeteer') || content.includes('import playwright')) {
      console.error(`❌ [Security Violation] 云端代码试图进行自动化登录/爬取: ${file}`);
      violation = true;
    }
  }

  if (violation) {
    process.exit(1);
  } else {
    console.log('✅ [Check Passed] 云端零浏览器自动化依赖检查通过。');
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
