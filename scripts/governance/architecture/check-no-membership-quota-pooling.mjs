import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

// 简体中文：静态检测是否存在将个人已登录网页账号的配额/会话进行共享或多路池化的违规行为
async function run() {
  const files = await glob('apps/web/src/features/browser-assistant/**/*.{ts,tsx}');
  let violation = false;

  const forbiddenPoolingKeywords = [
    'shareSession',
    'sessionPool',
    'quotaPool',
    'getNextSessionFromPool',
    'allSessionsPool',
    'distributeQuota'
  ];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const kw of forbiddenPoolingKeywords) {
      if (content.includes(kw)) {
        console.error(`❌ [Security Violation] 浏览器助手内部发现非法会话共享/池化配额机制: ${file} (关键字: ${kw})`);
        violation = true;
      }
    }
  }

  if (violation) {
    process.exit(1);
  } else {
    console.log('✅ [Check Passed] 已确认个人会员配额不存在跨用户共享或多路池化机制。');
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
