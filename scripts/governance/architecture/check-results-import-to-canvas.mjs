import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

// 简体中文：静态检测浏览器助手提取结果，确认其仅允许通过 takeover-create-prompt-cards 入画布
async function run() {
  const files = await glob('apps/web/src/features/browser-assistant/**/*.ts');
  let violation = false;

  for (const file of files) {
    // 排除 browserResultMapper.ts 自身
    if (file.endsWith('browserResultMapper.ts') || file.endsWith('browserAssistantService.ts')) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('takeover-create-prompt-cards') || content.includes('createPromptCards') || content.includes('activeCanvas.promptNodes')) {
      console.error(`❌ [Boundary Violation] 非法试图绕过 mapper 直接入画布: ${file}`);
      violation = true;
    }
  }

  if (violation) {
    process.exit(1);
  } else {
    console.log('✅ [Check Passed] 提取结果入库画布收口检测通过。');
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
