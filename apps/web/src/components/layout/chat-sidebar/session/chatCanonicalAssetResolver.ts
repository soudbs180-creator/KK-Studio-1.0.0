import {
  AssetListDtoSchema,
  CreateAssetResponseDtoSchema,
  type ApiResponse,
  type AssetDto,
  type AssetListDto,
  type CreateAssetRequestDto,
  type CreateAssetResponseDto,
} from '@kk/shared';
import type { Attachment, Message } from './chatSessionData';

const MAX_CHAT_ASSET_BYTES = 7 * 1024 * 1024;

export interface ChatAssetApi {
  listAssets(input?: { limit?: number }): Promise<ApiResponse<AssetListDto>>;
  createAsset(input: CreateAssetRequestDto): Promise<ApiResponse<CreateAssetResponseDto>>;
}

export interface CanonicalChatAssetContext {
  api: ChatAssetApi;
  ownerId: string;
  getOwnerId: () => string;
  approvedDocumentAttachmentIds: ReadonlySet<string>;
}

export type CanonicalChatAssetFailure =
  | 'unsupported_attachment'
  | 'document_approval_required'
  | 'invalid_attachment_data'
  | 'asset_api_unavailable'
  | 'invalid_asset_response'
  | 'owner_changed';

export type CanonicalChatAssetResult =
  | { ok: true; canonicalAssetIds: Record<string, string> }
  | { ok: false; reason: CanonicalChatAssetFailure };

interface PreparedAttachment {
  attachmentId: string;
  kind: Exclude<Attachment['type'], 'url'>;
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
  contentSha256: string;
}

function decodedBase64Size(payload: string): number | undefined {
  if (!payload || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return undefined;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const size = (payload.length * 3) / 4 - padding;
  return Number.isSafeInteger(size) && size > 0 ? size : undefined;
}

function mimeMatchesKind(mimeType: string, kind: PreparedAttachment['kind']): boolean {
  if (kind === 'image') return mimeType.startsWith('image/');
  if (kind === 'video') return mimeType.startsWith('video/');
  if (kind === 'audio') return mimeType.startsWith('audio/');
  return !/^(image|video|audio)\//.test(mimeType);
}

async function sha256(value: string): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function prepareAttachment(
  attachment: Attachment,
  approvedDocumentIds: ReadonlySet<string>,
): Promise<PreparedAttachment | CanonicalChatAssetResult> {
  if (attachment.type === 'url') return { ok: false, reason: 'unsupported_attachment' };
  if (attachment.type === 'document' && !approvedDocumentIds.has(attachment.id)) {
    return { ok: false, reason: 'document_approval_required' };
  }
  const match = attachment.data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/);
  const mimeType = String(attachment.mimeType || match?.[1] || '').trim().toLowerCase();
  const encodedMimeType = String(match?.[1] || '').trim().toLowerCase();
  const sizeBytes = match ? decodedBase64Size(match[2]) : undefined;
  if (!match || !sizeBytes || sizeBytes > MAX_CHAT_ASSET_BYTES
    || mimeType !== encodedMimeType || !mimeMatchesKind(mimeType, attachment.type)) {
    return { ok: false, reason: 'invalid_attachment_data' };
  }
  const contentSha256 = await sha256(attachment.data);
  if (!contentSha256) return { ok: false, reason: 'invalid_attachment_data' };
  return {
    attachmentId: attachment.id,
    kind: attachment.type,
    mimeType,
    dataUrl: attachment.data,
    sizeBytes,
    contentSha256,
  };
}

function isFailure(value: PreparedAttachment | CanonicalChatAssetResult): value is CanonicalChatAssetResult {
  return 'ok' in value;
}

async function prepareAll(
  messages: Message[],
  approvedDocumentIds: ReadonlySet<string>,
): Promise<PreparedAttachment[] | CanonicalChatAssetResult> {
  const preparedById = new Map<string, PreparedAttachment>();
  for (const attachment of messages.flatMap((message) => message.attachments || [])) {
    const prepared = await prepareAttachment(attachment, approvedDocumentIds);
    if (isFailure(prepared)) return prepared;
    const existing = preparedById.get(prepared.attachmentId);
    if (existing && existing.contentSha256 !== prepared.contentSha256) {
      return { ok: false, reason: 'invalid_attachment_data' };
    }
    preparedById.set(prepared.attachmentId, prepared);
  }
  return [...preparedById.values()];
}

function matchesPreparedAsset(asset: AssetDto, prepared: PreparedAttachment): boolean {
  return asset.kind === prepared.kind
    && asset.mimeType.toLowerCase() === prepared.mimeType
    && asset.metadata?.contentSha256 === prepared.contentSha256;
}

function contentAddressedAssetId(prepared: PreparedAttachment): string {
  return `chat_${prepared.contentSha256}`;
}

async function readAssets(context: CanonicalChatAssetContext): Promise<AssetDto[] | CanonicalChatAssetResult> {
  try {
    const response = await context.api.listAssets({ limit: 500 });
    if (context.getOwnerId() !== context.ownerId) return { ok: false, reason: 'owner_changed' };
    if (!response.success) return { ok: false, reason: 'asset_api_unavailable' };
    const parsed = AssetListDtoSchema.safeParse(response.data);
    return parsed.success ? parsed.data.items : { ok: false, reason: 'invalid_asset_response' };
  } catch {
    return { ok: false, reason: 'asset_api_unavailable' };
  }
}

async function createAsset(
  prepared: PreparedAttachment,
  context: CanonicalChatAssetContext,
): Promise<AssetDto | CanonicalChatAssetResult> {
  try {
    const response = await context.api.createAsset({
      id: contentAddressedAssetId(prepared),
      kind: prepared.kind,
      mimeType: prepared.mimeType,
      dataUrl: prepared.dataUrl,
      sizeBytes: prepared.sizeBytes,
      metadata: { source: 'chat-attachment', contentSha256: prepared.contentSha256 },
    });
    if (context.getOwnerId() !== context.ownerId) return { ok: false, reason: 'owner_changed' };
    if (!response.success) return { ok: false, reason: 'asset_api_unavailable' };
    const parsed = CreateAssetResponseDtoSchema.safeParse(response.data);
    if (!parsed.success
      || parsed.data.asset.id !== contentAddressedAssetId(prepared)
      || !matchesPreparedAsset(parsed.data.asset, prepared)) {
      return { ok: false, reason: 'invalid_asset_response' };
    }
    return parsed.data.asset;
  } catch {
    return { ok: false, reason: 'asset_api_unavailable' };
  }
}

/** Resolves Chat attachments to owner-visible canonical Assets before Session projection is allowed. */
export async function resolveCanonicalChatAssets(
  messages: Message[],
  context: CanonicalChatAssetContext,
): Promise<CanonicalChatAssetResult> {
  const prepared = await prepareAll(messages, context.approvedDocumentAttachmentIds);
  if (!Array.isArray(prepared)) return prepared;
  if (context.getOwnerId() !== context.ownerId) return { ok: false, reason: 'owner_changed' };
  if (prepared.length === 0) return { ok: true, canonicalAssetIds: {} };
  const assets = await readAssets(context);
  if (!Array.isArray(assets)) return assets;
  const canonicalAssetIds: Record<string, string> = {};
  for (const attachment of prepared) {
    const existing = assets.find((asset) => matchesPreparedAsset(asset, attachment));
    const resolved = existing || await createAsset(attachment, context);
    if ('ok' in resolved) return resolved;
    assets.push(resolved);
    canonicalAssetIds[attachment.attachmentId] = resolved.id;
  }
  return { ok: true, canonicalAssetIds };
}
