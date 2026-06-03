import { extractRefImageData } from './LLMAdapter.ts';
import type { ProviderPricingSnapshot } from '../auth/providerPricingSnapshot';
import type { WuyinCatalogItem } from './wuyinCatalog.ts';
import {
  WUYIN_DEFAULT_CATALOG,
  WUYIN_DEFAULT_BASE_URL,
  WUYIN_ASYNC_DETAIL_PATH,
} from './wuyinCatalog.ts';

export { WUYIN_ASYNC_DETAIL_PATH };

export type WuyinResolvedRoute = {
  endpointPath: string;
  endpointModelId: string;
  endpointUrl?: string;
  apiStyle?: string;
  detailPath?: string;
  submitContentType?: string;
};

export type WuyinProviderSnapshotSource = {
  pricingSnapshot?: ProviderPricingSnapshot | null;
};

export function normalizeWuyinBaseUrl(baseUrl: string): string {
  const raw = String(baseUrl || '').trim();
  if (!raw) return WUYIN_DEFAULT_BASE_URL;

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withProtocol);
    if (/^api\.wuyinkeji\.com$/i.test(parsed.hostname)) {
      return `${parsed.protocol}//${parsed.host}`;
    }

    const sanitizedPath = parsed.pathname
      .replace(/\/+(doc\/\d+)?$/i, '')
      .replace(/\/+(api\/async\/[a-z0-9_.-]+)$/i, '')
      .replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${sanitizedPath}`;
  } catch {
    return WUYIN_DEFAULT_BASE_URL;
  }
}

export function extractWuyinDirectEndpointPath(targetUrl: string): string | null {
  const raw = String(targetUrl || '').trim();
  if (!raw) return null;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    const path = parsed.pathname;
    if (/^\/api\/async\/[a-z0-9_.-]+$/i.test(path)) {
      return path;
    }
    return null;
  } catch {
    return null;
  }
}

export function normalizeWuyinModelId(value: string): string {
  return String(value || '')
    .trim()
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '');
}

export function findWuyinCatalogItem(
  modelId: string,
  catalog: WuyinCatalogItem[] = WUYIN_DEFAULT_CATALOG
): WuyinCatalogItem | null {
  const normalized = normalizeWuyinModelId(modelId);

  return catalog.find(item => {
    if (normalizeWuyinModelId(item.id) === normalized) return true;
    if (normalizeWuyinModelId(item.name) === normalized) return true;
    if (normalizeWuyinModelId((item as any).model) === normalized) return true;
    if (normalizeWuyinModelId(item.endpointPath.split('/').pop() || '') === normalized) return true;
    const aliases = item.aliases || [];
    return aliases.some(alias => normalizeWuyinModelId(alias) === normalized);
  }) || null;
}

function getCatalogFromProviderSnapshot(provider?: WuyinProviderSnapshotSource | null): WuyinCatalogItem[] | null {
  const snapshot = provider?.pricingSnapshot;
  if (!snapshot) return null;
  const rows = snapshot.rows || snapshot._rawData;
  if (Array.isArray(rows)) {
    return rows as WuyinCatalogItem[];
  }
  return null;
}

export function resolveWuyinRequestRoute(input: {
  baseUrl?: string;
  modelId: string;
  provider?: WuyinProviderSnapshotSource | null;
  catalog?: WuyinCatalogItem[];
}): WuyinResolvedRoute {
  const catalog = input.catalog || getCatalogFromProviderSnapshot(input.provider) || WUYIN_DEFAULT_CATALOG;
  const item = findWuyinCatalogItem(input.modelId, catalog);

  if (!item) {
    const directPath = input.baseUrl ? extractWuyinDirectEndpointPath(input.baseUrl) : null;
    if (directPath) {
      const normalizedModel = normalizeWuyinModelId(input.modelId);
      return {
        endpointPath: `/api/async/${normalizedModel}`,
        endpointModelId: input.modelId,
      };
    }
    throw new Error(`速创 API 暂不认识模型 "${input.modelId}"。请从速创模型目录选择模型，不要手动输入未知模型。`);
  }

  const result: WuyinResolvedRoute = {
    endpointPath: item.endpointPath,
    endpointModelId: item.id || item.endpointPath.split('/').pop() || '',
  };
  if (input.provider || 'endpointUrl' in item) {
    result.endpointUrl = (item as any).endpointUrl;
  }
  return result;
}

export function normalizeWuyinImageSize(raw: string | undefined): '1K' | '2K' | '4K' {
  const normalized = String(raw || '').trim().toUpperCase();
  if (normalized.includes('4K') || normalized.includes('HD')) return '4K';
  if (normalized.includes('2K')) return '2K';
  return '1K';
}

export function normalizeWuyinAspectRatio(raw: string | undefined): string {
  const normalized = String(raw || '').trim() || 'auto';
  const supported = new Set(['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9']);
  return supported.has(normalized) ? normalized : 'auto';
}

export function normalizeWuyinReferenceImage(
  ref: string | { data: string; mimeType: string; url?: string },
  index: number
): { value: string; kind: 'url' | 'base64' } {
  const sourceUrl = typeof (ref as any)?.url === 'string' ? String((ref as any).url || '').trim() : '';
  if (/^https?:\/\//i.test(sourceUrl)) {
    return { value: sourceUrl, kind: 'url' };
  }

  const { data } = extractRefImageData(ref);
  const raw = String(data || '').trim();
  if (!raw) {
    throw new Error(`五音参考图 ${index + 1} 为空，请重新上传后再试`);
  }

  if (/^https?:\/\//i.test(raw)) {
    return { value: raw, kind: 'url' };
  }

  if (/^blob:/i.test(raw)) {
    throw new Error(`五音参考图 ${index + 1} 仍是本地预览地址（blob），请等待图片处理完成后再试`);
  }

  if (/^data:/i.test(raw)) {
    const commaIndex = raw.indexOf(',');
    if (commaIndex === -1) {
      throw new Error(`五音参考图 ${index + 1} 不是有效的 Base64 数据`);
    }
    const base64 = raw.slice(commaIndex + 1).replace(/\s+/g, '');
    if (!base64) {
      throw new Error(`五音参考图 ${index + 1} 的 Base64 数据为空`);
    }
    return { value: base64, kind: 'base64' };
  }

  const cleaned = raw.replace(/\s+/g, '');
  if (!cleaned) {
    throw new Error(`五音参考图 ${index + 1} 不是有效的 URL 或 Base64 数据`);
  }

  return { value: cleaned, kind: 'base64' };
}

export function extractWuyinTaskId(payload: unknown): string {
  const p = payload as any;
  if (!p) return '';
  return String(
    p.data?.id || p.id || p.task_id || p.taskId || p.data?.task_id || p.data?.taskId || ''
  ).trim();
}

export function extractWuyinStatusCode(payload: unknown): number | string | undefined {
  const p = payload as any;
  if (!p) return undefined;
  const value = p.data?.status ?? p.status;
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  if (!isNaN(num)) return num;
  return value;
}

export function mapWuyinStatus(statusCode: number | string | undefined): 'pending' | 'processing' | 'success' | 'failed' {
  if (statusCode === undefined || statusCode === null) return 'pending';
  const word = String(statusCode).trim().toLowerCase();
  if (word === 'success' || word === 'succeeded' || word === 'done' || word === '2') {
    return 'success';
  }
  if (word === 'failed' || word === 'fail' || word === 'error' || word === '3') {
    return 'failed';
  }
  if (word === 'processing' || word === 'running' || word === '1') {
    return 'processing';
  }
  return 'pending';
}

export function extractWuyinFailureMessage(payload: unknown): string {
  const p = payload as any;
  if (!p) return 'Unknown error';
  return String(
    p.data?.fail_reason ||
    p.data?.message ||
    p.data?.error ||
    p.fail_reason ||
    p.message ||
    p.msg ||
    p.error ||
    JSON.stringify(payload)
  );
}

export function extractWuyinOutputUrls(payload: unknown): string[] {
  const urls: string[] = [];
  const p = payload as any;
  if (!p) return urls;

  const checkAndAdd = (val: any) => {
    if (typeof val === 'string' && val.trim() && /^https?:\/\//i.test(val.trim())) {
      urls.push(val.trim());
    } else if (Array.isArray(val)) {
      val.forEach(item => {
        if (typeof item === 'string' && item.trim() && /^https?:\/\//i.test(item.trim())) {
          urls.push(item.trim());
        }
      });
    }
  };

  if (p.data && typeof p.data === 'object') {
    const d = p.data;
    checkAndAdd(d.image_url);
    checkAndAdd(d.video_url);
    checkAndAdd(d.videoUrl);
    checkAndAdd(d.audio_url);
    checkAndAdd(d.audioUrl);
    checkAndAdd(d.url);
    checkAndAdd(d.urls);
    checkAndAdd(d.output);
    checkAndAdd(d.outputs);
  }

  checkAndAdd(p.image_url);
  checkAndAdd(p.video_url);
  checkAndAdd(p.videoUrl);
  checkAndAdd(p.audio_url);
  checkAndAdd(p.audioUrl);
  checkAndAdd(p.url);
  checkAndAdd(p.urls);
  checkAndAdd(p.output);
  checkAndAdd(p.outputs);

  return Array.from(new Set(urls));
}

export function buildWuyinImageSubmitBody(input: {
  prompt: string;
  imageSize?: string;
  aspectRatio?: string;
  referenceImages?: Array<string | { data: string; mimeType: string; url?: string }>;
}): Record<string, unknown> {
  const resolvedSize = normalizeWuyinImageSize(input.imageSize);
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    size: resolvedSize,
    aspectRatio: normalizeWuyinAspectRatio(input.aspectRatio),
  };

  if (input.referenceImages && input.referenceImages.length > 0) {
    const urls = input.referenceImages.map((ref, index) =>
      normalizeWuyinReferenceImage(ref, index).value
    );
    body.urls = urls;
  }

  return body;
}

export function resolveWuyinVideoSize(input: {
  aspectRatio?: string;
  resolution?: string;
  size?: string;
}): string {
  const explicitSize = String(input.size || '').trim();
  if (/^\d+x\d+$/i.test(explicitSize)) {
    return explicitSize.toLowerCase();
  }

  const rawAspectRatio = String(input.aspectRatio || '').trim();
  const aspectRatio = rawAspectRatio === '9:16' || rawAspectRatio === '1:1' ? rawAspectRatio : '16:9';
  const normalizedResolution = String(input.resolution || '').trim().toLowerCase();
  const resolution = normalizedResolution.includes('1080') ? '1080p' : '720p';

  const sizeMap: Record<'720p' | '1080p', Record<'16:9' | '9:16' | '1:1', string>> = {
    '720p': {
      '16:9': '1280x720',
      '9:16': '720x1280',
      '1:1': '720x720',
    },
    '1080p': {
      '16:9': '1920x1080',
      '9:16': '1080x1920',
      '1:1': '1080x1080',
    },
  };

  return sizeMap[resolution][aspectRatio];
}

export function resolveWuyinVideoDuration(duration?: number, videoDuration?: string): string {
  if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
    return String(Math.round(duration));
  }

  const parsed = Number.parseFloat(String(videoDuration || '').trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return String(Math.round(parsed));
  }

  return '10';
}

export function normalizeWuyinVideoImages(imageUrl?: string, imageTailUrl?: string): string {
  const rawItems = [imageUrl, imageTailUrl]
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  if (rawItems.length === 0) {
    return '';
  }

  const normalized = rawItems.slice(0, 7).map((item, index) => {
    if (/^blob:/i.test(item)) {
      throw new Error(`Wuyin video reference image ${index + 1} is a local blob URL. Please use a public HTTPS image URL.`);
    }
    if (/^data:/i.test(item) || (/^[a-z0-9+/=\s]+$/i.test(item) && item.length > 80)) {
      throw new Error(`Wuyin video reference image ${index + 1} must be a public HTTPS image URL; base64 upload is not supported yet.`);
    }
    if (!/^https?:\/\//i.test(item)) {
      throw new Error(`Wuyin video reference image ${index + 1} must be a public HTTP(S) image URL.`);
    }
    return item;
  });

  return normalized.join(',');
}

export function buildWuyinVideoSubmitBody(input: {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  size?: string;
  duration?: number;
  videoDuration?: string;
  imageUrl?: string;
  imageTailUrl?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = { prompt: input.prompt };

  const size = resolveWuyinVideoSize(input);
  if (size) body.size = size;

  const duration = resolveWuyinVideoDuration(input.duration, input.videoDuration);
  if (duration) body.duration = duration;

  const images = normalizeWuyinVideoImages(input.imageUrl, input.imageTailUrl);
  if (images) body.images = images;

  return body;
}

export function buildWuyinChatBody(input: {
  content: string;
  modelId?: string;
  stream?: boolean;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set('content', input.content);
  params.set('model', input.modelId || 'gemini-3-pro');
  params.set('stream', input.stream ? 'true' : 'false');
  return params;
}

export function buildWuyinAudioSubmitBody(input: {
  prompt: string;
  voiceId?: string;
  speed?: number;
  audioDuration?: string | number;
  audioLyrics?: string;
  audioStyle?: string;
  audioTitle?: string;
}): Record<string, unknown> {
  return {
    prompt: input.prompt,
    text: input.prompt,
    voice_id: input.voiceId,
    speed: input.speed,
    duration: input.audioDuration,
    lyrics: input.audioLyrics,
    style: input.audioStyle,
    title: input.audioTitle,
  };
}
