import {
  AspectRatio,
  type EcommerceAPlusControlMode,
  type EcommerceAPlusSizeTier,
  type EcommerceEditableTaskState,
  type EcommerceGroupSheet,
  type EcommerceSheetSetting,
  type EcommerceSizePolicy,
} from '../../types/index.ts';

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

type EcommerceAspectRatio = 'auto' | '1:1' | '3:4' | '4:3' | '16:9' | '21:9';

const MAIN_IMAGE_ALLOWED_ASPECT_RATIOS: EcommerceAspectRatio[] = ['auto', '1:1', '3:4'];

export interface EcommerceAspectPolicyInput {
  kind: 'main-image' | 'a-plus-module';
  modelId?: string;
  declaredDimensions?: string;
  designRequirements?: string;
  copyText?: string;
}

export interface EcommerceAspectPolicy {
  sizePolicy: 'main-default' | 'sheet-native' | 'desktop-then-mobile';
  sizeTier?: EcommerceAPlusSizeTier;
  allowedAspectRatios: EcommerceAspectRatio[];
  defaultAspectRatio: EcommerceAspectRatio;
  mobileAspectRatio?: '4:3';
}

export interface EffectiveEcommerceAPlusPolicy {
  detectedSizeTier: EcommerceAPlusSizeTier;
  effectiveSizeTier: EcommerceAPlusSizeTier;
  effectiveSizePolicy: EcommerceSizePolicy;
  allowedAspectRatios: EcommerceAspectRatio[];
  defaultAspectRatio: EcommerceAspectRatio;
  runtimeAspectRatio: EcommerceAspectRatio;
  mobileAspectRatio?: '4:3';
}

export interface EcommercePromptBarAspectContextInput {
  activeTask?: Pick<EcommerceEditableTaskState, 'sourceSheet' | 'sizeTier' | 'sizeControlOverride'> | null;
  activeSheet?: EcommerceGroupSheet | null;
  sheetSettings?: Partial<Record<EcommerceGroupSheet, Pick<EcommerceSheetSetting, 'aspectRatio' | 'aPlusControlMode'>>>;
  ratioOverride?: AspectRatio[] | null;
}

export interface EcommercePromptBarAspectContext {
  activeSheet: EcommerceGroupSheet;
  allowedAspectRatios: AspectRatio[];
  defaultAspectRatio: AspectRatio;
}

type ParsedDimensions = {
  width: number;
  height: number;
};

const BUSINESS_SIZE_TOLERANCE_PX = 8;

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

function parseDeclaredDimensions(raw?: string): ParsedDimensions | null {
  const normalized = normalizeDimensionToken(raw);
  if (!normalized) return null;

  const match = normalized.match(/^(\d+)\*(\d+)$/);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;

  return { width, height };
}

function isWithinTolerance(actual: number, target: number): boolean {
  return Math.abs(actual - target) <= BUSINESS_SIZE_TOLERANCE_PX;
}

export function classifyEcommerceAPlusSizeTier(raw?: string): EcommerceAPlusSizeTier {
  const parsed = parseDeclaredDimensions(raw);
  if (!parsed) {
    return 'unknown';
  }

  if (
    isWithinTolerance(parsed.height, 600)
    && (isWithinTolerance(parsed.width, 1464) || isWithinTolerance(parsed.width, 1460))
  ) {
    return '1464x600';
  }

  if (isWithinTolerance(parsed.width, 970) && isWithinTolerance(parsed.height, 600)) {
    return '970x600';
  }

  if (isWithinTolerance(parsed.width, 600) && isWithinTolerance(parsed.height, 450)) {
    return '600x450';
  }

  return 'unknown';
}

function inferAspectRatioFromDimensions(raw?: string): EcommerceAspectRatio | undefined {
  const normalized = normalizeDimensionToken(raw);
  if (!normalized) return undefined;

  const match = normalized.match(/^(\d+)\*(\d+)$/);
  if (!match) return undefined;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return undefined;

  const ratio = width / height;
  const knownRatios: Array<{ ratio: number; aspectRatio: EcommerceAspectRatio }> = [
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

function buildAPlusTierPolicy(
  sizeTier: EcommerceAPlusSizeTier,
): Omit<EffectiveEcommerceAPlusPolicy, 'detectedSizeTier'> {
  if (sizeTier === '1464x600') {
    return {
      effectiveSizeTier: sizeTier,
      effectiveSizePolicy: 'desktop-then-mobile',
      allowedAspectRatios: ['21:9'],
      defaultAspectRatio: '21:9',
      runtimeAspectRatio: '21:9',
      mobileAspectRatio: '4:3',
    };
  }

  if (sizeTier === '600x450') {
    return {
      effectiveSizeTier: sizeTier,
      effectiveSizePolicy: 'sheet-native',
      allowedAspectRatios: ['4:3'],
      defaultAspectRatio: '4:3',
      runtimeAspectRatio: '4:3',
      mobileAspectRatio: undefined,
    };
  }

  return {
    effectiveSizeTier: '970x600',
    effectiveSizePolicy: 'sheet-native',
    allowedAspectRatios: ['16:9'],
    defaultAspectRatio: '16:9',
    runtimeAspectRatio: '16:9',
    mobileAspectRatio: undefined,
  };
}

export function resolveEffectiveEcommerceAPlusPolicy(input: {
  detectedSizeTier?: EcommerceAPlusSizeTier;
  controlMode?: EcommerceAPlusControlMode;
}): EffectiveEcommerceAPlusPolicy {
  const detectedSizeTier = input.detectedSizeTier || 'unknown';
  const resolvedTier = input.controlMode && input.controlMode !== 'auto'
    ? input.controlMode
    : detectedSizeTier !== 'unknown'
      ? detectedSizeTier
      : '970x600';

  return {
    detectedSizeTier,
    ...buildAPlusTierPolicy(resolvedTier),
  };
}

export function resolveEcommercePromptBarAspectContext(
  input: EcommercePromptBarAspectContextInput,
): EcommercePromptBarAspectContext {
  const mainImagePolicy = resolveEcommerceAspectPolicy({ kind: 'main-image' });
  const activeSheet = input.activeTask?.sourceSheet || input.activeSheet || '\u4e3b\u56fe';
  const activeSheetSetting = input.sheetSettings?.[activeSheet];
  const activeAPlusPolicy = activeSheet === 'A+'
    ? resolveEffectiveEcommerceAPlusPolicy({
        detectedSizeTier: input.activeTask?.sourceSheet === 'A+' ? input.activeTask.sizeTier : undefined,
        controlMode: (
          input.activeTask?.sourceSheet === 'A+'
            ? input.activeTask.sizeControlOverride
            : undefined
        ) ?? activeSheetSetting?.aPlusControlMode,
      })
    : null;

  const mainImageAllowedAspectRatios = activeSheetSetting?.aspectRatio && activeSheetSetting.aspectRatio !== AspectRatio.AUTO
    ? [activeSheetSetting.aspectRatio]
    : (mainImagePolicy.allowedAspectRatios as AspectRatio[]);

  const allowedAspectRatios = input.activeTask && input.ratioOverride?.length
    ? input.ratioOverride
    : activeSheet === 'A+'
      ? (
          (activeAPlusPolicy?.allowedAspectRatios as AspectRatio[] | undefined)
          || (activeSheetSetting?.aspectRatio ? [activeSheetSetting.aspectRatio] : [AspectRatio.LANDSCAPE_16_9])
        )
      : mainImageAllowedAspectRatios;

  const defaultAspectRatio = activeSheet === 'A+'
    ? (
        activeAPlusPolicy?.defaultAspectRatio
        || activeSheetSetting?.aspectRatio
        || AspectRatio.LANDSCAPE_16_9
      ) as AspectRatio
    : (
        activeSheetSetting?.aspectRatio
        || mainImagePolicy.defaultAspectRatio
      ) as AspectRatio;

  return {
    activeSheet,
    allowedAspectRatios,
    defaultAspectRatio,
  };
}

export function resolveEcommerceAspectPolicy(input: EcommerceAspectPolicyInput): EcommerceAspectPolicy {
  if (input.kind === 'main-image') {
    return {
      sizePolicy: 'main-default',
      allowedAspectRatios: MAIN_IMAGE_ALLOWED_ASPECT_RATIOS,
      defaultAspectRatio: 'auto',
    };
  }

  const sizeTier = classifyEcommerceAPlusSizeTier(input.declaredDimensions);
  if (sizeTier === '1464x600') {
    return {
      sizePolicy: 'desktop-then-mobile',
      sizeTier,
      allowedAspectRatios: ['21:9'],
      defaultAspectRatio: '21:9',
      mobileAspectRatio: '4:3',
    };
  }

  if (sizeTier === '970x600') {
    return {
      sizePolicy: 'sheet-native',
      sizeTier,
      allowedAspectRatios: ['16:9'],
      defaultAspectRatio: '16:9',
    };
  }

  if (sizeTier === '600x450') {
    return {
      sizePolicy: 'sheet-native',
      sizeTier,
      allowedAspectRatios: ['4:3'],
      defaultAspectRatio: '4:3',
    };
  }

  if (looksLikeDesktopThenMobile(input.designRequirements, input.copyText)) {
    return {
      sizePolicy: 'desktop-then-mobile',
      sizeTier: 'unknown',
      allowedAspectRatios: ['21:9'],
      defaultAspectRatio: '21:9',
      mobileAspectRatio: '4:3',
    };
  }

  const declaredRatio = inferAspectRatioFromDimensions(input.declaredDimensions);
  if (declaredRatio) {
    return {
      sizePolicy: 'sheet-native',
      sizeTier: 'unknown',
      allowedAspectRatios: [declaredRatio],
      defaultAspectRatio: declaredRatio,
    };
  }

  return {
    sizePolicy: 'sheet-native',
    sizeTier: 'unknown',
    allowedAspectRatios: ['16:9'],
    defaultAspectRatio: '16:9',
  };
}
