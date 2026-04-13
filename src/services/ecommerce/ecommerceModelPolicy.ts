const ECOMMERCE_MODEL_ALIASES: Record<string, string> = {
  'nano banana 2': 'gemini-3.1-flash-image-preview',
  'nano-banana-2': 'gemini-3.1-flash-image-preview',
  'gemini-3.1-flash-image-preview': 'gemini-3.1-flash-image-preview',
  'nano banana pro': 'gemini-3-pro-image-preview',
  'nano-banana-pro': 'gemini-3-pro-image-preview',
  'gemini-3-pro-image-preview': 'gemini-3-pro-image-preview',
};

const ECOMMERCE_ALLOWED_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
] as const;

export interface EcommerceAspectPolicyInput {
  kind: 'main-image' | 'a-plus-module';
  modelId?: string;
  declaredDimensions?: string;
  designRequirements?: string;
  copyText?: string;
}

export interface EcommerceAspectPolicy {
  sizePolicy: 'main-default' | 'sheet-native' | 'desktop-then-mobile';
  allowedAspectRatios: Array<'1:1' | '3:4' | '4:3' | '16:9' | '21:9'>;
  defaultAspectRatio: '1:1' | '3:4' | '4:3' | '16:9' | '21:9';
  mobileAspectRatio?: '4:3';
}

export function resolvePreferredEcommerceImageSize(modelId?: string): '4K' | '2K' | '1K' {
  const normalized = normalizeEcommerceModelId(modelId);
  if (!normalized) return '1K';
  if (normalized.includes('gemini-3.1-flash-image-preview') || normalized.includes('gemini-3-pro-image-preview')) {
    return '4K';
  }
  return '1K';
}

export function normalizeEcommerceModelId(modelId?: string): string {
  const baseId = String(modelId || '').trim().split('@')[0].toLowerCase();
  if (!baseId) return '';
  const normalizedWhitespace = baseId.replace(/\s+/g, ' ');
  return ECOMMERCE_MODEL_ALIASES[normalizedWhitespace] || normalizedWhitespace;
}

export function getEcommerceAllowedModels(): string[] {
  return [...ECOMMERCE_ALLOWED_MODELS];
}

export function isEcommerceAllowedModel(modelId?: string): boolean {
  const normalized = normalizeEcommerceModelId(modelId);
  return ECOMMERCE_ALLOWED_MODELS.includes(normalized as (typeof ECOMMERCE_ALLOWED_MODELS)[number]);
}

function normalizeDimensionToken(raw?: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[x×]/g, '*')
    .replace(/\s+/g, '');
}

function inferAspectRatioFromDimensions(raw?: string): '1:1' | '3:4' | '4:3' | '16:9' | '21:9' | undefined {
  const normalized = normalizeDimensionToken(raw);
  if (!normalized) return undefined;

  const match = normalized.match(/^(\d+)\*(\d+)$/);
  if (!match) return undefined;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return undefined;

  const ratio = width / height;
  const knownRatios: Array<{ ratio: number; aspectRatio: '1:1' | '3:4' | '4:3' | '16:9' | '21:9' }> = [
    { ratio: 1, aspectRatio: '1:1' },
    { ratio: 3 / 4, aspectRatio: '3:4' },
    { ratio: 4 / 3, aspectRatio: '4:3' },
    { ratio: 16 / 9, aspectRatio: '16:9' },
    { ratio: 21 / 9, aspectRatio: '21:9' },
  ];

  let best = knownRatios[0];
  let bestDistance = Math.abs(ratio - best.ratio);
  for (const candidate of knownRatios.slice(1)) {
    const distance = Math.abs(ratio - candidate.ratio);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return bestDistance <= 0.18 ? best.aspectRatio : undefined;
}

function looksLikeDesktopThenMobile(designRequirements?: string, copyText?: string): boolean {
  const combined = `${designRequirements || ''} ${copyText || ''}`.toLowerCase();
  return /desktop|mobile|电脑端|桌面端|手机端|先.*电脑.*后.*手机|先.*desktop.*then.*mobile|横幅/.test(combined);
}

export function resolveEcommerceAspectPolicy(input: EcommerceAspectPolicyInput): EcommerceAspectPolicy {
  if (input.kind === 'main-image') {
    return {
      sizePolicy: 'main-default',
      allowedAspectRatios: ['1:1', '3:4'],
      defaultAspectRatio: '1:1',
    };
  }

  const declaredRatio = inferAspectRatioFromDimensions(input.declaredDimensions);
  if (declaredRatio) {
    return {
      sizePolicy: 'sheet-native',
      allowedAspectRatios: [declaredRatio],
      defaultAspectRatio: declaredRatio,
    };
  }

  if (looksLikeDesktopThenMobile(input.designRequirements, input.copyText)) {
    return {
      sizePolicy: 'desktop-then-mobile',
      allowedAspectRatios: ['21:9'],
      defaultAspectRatio: '21:9',
      mobileAspectRatio: '4:3',
    };
  }

  return {
    sizePolicy: 'sheet-native',
    allowedAspectRatios: ['16:9'],
    defaultAspectRatio: '16:9',
  };
}
