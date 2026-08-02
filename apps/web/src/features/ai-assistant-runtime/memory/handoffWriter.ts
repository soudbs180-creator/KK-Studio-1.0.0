// 简体中文：Agent 任务 Handoff 序列化与本地写盘工具 (Agent Task Handoff Writer)
// 职责：在任务终态将 Agent 运行记录序列化为 Markdown 并在 Node 环境下追加到 Handoff 记录中。

import type { AgentRunRecord } from '../runtime/AgentRunStore.ts';
import { redactToolText } from '../tools/ToolRegistry.ts';

const HANDOFF_STORAGE_PREFIX = 'kk_agent_handoffs:owner:';
const LEGACY_HANDOFF_STORAGE_KEY = 'kk_agent_handoffs';
const MAX_HANDOFF_STORAGE_LENGTH = 500_000;

const normalizeOwnerId = (ownerId: string): string => (
  String(ownerId || '').trim().slice(0, 200) || 'local_user'
);

export const getHandoffStorageKey = (ownerId: string): string => (
  `${HANDOFF_STORAGE_PREFIX}${encodeURIComponent(normalizeOwnerId(ownerId))}`
);

const markdownInline = (value: unknown): string => redactToolText(value)
  .replace(/\r?\n/g, ' ')
  .replace(/`/g, "'");

export function formatRunRecordToMarkdown(record: AgentRunRecord): string {
  const toolCallsMd = record.toolCalls && record.toolCalls.length > 0
    ? record.toolCalls.map((tc, index) => {
        return `${index + 1}. **${markdownInline(tc.toolName)}** [${markdownInline(tc.status.toUpperCase())}]
   - 开始时间: \`${markdownInline(tc.startedAt)}\`
   - 完成时间: \`${markdownInline(tc.completedAt || '未知')}\`
   - 输入摘要: \`${markdownInline(tc.inputSummary)}\`
   - 输出摘要: \`${markdownInline(tc.outputSummary || '无')}\`
   ${tc.error ? `- 错误信息: \`${markdownInline(tc.error)}\`` : ''}`;
      }).join('\n')
    : '（无工具调用）';

  return `
### Agent Run: ${markdownInline(record.id)}
- **时间**: \`${markdownInline(record.createdAt)}\`
- **用户指令**: "${markdownInline(record.userMessage).replace(/"/g, '\\"')}"
- **意图**: \`${markdownInline(record.intent)}\`
- **状态**: \`${markdownInline(record.status)}\`
${record.nextStep ? `- **下一步指引**: ${markdownInline(record.nextStep)}` : ''}

#### 🛠️ 工具调用记录
${toolCallsMd}

---
`;
}

export async function writeHandoff(
  record: AgentRunRecord,
  ownerId: string,
): Promise<void> {
  const mdContent = formatRunRecordToMarkdown(record);
  const normalizedOwnerId = normalizeOwnerId(ownerId);

  // 1. 在浏览器环境，尝试同步至本地存储或发送日志
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      const storageKey = getHandoffStorageKey(normalizedOwnerId);
      const existing = globalThis.localStorage.getItem(storageKey) || '';
      globalThis.localStorage.setItem(
        storageKey,
        `${existing}${mdContent}`.slice(-MAX_HANDOFF_STORAGE_LENGTH),
      );
      globalThis.localStorage.removeItem(LEGACY_HANDOFF_STORAGE_KEY);
    } catch (e) {
      console.error('[HandoffWriter] 浏览器端保存失败:', e);
    }
  }

  // 2. 如果在 Node 环境（如测试中），尝试直接写入本地文件
  try {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      if (
        process.env.KK_ENABLE_HANDOFF_FS_WRITE !== '1'
        || process.env.KK_DISABLE_HANDOFF_FS_WRITE === '1'
      ) {
        return;
      }
      const fs = await import(/* @vite-ignore */ 'node:fs');
      const path = await import(/* @vite-ignore */ 'node:path');
      const root = process.cwd();
      const configuredPath = String(process.env.KK_HANDOFF_FS_PATH || '').trim();
      const docsPath = configuredPath
        ? path.resolve(configuredPath)
        : path.join(root, 'docs', 'development', 'session-handoff.md');
      
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
