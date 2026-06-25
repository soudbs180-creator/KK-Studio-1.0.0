import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const handoffPath = path.join(rootDir, 'docs/development/session-handoff.md');

// 辅助函数：运行 git 命令并获取输出
function runGit(cmd) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
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

// 主逻辑
function main() {
  const args = process.argv.slice(2);
  const isCommitMode = args.includes('--commit');
  const isStatusMode = args.includes('--status') || args.length === 0;

  if (isStatusMode) {
    console.log('\n==================================================');
    console.log('         AI Agent Synchronization Guard           ');
    console.log('==================================================\n');

    // 1. 检查 Git 状态
    const status = runGit('git status --porcelain');
    if (status) {
      console.log('⚠️  【警告】当前工作区存在未提交的修改！');
      console.log('在交接或切换 Agent 前，请务必进行 commit 固化以防代码被覆盖。\n');
      console.log('未提交的文件列表：');
      console.log(status.split('\n').map(line => `   ${line}`).join('\n'));
      console.log('\n建议执行提交命令：npm run agents:commit');
    } else {
      console.log('✅ 【干净】工作区无未提交的修改，可安全拉取代码或执行其他操作。');
    }

    console.log('\n--------------------------------------------------');
    
    // 2. 检查 Git 最近提交历史
    const gitLog = runGit('git log -n 3 --oneline');
    console.log('最近 3 次 Git 提交历史：');
    if (gitLog) {
      console.log(gitLog.split('\n').map(line => `   * ${line}`).join('\n'));
    } else {
      console.log('   无法读取 Git log');
    }

    console.log('\n--------------------------------------------------');

    // 3. 检查 Handoff 文档
    const handoff = getLatestHandoffSummary();
    console.log('最新追加的 Handoff 交接记录：');
    if (handoff) {
      console.log(`   序列:    #${handoff.index}`);
      console.log(`   日期:    ${handoff.date}`);
      console.log(`   修改说明: ${handoff.title}`);
    } else {
      console.log('   未解析到 session-handoff.md 的最新交接记录');
    }
    console.log('\n==================================================\n');
  }

  if (isCommitMode) {
    console.log('🚀 正在启动自动同步提交流程...');
    
    // 1. 先检查有没有修改
    const status = runGit('git status --porcelain');
    if (!status) {
      console.log('ℹ️  当前工作区没有检测到任何修改，无需提交。');
      process.exit(0);
    }

    // 2. 提取 commit message
    const handoff = getLatestHandoffSummary();
    let commitMsg = '';
    if (handoff && handoff.title) {
      // 提取标题，去掉 "(本次追加)" 等字样
      const cleanTitle = handoff.title.replace(/\(本次追加\)/g, '').trim();
      commitMsg = `[Agent Sync] #${handoff.index} ${cleanTitle}`;
    } else {
      commitMsg = `[Agent Sync] Automated synchronization commit`;
    }

    console.log(`📝 自动匹配到的提交描述: "${commitMsg}"`);

    try {
      console.log('📦 执行 git add . ...');
      execSync('git add .', { cwd: rootDir });
      
      console.log(`💾 执行 git commit -m "${commitMsg}" --no-verify ...`);
      const commitResult = execSync(`git commit -m "${commitMsg}" --no-verify`, { cwd: rootDir, encoding: 'utf8' });
      console.log('\n✅ 提交成功！');
      console.log(commitResult);
    } catch (e) {
      console.error('❌ Git commit 执行失败：', e.message);
      process.exit(1);
    }
  }
}

main();
