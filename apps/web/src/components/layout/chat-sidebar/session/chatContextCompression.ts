import type { ChatAgentSummary, ChatSessionItem, Message } from './chatSessionData';

const COMPRESSION_BOUNDARY_MARKER = '上下文压缩分界线';
const MAX_SUMMARY_CHARACTERS = 32_000;
const MAX_COVERED_MESSAGES = 10_000;

/** Minimal history and logical coverage passed to the compression model. */
export interface PreparedChatContextCompression {
  coveredMessageCount: number;
  history: Array<Pick<Message, 'role' | 'content'>>;
}

interface ChatContextCompressionInput {
  coveredMessageCount: number;
  modelId: string;
  summaryText: string;
  timestamp: number;
}

/** Atomic canonical and compatibility projections produced by one compression response. */
export interface ChatContextCompressionResult {
  boundaryMessage: Message;
  summary: ChatAgentSummary;
}

/** Identifies compatibility boundary messages without treating their content as canonical summary state. */
export function isChatCompressionBoundary(message: Message): boolean {
  return message.content.includes(COMPRESSION_BOUNDARY_MARKER);
}

function findLatestBoundaryIndex(messages: Message[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isChatCompressionBoundary(messages[index])) return index;
  }
  return -1;
}

/** Prepares the LLM compression history and counts logical messages covered across repeated compressions. */
export function prepareChatContextCompression(messages: Message[]): PreparedChatContextCompression {
  const boundaryIndex = findLatestBoundaryIndex(messages);
  const compressionInput = boundaryIndex >= 0 ? messages.slice(boundaryIndex) : messages;
  const history = compressionInput
    .filter((message) => message.id !== 'welcome')
    .map(({ role, content }) => ({ role, content }));
  const coveredMessageCount = messages.filter((message) => (
    message.id !== 'welcome' && !isChatCompressionBoundary(message)
  )).length;
  return { coveredMessageCount, history };
}

function normalizeSummary(input: ChatContextCompressionInput): ChatAgentSummary | null {
  const text = input.summaryText.trim().slice(0, MAX_SUMMARY_CHARACTERS);
  const validCount = Number.isInteger(input.coveredMessageCount)
    && input.coveredMessageCount >= 0
    && input.coveredMessageCount <= MAX_COVERED_MESSAGES;
  const timestamp = new Date(input.timestamp).getTime();
  if (!text || !validCount || !Number.isFinite(timestamp)) return null;
  return {
    text,
    coveredMessageCount: input.coveredMessageCount,
    updatedAt: new Date(timestamp).toISOString(),
  };
}

/** Produces canonical summary evidence plus the existing UI boundary message from one validated result. */
export function createChatContextCompression(
  input: ChatContextCompressionInput,
): ChatContextCompressionResult | null {
  const summary = normalizeSummary(input);
  if (!summary) return null;
  const boundaryMessage: Message = {
    id: `boundary_${input.timestamp}`,
    role: 'assistant',
    content: `--- 📌 上下文压缩分界线 (已归档历史) ---\n以下是此前对话内容的摘要总结：\n\n${summary.text}\n\n此前的历史已被压缩归档，后续对话将基于此摘要进行。`,
    timestamp: input.timestamp,
    modelId: input.modelId,
  };
  return { boundaryMessage, summary };
}

/** Commits one compression result to its source Session without duplicating a retried boundary. */
export function applyChatContextCompression(
  sessions: ChatSessionItem[],
  sessionId: string,
  compression: ChatContextCompressionResult,
): ChatSessionItem[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const hasBoundary = session.messages.some((message) => message.id === compression.boundaryMessage.id);
    return {
      ...session,
      messages: hasBoundary ? session.messages : [...session.messages, compression.boundaryMessage],
      agentSummary: compression.summary,
      updatedAt: new Date(compression.summary.updatedAt).getTime(),
    };
  });
}
