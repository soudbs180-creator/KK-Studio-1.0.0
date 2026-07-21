/**
 * @file scripts/test/run-tests.mjs
 * @description Node 测试启动器。根据当前 Node 主版本自动选择正确的 test-isolation
 *              标志（Node 22 使用 --experimental-test-isolation，Node 24+ 使用 --test-isolation），
 *              让 `npm run test:*` 在不同 Node 版本下都能直接运行。
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

const nodeMajor = Number(process.versions.node.split('.')[0]);
const isolationFlag = nodeMajor >= 24 ? '--test-isolation' : '--experimental-test-isolation';

const args = process.argv.slice(2);
const [isolationMode, ...testPatterns] = args;

if (!isolationMode || testPatterns.length === 0) {
  console.error('Usage: node scripts/test/run-tests.mjs <isolation-mode> <test-pattern> [<test-pattern> ...]');
  process.exit(1);
}

const nodeArgs = [
  '--import',
  './scripts/test/set-log-level.mjs',
  '--test',
];

if (isolationMode !== 'default') {
  nodeArgs.push(`${isolationFlag}=${isolationMode}`);
}

nodeArgs.push(...testPatterns);

const child = spawn(process.execPath, nodeArgs, { stdio: 'inherit' });
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
