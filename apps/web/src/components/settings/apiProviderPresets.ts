import type { ApiProtocolFormat } from '../../services/api/apiConfig';
import { WUYIN_PRESET_LOGO_URL } from '../../services/auth/keyManagerProviderPresets';

type ProviderPresetCostMode = 'unlimited' | 'amount' | 'tokens';

export interface ProviderPresetLink {
  labelZh: string;
  labelEn: string;
  url: string;
}

export interface ProviderPreset {
  name: string;
  url: string;
  baseUrl: string;
  format: ApiProtocolFormat;
  color: string;
  modelId?: string;
  logoName?: string;
  kind?: 'official' | 'relay';
  keyLinks?: ProviderPresetLink[];
}

export interface ProviderPresetFormDraft {
  name: string;
  baseUrl: string;
  apiKey: string;
  apiKeyPreview?: string;
  modelsText: string;
  format: ApiProtocolFormat;
  group: string;
  color: string;
  isActive: boolean;
  mode: ProviderPresetCostMode;
  value: string;
}

const DEFAULT_PROVIDER_COLOR = 'var(--text-secondary)';

const providerPresetDraftDefaults: ProviderPresetFormDraft = {
  name: '',
  baseUrl: '',
  apiKey: '',
  apiKeyPreview: '',
  modelsText: '',
  format: 'auto',
  group: '',
  color: DEFAULT_PROVIDER_COLOR,
  isActive: true,
  mode: 'unlimited',
  value: '',
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { name: 'Xiaomi 小米', url: 'https://platform.xiaomimimo.com/', baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1', format: 'openai', color: '#ff6900', modelId: 'mimo-v2.5-pro', logoName: 'xiaomi mimo', kind: 'official', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://platform.xiaomimimo.com/' }] },
  { name: 'OpenAI', url: 'https://openai.com', baseUrl: 'https://api.openai.com/v1', format: 'openai', color: '#10a37f', modelId: 'gpt-4o', logoName: 'openai', kind: 'official', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://platform.openai.com/api-keys' }, { labelZh: '接口文档', labelEn: 'API docs', url: 'https://platform.openai.com/docs/api-reference' }] },
  { name: 'Google Gemini', url: 'https://gemini.google.com', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', format: 'gemini', color: '#4285f4', modelId: 'gemini-2.5-flash', logoName: 'gemini', kind: 'official', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://aistudio.google.com/app/apikey' }, { labelZh: '接口文档', labelEn: 'API docs', url: 'https://ai.google.dev/gemini-api/docs' }] },
  { name: 'Volcengine 火山引擎', url: 'https://www.volcengine.com/', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', format: 'openai', color: '#2563eb', modelId: 'doubao-seed-1-6', logoName: 'volcengine', kind: 'official' },
  { name: 'DeepSeek', url: 'https://www.deepseek.com', baseUrl: 'https://api.deepseek.com', format: 'openai', color: '#2563eb', modelId: 'deepseek-chat', logoName: 'deepseek', kind: 'official', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://platform.deepseek.com/api_keys' }, { labelZh: '接口文档', labelEn: 'API docs', url: 'https://api-docs.deepseek.com/' }] },
  { name: 'ERNIE 文心', url: 'https://yiyan.baidu.com', baseUrl: 'https://qianfan.baidubce.com/v2', format: 'openai', color: '#1677ff', modelId: 'ernie-4.5-turbo', logoName: 'ernie baidu', kind: 'official' },
  { name: 'Qwen 通义千问', url: 'https://chat.qwen.ai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', format: 'openai', color: '#6d5dfc', modelId: 'qwen-plus', logoName: 'qwen', kind: 'official', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://bailian.console.aliyun.com/' }] },
  { name: 'Kimi 月之暗面', url: 'https://www.kimi.com', baseUrl: 'https://api.moonshot.cn/v1', format: 'openai', color: '#7c3aed', modelId: 'moonshot-v1-32k', logoName: 'kimi moonshot', kind: 'official', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://platform.moonshot.cn/console/api-keys' }, { labelZh: '接口文档', labelEn: 'API docs', url: 'https://platform.moonshot.cn/docs' }] },
  { name: 'Anthropic', url: 'https://www.anthropic.com', baseUrl: 'https://api.anthropic.com', format: 'claude', color: '#d97757', modelId: 'claude-sonnet-4-5', logoName: 'anthropic claude', kind: 'official', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://console.anthropic.com/settings/keys' }, { labelZh: '接口文档', labelEn: 'API docs', url: 'https://docs.anthropic.com/' }] },
  { name: 'GLM 智谱', url: 'https://www.zhipuai.cn', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', format: 'openai', color: '#5b5cf6', modelId: 'glm-4.5', logoName: 'glm zhipu', kind: 'official' },
  { name: 'xAI Grok', url: 'https://x.ai', baseUrl: 'https://api.x.ai/v1', format: 'openai', color: '#8b949e', modelId: 'grok-4', logoName: 'xai grok', kind: 'official' },
  { name: 'Hunyuan 混元', url: 'https://hunyuan.tencent.com', baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', format: 'openai', color: '#0ea5e9', modelId: 'hunyuan-turbos-latest', logoName: 'hunyuan tencent', kind: 'official' },
  { name: 'Meta AI', url: 'https://ai.meta.com', baseUrl: '', format: 'openai', color: '#0866ff', modelId: 'llama-3.3-70b-instruct', logoName: 'meta llama', kind: 'official' },
  { name: 'Perplexity', url: 'https://www.perplexity.ai', baseUrl: 'https://api.perplexity.ai', format: 'openai', color: '#20b8cd', modelId: 'sonar-pro', logoName: 'perplexity', kind: 'official' },
  { name: 'MiniMax EN', url: 'https://www.minimax.io', baseUrl: 'https://api.minimax.io/v1', format: 'openai', color: '#e11d48', modelId: 'MiniMax-M2.7', logoName: 'minimax', kind: 'official' },
  { name: 'MiniMax CN', url: 'https://www.minimaxi.com', baseUrl: 'https://api.minimaxi.com/v1', format: 'openai', color: '#e11d48', modelId: 'MiniMax-M2.7', logoName: 'minimax', kind: 'official' },
  { name: 'Stepfun 阶跃星辰', url: 'https://www.stepfun.com', baseUrl: 'https://api.stepfun.com/v1', format: 'openai', color: '#4f46e5', modelId: 'step-2-mini', logoName: 'stepfun', kind: 'official' },
  { name: 'Mistral AI', url: 'https://mistral.ai', baseUrl: 'https://api.mistral.ai/v1', format: 'openai', color: '#f59e0b', modelId: 'mistral-large-latest', logoName: 'mistral', kind: 'official' },
  { name: 'Cohere', url: 'https://cohere.com', baseUrl: 'https://api.cohere.ai/compatibility/v1', format: 'openai', color: '#22c55e', modelId: 'command-a-03-2025', logoName: 'cohere', kind: 'official' },
  { name: 'Groq', url: 'https://groq.com', baseUrl: 'https://api.groq.com/openai/v1', format: 'openai', color: '#f97316', modelId: 'llama-3.3-70b-versatile', logoName: 'groq', kind: 'official' },
  { name: 'Together AI', url: 'https://www.together.ai', baseUrl: 'https://api.together.xyz/v1', format: 'openai', color: '#3b82f6', modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', logoName: 'together', kind: 'official' },
  { name: 'NVIDIA', url: 'https://build.nvidia.com/models', baseUrl: 'https://integrate.api.nvidia.com/v1', format: 'openai', color: '#76b900', modelId: 'nvidia/llama-3.1-nemotron-ultra-253b-v1', logoName: 'nvidia nemotron', kind: 'official' },
  { name: 'OpenRouter', url: 'https://openrouter.ai', baseUrl: 'https://openrouter.ai/api/v1', format: 'openai', color: '#9ca3af', modelId: 'openai/gpt-4o', logoName: 'openrouter', kind: 'relay', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://openrouter.ai/settings/keys' }, { labelZh: '接口文档', labelEn: 'API docs', url: 'https://openrouter.ai/docs' }] },
  { name: 'WorldRouter', url: 'https://www.worldrouter.ai', baseUrl: 'https://inference-api.worldrouter.ai/v1', format: 'openai', color: '#38bdf8', modelId: '', logoName: 'worldrouter', kind: 'relay' },
  { name: '速创 API', url: 'https://api.wuyinkeji.com/type/all', baseUrl: 'https://api.wuyinkeji.com', format: 'openai', color: '#0891b2', modelId: 'video_google_omni', logoName: WUYIN_PRESET_LOGO_URL, kind: 'relay', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://api.wuyinkeji.com/user/register?cps=KCyv1E6I' }, { labelZh: '接口文档', labelEn: 'API docs', url: 'https://api.wuyinkeji.com/doc/72' }] },
  { name: 'B.ai', url: 'https://b.ai', baseUrl: 'https://api.theb.ai/v1', format: 'openai', color: '#a855f7', modelId: '', logoName: 'b.ai', kind: 'relay' },
  { name: '12AI', url: 'https://12ai.org', baseUrl: 'https://cdn.12ai.org', format: 'gemini', color: '#06b6d4', modelId: 'gpt-5.1', logoName: '12ai', kind: 'relay', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://cdn.12ai.org' }, { labelZh: '接口文档', labelEn: 'API docs', url: 'https://doc.12ai.org/docs/api' }] },
  { name: 'SiliconFlow 硅基流动', url: 'https://siliconflow.cn', baseUrl: 'https://api.siliconflow.cn/v1', format: 'openai', color: '#ff5a00', modelId: 'Qwen/Qwen2.5-72B-Instruct', logoName: 'siliconcloud', kind: 'relay', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://siliconflow.cn/zh-cn/' }, { labelZh: '接口文档', labelEn: 'API docs', url: 'https://docs.siliconflow.cn/' }] },
  { name: 'GPT-Best', url: 'https://gpt-best.com', baseUrl: 'https://api.gpt-best.com/v1', format: 'openai', color: '#16a34a', modelId: 'gpt-4o', logoName: 'gpt-best', kind: 'relay', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://api.gpt-best.com/' }] },
  { name: 'New Suxi AI', url: 'https://new.suxi.ai', baseUrl: 'https://new.suxi.ai/v1', format: 'openai', color: '#ec4899', modelId: 'gpt-4o', logoName: 'suxi', kind: 'relay', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://new.suxi.ai' }] },
  { name: 'T8Star', url: 'https://ai.t8star.cn', baseUrl: 'https://ai.t8star.cn', format: 'openai', color: '#eab308', modelId: 'gemini-3.1-pro-preview', logoName: 't8star', kind: 'relay', keyLinks: [{ labelZh: '获取 API Key', labelEn: 'Get API Key', url: 'https://ai.t8star.cn/' }] },
  { name: 'Flow2API', url: 'http://127.0.0.1:8000', baseUrl: 'http://127.0.0.1:8000', format: 'openai', color: '#3b82f6', modelId: 'gemini-3.1-flash-image-landscape', logoName: 'flow2api', kind: 'relay' },
  { name: 'APIMart', url: 'https://docs.apimart.ai/cn', baseUrl: 'https://api.apimart.ai/v1', format: 'openai', color: '#9333ea', modelId: 'gpt-5-mini', logoName: 'apimart', kind: 'relay', keyLinks: [{ labelZh: '接口文档', labelEn: 'API docs', url: 'https://docs.apimart.ai/cn' }] },
  { name: 'OpenClaw (Zero Token)', url: 'http://127.0.0.1:3001', baseUrl: 'http://127.0.0.1:3001/v1', format: 'openai', color: '#eab308', modelId: 'claude-3-5-sonnet-20241022', logoName: 'openclaw', kind: 'relay' },
];

const normalizeProviderConnectionValue = (value: unknown): string => (
  typeof value === 'string' ? value.trim().replace(/\/+$/, '').toLowerCase() : ''
);

export const findProviderPresetForDraft = (name: string, baseUrl: string): ProviderPreset | null => {
  const normalizedName = normalizeProviderConnectionValue(name);
  const normalizedBaseUrl = normalizeProviderConnectionValue(baseUrl);
  return PROVIDER_PRESETS.find((preset) => (
    normalizeProviderConnectionValue(preset.name) === normalizedName
    || (normalizedBaseUrl && normalizeProviderConnectionValue(preset.baseUrl) === normalizedBaseUrl)
  )) || null;
};

export const getProviderPresetLinks = (preset: ProviderPreset | null): ProviderPresetLink[] => {
  if (!preset) return [];
  const links = preset.keyLinks && preset.keyLinks.length > 0
    ? preset.keyLinks
    : [{ labelZh: '打开官网', labelEn: 'Open website', url: preset.url }];
  return links.filter((link) => Boolean(String(link.url || '').trim()));
};

export const toProviderFormFromPreset = (preset: ProviderPreset): ProviderPresetFormDraft => ({
  ...providerPresetDraftDefaults,
  name: preset.name,
  baseUrl: preset.baseUrl,
  apiKey: '',
  apiKeyPreview: '',
  modelsText: preset.modelId || '',
  format: preset.format,
  color: preset.color,
});

export const detectProviderPresetByBaseUrl = (baseUrl: string): ProviderPreset | null => {
  const urlStr = String(baseUrl || '').trim();
  if (!urlStr) return null;

  const normalizedInput = urlStr.toLowerCase().replace(/\/+$/, '');

  // 1. 精确匹配（去尾斜杠）
  let match = PROVIDER_PRESETS.find(
    (preset) => preset.baseUrl && preset.baseUrl.toLowerCase().replace(/\/+$/, '') === normalizedInput
  );
  if (match) return match;

  // 2. 域名提取与匹配
  const extractDomain = (url: string): string => {
    try {
      let temp = url.toLowerCase().trim();
      if (!/^https?:\/\//i.test(temp)) {
        temp = `https://${temp}`;
      }
      const parsed = new URL(temp);
      return parsed.hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  const inputDomain = extractDomain(urlStr);
  if (inputDomain) {
    // 首先看是否有域名完全相等的
    for (const preset of PROVIDER_PRESETS) {
      if (preset.baseUrl) {
        const presetDomain = extractDomain(preset.baseUrl);
        if (presetDomain && presetDomain === inputDomain) {
          return preset;
        }
      }
    }
    // 其次看是否包含关系
    for (const preset of PROVIDER_PRESETS) {
      if (preset.baseUrl) {
        const presetDomain = extractDomain(preset.baseUrl);
        if (presetDomain && (inputDomain.includes(presetDomain) || presetDomain.includes(inputDomain))) {
          return preset;
        }
      }
      if (preset.url) {
        const presetDomain = extractDomain(preset.url);
        if (presetDomain && (inputDomain.includes(presetDomain) || presetDomain.includes(inputDomain))) {
          return preset;
        }
      }
    }
  }

  // 3. 子串模糊匹配
  match = PROVIDER_PRESETS.find((preset) => {
    if (!preset.baseUrl) return false;
    const cleanPresetUrl = preset.baseUrl.toLowerCase().replace(/\/+$/, '');
    return normalizedInput.includes(cleanPresetUrl) || cleanPresetUrl.includes(normalizedInput);
  });

  return match || null;
};
