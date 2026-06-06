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
  contentType?: string;
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
  const directPath = input.baseUrl ? extractWuyinDirectEndpointPath(input.baseUrl) : null;
  if (directPath) {
    const directItem = catalog.find(item => item.endpointPath.toLowerCase() === directPath.toLowerCase());
    return {
      endpointPath: directPath,
      endpointModelId: directItem?.id || directPath.split('/').pop() || input.modelId,
      endpointUrl: directItem ? (directItem as any).endpointUrl : undefined,
      contentType: directItem ? ((directItem as any).contentType || (directItem as any).submitContentType) : undefined,
      submitContentType: directItem ? (directItem as any).submitContentType : undefined,
      detailPath: directItem ? (directItem as any).detailPath : undefined,
    };
  }

  const item = findWuyinCatalogItem(input.modelId, catalog);

  if (!item) {
    throw new Error(`速创 API 暂不认识模型 "${input.modelId}"。请从速创模型目录选择模型，不要手动输入未知模型。`);
  }

  const result: WuyinResolvedRoute = {
    endpointPath: item.endpointPath,
    endpointModelId: item.id || item.endpointPath.split('/').pop() || '',
  };
  if (input.provider || 'endpointUrl' in item) {
    result.endpointUrl = (item as any).endpointUrl;
  }
  result.contentType = (item as any).contentType || (item as any).submitContentType;
  result.submitContentType = (item as any).submitContentType;
  result.detailPath = (item as any).detailPath;
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

function normalizeWuyinEndpointModelId(input: { modelId?: string; endpointPath?: string }): string {
  const raw = String(input.modelId || input.endpointPath?.split('/').pop() || '')
    .trim()
    .split('@')[0]
    .split('|')[0]
    .replace(/^models\//i, '')
    .replace(/^\/+/, '')
    .replace(/^api\/async\//i, '');
  return raw || 'image_nanoBanana2';
}

function normalizeWuyinGptImageRatio(raw: string | undefined): string {
  const normalized = String(raw || '').trim() || 'auto';
  const supported = new Set(['auto', '1:1', '3:2', '2:3', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21', '1:3', '3:1', '2:1', '1:2']);
  return supported.has(normalized) ? normalized : 'auto';
}

function normalizeWuyinGrokAspectRatio(raw: string | undefined): string {
  const normalized = String(raw || '').trim() || '2:3';
  const supported = new Set(['2:3', '3:2', '1:1', '16:9', '9:16']);
  if (normalized === 'auto') return '2:3';
  return supported.has(normalized) ? normalized : '2:3';
}

function normalizeWuyinVideoAspectRatio(raw: string | undefined): string {
  const normalized = String(raw || '').trim();
  return ['16:9', '9:16', '1:1', '4:3', '3:4'].includes(normalized) ? normalized : '16:9';
}

function normalizeWuyinWanPixelSize(input: {
  size?: string;
  imageSize?: string;
  resolution?: string;
  aspectRatio?: string;
  defaultSize?: string;
}): string {
  const explicit = String(input.size || input.imageSize || input.resolution || '').trim();
  if (/^\d{3,4}[*x]\d{3,4}$/i.test(explicit)) {
    return explicit.replace(/x/i, '*');
  }

  const map: Record<string, string> = {
    '1:1': '1280*1280',
    '3:4': '1104*1472',
    '4:3': '1472*1104',
    '9:16': '960*1696',
    '16:9': '1696*960',
  };
  return map[String(input.aspectRatio || '').trim()] || input.defaultSize || '1280*1280';
}

function normalizeWuyinVideoResolution(raw: string | undefined): string {
  const normalized = String(raw || '').trim().toLowerCase();
  if (normalized.includes('4k')) return '4k';
  if (normalized.includes('1080')) return '1080p';
  if (normalized.includes('540')) return '540p';
  if (normalized.includes('std')) return 'std';
  if (normalized.includes('pro')) return 'pro';
  return '720p';
}

function normalizeWuyinVideoDurationValue(raw: unknown, fallback = '10'): string {
  const parsed = Number.parseFloat(String(raw ?? '').trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return String(Math.round(parsed));
  }
  return fallback;
}

function joinWuyinReferenceUrls(values: Array<unknown>): string {
  return values
    .flatMap(value => String(value || '').split(','))
    .map(value => value.trim())
    .filter(Boolean)
    .join(',');
}

function appendWuyinBodyValue(body: Record<string, unknown>, key: string, value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value === 'string' && value.trim() === '') return;
  if (Array.isArray(value) && value.length === 0) return;
  body[key] = value;
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
  modelId?: string;
  endpointPath?: string;
  imageSize?: string;
  size?: string;
  aspectRatio?: string;
  referenceImages?: Array<string | { data: string; mimeType: string; url?: string }>;
  negativePrompt?: string;
  promptExtend?: boolean | string;
  watermark?: boolean | string;
  seed?: string | number;
}): Record<string, unknown> {
  const modelId = normalizeWuyinEndpointModelId(input);
  const normalizedModelId = normalizeWuyinModelId(modelId);
  const refs = (input.referenceImages || []).map((ref, index) =>
    normalizeWuyinReferenceImage(ref, index).value
  );
  const body: Record<string, unknown> = { prompt: input.prompt };

  if (normalizedModelId === 'image_gpt' || normalizedModelId === 'gptimage2') {
    body.size = normalizeWuyinGptImageRatio(input.aspectRatio);
    appendWuyinBodyValue(body, 'urls', refs);
    return body;
  }

  // 简体中文注释：纠正速创 NanoBanana 家族的规格格式，使用 size 字段并支持动态尺寸参数
  if (
    normalizedModelId === 'image_nanobanana' ||
    normalizedModelId === 'image_nanobanana2' ||
    normalizedModelId === 'image_nanobanana_pro' ||
    normalizedModelId === 'image_nanobananapro'
  ) {
    body.size = normalizeWuyinImageSize(input.imageSize || input.size);
    body.aspectRatio = normalizeWuyinAspectRatio(input.aspectRatio);
    appendWuyinBodyValue(body, 'urls', refs);
    return body;
  }

  if (normalizedModelId === 'image_grok_imagine') {
    body.aspect_ratio = normalizeWuyinGrokAspectRatio(input.aspectRatio);
    appendWuyinBodyValue(body, 'image_urls', refs);
    return body;
  }

  if (normalizedModelId === 'image_wan2.6' || normalizedModelId === 'image_wan26') {
    body.size = normalizeWuyinWanPixelSize({
      size: input.size,
      imageSize: input.imageSize,
      aspectRatio: input.aspectRatio,
      defaultSize: '1280*1280',
    });
    appendWuyinBodyValue(body, 'urls', refs);
    appendWuyinBodyValue(body, 'negative_prompt', input.negativePrompt);
    appendWuyinBodyValue(body, 'prompt_extend', input.promptExtend);
    appendWuyinBodyValue(body, 'watermark', input.watermark);
    appendWuyinBodyValue(body, 'seed', input.seed);
    return body;
  }

  body.size = normalizeWuyinImageSize(input.imageSize || input.size);
  body.aspectRatio = normalizeWuyinAspectRatio(input.aspectRatio);
  appendWuyinBodyValue(body, 'urls', refs);
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
  modelId?: string;
  endpointPath?: string;
  aspectRatio?: string;
  resolution?: string;
  size?: string;
  duration?: number;
  videoDuration?: string;
  imageUrl?: string;
  imageTailUrl?: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  templateId?: string | number;
  videoName?: string;
  negativePrompt?: string;
  promptExtend?: boolean | string;
  shotType?: string;
  watermark?: boolean | string;
  seed?: string | number;
  sound?: string;
  bgm?: boolean | string;
  remixTargetId?: string;
}): Record<string, unknown> {
  const modelId = normalizeWuyinEndpointModelId(input);
  const normalizedModelId = normalizeWuyinModelId(modelId);
  const anyInput = input as Record<string, unknown>;
  const body: Record<string, unknown> = {};
  const duration = normalizeWuyinVideoDurationValue(input.duration ?? input.videoDuration, normalizedModelId === 'sora2-new' ? '8' : '10');
  const imageUrls = joinWuyinReferenceUrls([input.imageUrl, anyInput.image_url]);
  const firstFrameUrl = String(input.firstFrameUrl || anyInput.firstFrameUrl || imageUrls.split(',')[0] || '').trim();
  const lastFrameUrl = String(input.lastFrameUrl || input.imageTailUrl || anyInput.lastFrameUrl || '').trim();
  const videoUrl = String(input.videoUrl || anyInput.video_url || '').trim();

  if (normalizedModelId === 'video_package') {
    const sourceVideo = videoUrl || String(anyInput.video || input.imageUrl || '').trim();
    if (!sourceVideo) {
      throw new Error('Package_1.0 需要 video 参数，请提供公网可访问的视频 URL。');
    }
    body.video = sourceVideo;
    appendWuyinBodyValue(body, 'template_id', input.templateId || anyInput.template_id || '1');
    return body;
  }

  if (normalizedModelId === 'video_digital_humans') {
    body.videoName = input.videoName || anyInput.videoName || input.prompt || 'digital-human-video';
    appendWuyinBodyValue(body, 'audioUrl', input.audioUrl || anyInput.audioUrl);
    appendWuyinBodyValue(body, 'videoUrl', input.videoUrl || anyInput.videoUrl);
    return body;
  }

  if (normalizedModelId === 'sora2-new' || normalizedModelId === 'submit') {
    body.prompt = input.prompt;
    appendWuyinBodyValue(body, 'url', input.imageUrl || firstFrameUrl || anyInput.url);
    body.aspectRatio = input.aspectRatio === '16:9' ? '16:9' : '9:16';
    body.duration = duration;
    body.size = String(input.size || '').toLowerCase() === 'large' ? 'large' : 'small';
    appendWuyinBodyValue(body, 'remixTargetId', input.remixTargetId || anyInput.remixTargetId);
    return body;
  }

  if (normalizedModelId === 'video_grok_imagine') {
    body.prompt = input.prompt;
    body.duration = duration;
    body.aspect_ratio = normalizeWuyinGrokAspectRatio(input.aspectRatio);
    appendWuyinBodyValue(body, 'image_urls', imageUrls ? imageUrls.split(',') : []);
    return body;
  }

  if (normalizedModelId === 'video_wan2.6' || normalizedModelId === 'video_wan26') {
    body.prompt = input.prompt;
    appendWuyinBodyValue(body, 'negative_prompt', input.negativePrompt || anyInput.negative_prompt);
    appendWuyinBodyValue(body, 'audio_url', input.audioUrl || anyInput.audio_url);
    appendWuyinBodyValue(body, 'firstFrameUrl', firstFrameUrl);
    body.size = normalizeWuyinWanPixelSize({
      size: input.size,
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
      defaultSize: '1280*720',
    });
    body.duration = ['5', '10', '15'].includes(duration) ? duration : '5';
    appendWuyinBodyValue(body, 'prompt_extend', input.promptExtend ?? anyInput.prompt_extend);
    appendWuyinBodyValue(body, 'shot_type', input.shotType || anyInput.shot_type);
    appendWuyinBodyValue(body, 'watermark', input.watermark);
    appendWuyinBodyValue(body, 'seed', input.seed);
    appendWuyinBodyValue(body, 'urls', joinWuyinReferenceUrls([anyInput.urls, input.imageUrl, input.imageTailUrl, videoUrl]));
    return body;
  }

  body.prompt = input.prompt;

  if (normalizedModelId === 'video_vidu') {
    body.aspectRatio = normalizeWuyinVideoAspectRatio(input.aspectRatio);
    body.resolution = normalizeWuyinVideoResolution(input.resolution);
    appendWuyinBodyValue(body, 'subjects', anyInput.subjects);
    appendWuyinBodyValue(body, 'image_url', imageUrls);
    appendWuyinBodyValue(body, 'video_url', videoUrl);
    appendWuyinBodyValue(body, 'bgm', input.bgm);
    body.duration = duration;
    return body;
  }

  if (normalizedModelId === 'video_omni') {
    body.aspectRatio = normalizeWuyinVideoAspectRatio(input.aspectRatio);
    body.resolution = String(input.resolution || '').trim() || 'pro';
    body.sound = input.sound || 'on';
    appendWuyinBodyValue(body, 'image_url', imageUrls);
    appendWuyinBodyValue(body, 'firstFrameUrl', firstFrameUrl);
    appendWuyinBodyValue(body, 'lastFrameUrl', lastFrameUrl);
    appendWuyinBodyValue(body, 'video_url', videoUrl);
    body.duration = duration || '5';
    return body;
  }

  if (normalizedModelId === 'video_veo3.1_fast') {
    appendWuyinBodyValue(body, 'firstFrameUrl', firstFrameUrl);
    appendWuyinBodyValue(body, 'lastFrameUrl', lastFrameUrl);
    const urls = joinWuyinReferenceUrls([anyInput.urls, input.imageUrl, input.imageTailUrl]);
    appendWuyinBodyValue(body, 'urls', urls ? urls.split(',').slice(0, 3) : []);
    body.aspectRatio = input.aspectRatio === '9:16' ? '9:16' : '16:9';
    body.size = normalizeWuyinVideoResolution(input.size || input.resolution) === '1080p' ? '1080p' : '720p';
    return body;
  }

  const size = resolveWuyinVideoSize(input);
  if (size) body.size = size;

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
  modelId?: string;
  endpointPath?: string;
  voiceId?: string;
  speed?: number;
  volume?: string | number;
  languageBoost?: string;
  audioDuration?: string | number;
  audioLyrics?: string;
  audioStyle?: string;
  audioTitle?: string;
  audioUrl?: string;
  name?: string;
}): Record<string, unknown> {
  const modelId = normalizeWuyinEndpointModelId(input);
  const normalizedModelId = normalizeWuyinModelId(modelId);

  if (normalizedModelId === 'voice_clone' || normalizedModelId === 'clone') {
    const audioUrl = String(input.audioUrl || '').trim();
    if (!audioUrl) {
      throw new Error('语音克隆需要 audio_url 参数，请提供公网可访问的音频 URL。');
    }
    return {
      audio_url: audioUrl,
      text: input.prompt,
      name: input.name || input.audioTitle,
    };
  }

  const body: Record<string, unknown> = {
    text: input.prompt,
    voice_id: input.voiceId || 'male-qn-qingse',
    speed: input.speed ?? 1,
  };
  appendWuyinBodyValue(body, 'vol', input.volume);
  appendWuyinBodyValue(body, 'language_boost', input.languageBoost || 'auto');
  appendWuyinBodyValue(body, 'duration', input.audioDuration);
  appendWuyinBodyValue(body, 'lyrics', input.audioLyrics);
  appendWuyinBodyValue(body, 'style', input.audioStyle);
  appendWuyinBodyValue(body, 'title', input.audioTitle);
  return body;
}

export function serializeWuyinSubmitBody(body: Record<string, unknown>, contentType?: string): string {
  if (/application\/x-www-form-urlencoded/i.test(String(contentType || ''))) {
    const params = new URLSearchParams();
    Object.entries(body || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        if (value.length > 0) params.set(key, value.join(','));
        return;
      }
      if (typeof value === 'object') {
        params.set(key, JSON.stringify(value));
        return;
      }
      params.set(key, String(value));
    });
    return params.toString();
  }
  return JSON.stringify(body || {});
}
