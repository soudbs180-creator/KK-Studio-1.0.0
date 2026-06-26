import fs from 'fs';
import path from 'path';
import glob from 'fast-glob';

// 简体中文：静态检测 local-runner 模块中是否含有越权的原生 shell 指令调用或 child_process 执行
async function run() {
  const files = await glob('local-runner/src/**/*.{ts,js}');
  let violation = false;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('child_process') || content.includes('exec(') || content.includes('spawn(')) {
      // 排除安全审计日志的 console 打印
      if (!file.includes('localAuditLogService')) {
        console.error(`❌ [Security Violation] Local Runner 中含有非法的系统命令执行逻辑: ${file}`);
        violation = true;
      }
    }
  }

  if (violation) {
    process.exit(1);
  } else {
    console.log('✅ [Check Passed] Local Runner 零原生 Shell 执行调用检查通过。');
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
