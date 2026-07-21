import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const handoffPath = path.join(rootDir, 'docs/development/session-handoff.md');

// Git 不可用与“命令成功但无输出”必须分开，否则会把未知状态误报为干净。
function runGit(args) {
  try {
    return {
      ok: true,
      output: execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim(),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// 辅助函数：解析 session-handoff.md 提取最新一条修改
function getLatestHandoffSummary() {
  if (!fs.existsSync(handoffPath)) {
    return 'No handoff file found';
  }
  const content = fs.readFileSync(handoffPath, 'utf8');
  // 匹配形如 "## [数字]. [日期] - [说明]" 的标题
  const regex = /##\s+(\d+)\.\s+([\d-]+)\s+-\s+([^\n]+)/g;
  let matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push({
      index: match[1],
      date: match[2],
      title: match[3].trim()
    });
  }
  if (matches.length > 0) {
    return matches[matches.length - 1]; // 返回最新一条
  }
  return null;
}

function printHandoffSummary() {
  const handoff = getLatestHandoffSummary();
  console.log('最新追加的 Handoff 交接记录：');
  if (!handoff) {
    console.log('   未解析到 session-handoff.md 的最新交接记录');
    return;
  }
  console.log(`   序列:    #${handoff.index}`);
  console.log(`   日期:    ${handoff.date}`);
  console.log(`   修改说明: ${handoff.title}`);
}

function printStatus() {
  console.log('\n==================================================');
  console.log('         AI Agent Synchronization Guard           ');
  console.log('==================================================\n');
  const statusResult = runGit(['status', '--porcelain']);
  if (!statusResult.ok) {
    console.error('❌ 【未知】Git 不可用，无法确认工作区是否干净。');
    console.error('请安装 Git 或将 git 可执行文件加入 PATH 后重新运行 agents:status。');
    console.error(`诊断信息：${statusResult.error}`);
    process.exitCode = 1;
    return;
  }
  if (statusResult.output) {
    console.log('⚠️  【警告】当前工作区存在未提交的修改！');
    console.log(statusResult.output.split('\n').map(line => `   ${line}`).join('\n'));
  } else {
    console.log('✅ 【干净】工作区无未提交的修改，可安全拉取代码或执行其他操作。');
  }
  console.log('\n--------------------------------------------------');
  const logResult = runGit(['log', '-n', '3', '--oneline']);
  console.log('最近 3 次 Git 提交历史：');
  console.log(logResult.ok && logResult.output
    ? logResult.output.split('\n').map(line => `   * ${line}`).join('\n')
    : '   无法读取 Git log');
  console.log('\n--------------------------------------------------');
  printHandoffSummary();
  console.log('\n==================================================\n');
}

function commitChanges() {
  console.log('🚀 正在启动自动同步提交流程...');
  const statusResult = runGit(['status', '--porcelain']);
  if (!statusResult.ok) {
    console.error('❌ Git 不可用，无法安全检查或提交工作区。请修复 PATH 后重试。');
    process.exitCode = 1;
    return;
  }
  if (!statusResult.output) {
    console.log('ℹ️  当前工作区没有检测到任何修改，无需提交。');
    return;
  }
  const handoff = getLatestHandoffSummary();
  const cleanTitle = handoff?.title?.replace(/\(本次追加\)/g, '').trim();
  const commitMessage = cleanTitle
    ? `[Agent Sync] #${handoff.index} ${cleanTitle}`
    : '[Agent Sync] Automated synchronization commit';
  try {
    execFileSync('git', ['add', '.'], { cwd: rootDir });
    const result = execFileSync('git', ['commit', '-m', commitMessage, '--no-verify'], {
      cwd: rootDir,
      encoding: 'utf8',
    });
    console.log('\n✅ 提交成功！');
    console.log(result);
  } catch (error) {
    console.error('❌ Git commit 执行失败：', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--status') || args.length === 0) printStatus();
  if (args.includes('--commit')) commitChanges();
}

main();
