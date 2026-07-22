import {
  AgentSessionUpsertDtoSchema,
  type AgentSessionDto,
  type AgentSessionUpsertDto,
} from '@kk/shared';
import type { Attachment, ChatSessionItem, Message } from './chatSessionData';

export type ChatSessionProjectionFailure =
  | 'temporary_session'
  | 'unresolved_attachment'
  | 'unsupported_attachment'
  | 'invalid_projection';

export interface ChatSessionProjectionEvidence {
  ownerId: AgentSessionDto['ownerId'];
  collaborationMode: AgentSessionUpsertDto['collaborationMode'];
  summary: AgentSessionUpsertDto['summary'];
  tokenBudget: AgentSessionUpsertDto['tokenBudget'];
  canonicalAssetIds: Readonly<Record<string, string>>;
  createdAt: string;
  heartbeatAt: string;
  authoritativeBase?: AgentSessionDto;
}

export type ChatSessionProjectionResult =
  | { ok: true; data: AgentSessionUpsertDto }
  | { ok: false; reason: ChatSessionProjectionFailure };

type ProjectedAttachment = NonNullable<AgentSessionUpsertDto['messages'][number]['attachments']>[number];
type ProjectedMessage = AgentSessionUpsertDto['messages'][number];
type ProjectionFailure = { ok: false; reason: ChatSessionProjectionFailure };
type AttachmentProjectionResult =
  | { ok: true; data: ProjectedAttachment }
  | ProjectionFailure;
type MessageProjectionResult =
  | { ok: true; data: ProjectedMessage }
  | { ok: false; reason: ChatSessionProjectionFailure };

function toIsoString(value: number | string): string | undefined {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function mapAttachment(
  attachment: Attachment,
  canonicalAssetIds: Readonly<Record<string, string>>,
): AttachmentProjectionResult {
  if (attachment.type === 'url') return { ok: false, reason: 'unsupported_attachment' };
  const assetId = canonicalAssetIds[attachment.id]?.trim();
  if (!assetId) return { ok: false, reason: 'unresolved_attachment' };
  return {
    ok: true,
    data: {
      assetId,
      kind: attachment.type,
      name: attachment.name,
      mimeType: attachment.mimeType,
    },
  };
}

function mapMessage(
  message: Message,
  canonicalAssetIds: Readonly<Record<string, string>>,
): MessageProjectionResult {
  const createdAt = toIsoString(message.timestamp);
  if (!createdAt) return { ok: false, reason: 'invalid_projection' };
  const attachments: ProjectedAttachment[] = [];
  for (const attachment of message.attachments || []) {
    const projected = mapAttachment(attachment, canonicalAssetIds);
    if (!projected.ok) return projected;
    attachments.push(projected.data);
  }
  return {
    ok: true,
    data: {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt,
      modelId: message.modelId,
      attachments: attachments.length > 0 ? attachments : undefined,
    },
  };
}

function preserveAuthoritativeState(base?: AgentSessionDto) {
  return {
    toolResults: base?.toolResults || [],
    knowledgeRefs: base?.knowledgeRefs || [],
    confirmations: base?.confirmations || [],
    checkpoints: base?.checkpoints || [],
  };
}

/** Builds a write candidate only from explicit safe evidence; it never infers Asset ids from Chat data. */
export function buildAgentSessionProjection(
  session: ChatSessionItem,
  evidence: ChatSessionProjectionEvidence,
): ChatSessionProjectionResult {
  if (session.isTemp) return { ok: false, reason: 'temporary_session' };
  if (evidence.authoritativeBase && (
    evidence.authoritativeBase.sessionId !== session.id
    || evidence.authoritativeBase.ownerId !== evidence.ownerId
  )) {
    return { ok: false, reason: 'invalid_projection' };
  }
  const evidencedCreatedAt = toIsoString(evidence.createdAt);
  if (evidence.authoritativeBase && evidence.authoritativeBase.createdAt !== evidencedCreatedAt) {
    return { ok: false, reason: 'invalid_projection' };
  }
  const createdAt = evidence.authoritativeBase?.createdAt || evidencedCreatedAt;
  const updatedAt = toIsoString(session.updatedAt);
  if (!createdAt || !updatedAt) return { ok: false, reason: 'invalid_projection' };
  const messages: ProjectedMessage[] = [];
  for (const message of session.messages.filter((candidate) => candidate.id !== 'welcome')) {
    const projected = mapMessage(message, evidence.canonicalAssetIds);
    if (!projected.ok) return projected;
    messages.push(projected.data);
  }
  if (evidence.summary.coveredMessageCount > messages.length) {
    return { ok: false, reason: 'invalid_projection' };
  }
  const candidate = AgentSessionUpsertDtoSchema.safeParse({
    sessionId: session.id,
    collaborationMode: evidence.collaborationMode,
    messages,
    summary: evidence.summary,
    tokenBudget: evidence.tokenBudget,
    ...preserveAuthoritativeState(evidence.authoritativeBase),
    lastHeartbeatAt: evidence.heartbeatAt,
    createdAt,
    updatedAt,
  });
  return candidate.success
    ? { ok: true, data: candidate.data }
    : { ok: false, reason: 'invalid_projection' };
}
