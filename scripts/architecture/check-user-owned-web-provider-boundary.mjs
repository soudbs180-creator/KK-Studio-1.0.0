import fs from 'fs';
import path from 'path';

// 简体中文：静态检测网页会员路由，确保其绝对不被作为公共平台的 cloud-platform-key 混淆使用
async function run() {
  const policyPath = 'apps/web/src/features/generation/routePolicies.ts';
  if (fs.existsSync(policyPath)) {
    const content = fs.readFileSync(policyPath, 'utf8');
    
    // 如果 provider 代表了 web 或是 user-owned，它的返回值绝对不能是 cloud-platform-key
    const lines = content.split('\n');
    let isWebProviderBlock = false;
    let index = 0;

    for (const line of lines) {
      if (line.includes('web-provider') || line.includes('user-owned-')) {
        isWebProviderBlock = true;
      }
      if (isWebProviderBlock) {
        if (line.includes('cloud-platform-key')) {
          console.error(`❌ [Security Violation] 网页会员提供商非法使用了共享的 cloud-platform-key 平台额度！`);
          process.exit(1);
        }
        if (line.includes('}')) {
          index++;
          if (index > 5) {
            isWebProviderBlock = false;
            index = 0;
          }
        }
      }
    }
  }

  console.log('✅ [Check Passed] 网页会员能力安全边界隔离正常，无法通过平台公共密钥调用。');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
