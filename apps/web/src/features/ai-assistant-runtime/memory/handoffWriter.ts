// 简体中文：Agent 任务 Handoff 序列化与本地写盘工具 (Agent Task Handoff Writer)
// 职责：在任务终态将 Agent 运行记录序列化为 Markdown 并在 Node 环境下追加到 Handoff 记录中。

import type { AgentRunRecord } from '../runtime/AgentRunStore.ts';

export function formatRunRecordToMarkdown(record: AgentRunRecord): string {
  const toolCallsMd = record.toolCalls && record.toolCalls.length > 0
    ? record.toolCalls.map((tc, index) => {
        return `${index + 1}. **${tc.toolName}** [${tc.status.toUpperCase()}]
   - 开始时间: \`${tc.startedAt}\`
   - 完成时间: \`${tc.completedAt || '未知'}\`
   - 输入摘要: \`${tc.inputSummary}\`
   - 输出摘要: \`${tc.outputSummary || '无'}\`
   ${tc.error ? `- 错误信息: \`${tc.error}\`` : ''}`;
      }).join('\n')
    : '（无工具调用）';

  return `
### Agent Run: ${record.id}
- **时间**: \`${record.createdAt}\`
- **用户指令**: "${record.userMessage}"
- **意图**: \`${record.intent}\`
- **状态**: \`${record.status}\`
${record.nextStep ? `- **下一步指引**: ${record.nextStep}` : ''}

#### 🛠️ 工具调用记录
${toolCallsMd}

---
`;
}

export async function writeHandoff(record: AgentRunRecord): Promise<void> {
  const mdContent = formatRunRecordToMarkdown(record);

  // 1. 在浏览器环境，尝试同步至本地存储或发送日志
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      const existing = globalThis.localStorage.getItem('kk_agent_handoffs') || '';
      globalThis.localStorage.setItem('kk_agent_handoffs', existing + mdContent);
    } catch (e) {
      console.error('[HandoffWriter] 浏览器端保存失败:', e);
    }
  }

  // 2. 如果在 Node 环境（如测试中），尝试直接写入本地文件
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const fs = await import(/* @vite-ignore */ 'node:fs');
      const path = await import(/* @vite-ignore */ 'node:path');
      const root = process.cwd();
      const docsPath = path.join(root, 'docs', 'development', 'session-handoff.md');
      
      if (fs.existsSync(docsPath)) {
        fs.appendFileSync(docsPath, mdContent, 'utf8');
      } else {
        const dir = path.dirname(docsPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(docsPath, `# Session Handoff\n${mdContent}`, 'utf8');
      }
    }
  } catch (err) {
    console.debug('[HandoffWriter] Node.js fs write bypassed or failed:', err);
  }
}
