export type ApiProtocolFormat = 'auto' | 'openai' | 'gemini' | 'claude';
export type CostMode = 'unlimited' | 'amount' | 'tokens';
export type OfficialProvider = 'Google' | 'OpenAI';

export const UI_TOKEN_UNIT_LABEL = '词元';
export const UI_TOKEN_LIMIT_LABEL = '词元上限';
export const UI_LEGACY_TOKEN_LIMIT_LABEL = '令牌上限';
export const UI_BUDGET_OPTIONS = ['不限额', '金额预算', UI_TOKEN_LIMIT_LABEL] as const;

export const formatUsd = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const compactNumber = (value: number) =>
  new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const formatTokens = (value: number) => `${compactNumber(value)} ${UI_TOKEN_UNIT_LABEL}`;

export const formatDateTime = (value?: number | string | null) => {
  if (!value) return '暂无记录';
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return '暂无记录';
  return target.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatLatency = (value?: number | null) => {
  if (typeof value !== 'number' || value <= 0) return '暂无';
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}s`;
  return `${Math.round(value)}ms`;
};

export const extractDomain = (url: string) => {
  if (!url.trim()) return '未填写基础地址';
  return url.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
};

export const maskSecretDisplay = (value: string) => {
  if (!value.trim()) return '尚未填写';
  if (value.startsWith('__kk_redacted__:') || value === 'sk-readonly-0000') {
    return '••••••••••••';
  }
  if (value.length <= 10) return '已填写';
  return `${value.slice(0, 6)}••••${value.slice(-4)}`;
};

export const getModeLabel = (mode: CostMode) => {
  if (mode === 'amount') return '金额预算';
  if (mode === 'tokens') return UI_TOKEN_LIMIT_LABEL;
  return '不限额';
};

export const getModeOption = (mode: CostMode) => {
  if (mode === 'amount') return '金额预算';
  if (mode === 'tokens') return UI_TOKEN_LIMIT_LABEL;
  return '不限额';
};

export const parseModeOption = (value: string): CostMode => {
  if (value === '金额预算') return 'amount';
  if (value === UI_TOKEN_LIMIT_LABEL || value === UI_LEGACY_TOKEN_LIMIT_LABEL) return 'tokens';
  return 'unlimited';
};

export const getProtocolLabel = (format: ApiProtocolFormat) => {
  if (format === 'openai') return 'OpenAI 协议';
  if (format === 'gemini') return 'Gemini 协议';
  if (format === 'claude') return 'Claude 协议';
  return '自动识别';
};

export const getOfficialProviderLabel = (provider: OfficialProvider) =>
  provider === 'Google' ? '谷歌官方接口' : 'OpenAI 官方接口';
