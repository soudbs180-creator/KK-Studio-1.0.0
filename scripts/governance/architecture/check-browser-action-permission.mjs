import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

// 简体中文：静态检测浏览器助手是否在中高风险动作执行前强制要求确认弹窗
async function run() {
  const routerPath = 'apps/web/src/features/browser-assistant/browserActionRouter.ts';
  if (fs.existsSync(routerPath)) {
    const content = fs.readFileSync(routerPath, 'utf8');
    
    // 必须包含对 riskLevel 或 requiresConfirmation 进行核对的安全判定
    if (content.includes('requiresConfirm') && content.includes('cap.riskLevel === \'high\'')) {
      console.log('✅ [Check Passed] BrowserActionRouter 强核对中高风险授权弹窗机制就绪。');
      process.exit(0);
    }
  }

  console.error(`❌ [Security Violation] BrowserActionRouter 中缺乏对风险动作的强行核对授权逻辑。`);
  process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
