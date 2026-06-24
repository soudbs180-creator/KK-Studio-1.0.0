import { keyManager } from '../services/auth/keyManager';
import { getProviderMetadata } from '../services/api/providerRegistry';

type ProviderDisplayTarget = {
  keySlotId?: string;
  model?: string;
  provider?: string;
  providerLabel?: string;
  type?: string;
  baseUrl?: string;
};

const LANGUAGE_STORAGE_KEY = 'kk_language';

const OFFICIAL_PROVIDER_ALIASES: Record<string, string[]> = {
  Google: [
    'google',
    'google api',
    'google gemini',
    'google official',
    'google official api',
    'google gemini official',
    'google gemini official endpoint',
    'google official endpoint',
    '谷歌',
    '谷歌接口',
    '谷歌官方接口',
  ],
  OpenAI: [
    'openai',
    'openai api',
    'openai official',
    'openai official api',
    'openai official endpoint',
    'openai 官方接口',
  ],
};

const RELAY_HOST_PROVIDER_ALIASES: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /(^|\.)openrouter\.ai$/i, provider: 'OpenRouter' },
  { pattern: /(^|\.)apimart\.ai$/i, provider: 'APIMart' },
  { pattern: /(^|\.)gpt-best\.com$/i, provider: 'GPTBest' },
  { pattern: /(^|\.)12ai\.org$/i, provider: '12AI' },
  { pattern: /(^|\.)wuyinkeji\.com$/i, provider: 'Wuyin' },
];

function normalizeValue(value?: string | null): string {
  return String(value || '').trim();
}

function getCurrentLanguage(): 'zh-CN' | 'en-US' {
  if (typeof window === 'undefined') {
    return 'zh-CN';
  }

  const stored = normalizeValue(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  const documentLanguage = normalizeValue(
    document.documentElement.dataset.language || document.documentElement.lang
  );
  const resolved = stored || documentLanguage;

  return resolved.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}

function normalizeHost(baseUrl?: string): string {
  const raw = normalizeValue(baseUrl).replace(/\/+$/, '');
  if (!raw) {
    return '';
  }

  const candidates = /^https?:\/\//i.test(raw) ? [raw] : [`https://${raw}`, `http://${raw}`];
  for (const candidate of candidates) {
    try {
      return new URL(candidate).hostname.toLowerCase();
    } catch {
      continue;
    }
  }

  return '';
}

function resolveRelayProviderFromBaseUrl(baseUrl?: string): string {
  const host = normalizeHost(baseUrl);
  if (!host) {
    return '';
  }

  return RELAY_HOST_PROVIDER_ALIASES.find((entry) => entry.pattern.test(host))?.provider || '';
}

function isOfficialSlot(target: ProviderDisplayTarget): boolean {
  const keySlot = target.keySlotId ? keyManager.getKey(target.keySlotId) : undefined;
  if (keySlot) {
    return keySlot.type === 'official';
  }

  return normalizeValue(target.type).toLowerCase() === 'official';
}

function shouldUseCanonicalOfficialLabel(target: ProviderDisplayTarget, provider: string): boolean {
  if (!provider || !isOfficialSlot(target)) {
    return false;
  }

  return provider === 'Google' || provider === 'OpenAI';
}

function isOfficialAlias(provider: string, providerLabel?: string): boolean {
  const normalizedProvider = normalizeValue(provider);
  const normalizedLabel = normalizeValue(providerLabel).toLowerCase();
  if (!normalizedProvider || !normalizedLabel) {
    return false;
  }

  const aliases = OFFICIAL_PROVIDER_ALIASES[normalizedProvider];
  return Array.isArray(aliases) && aliases.includes(normalizedLabel);
}

export function getCanonicalProviderDisplayName(provider?: string): string {
  const normalizedProvider = normalizeValue(provider);
  const metadata = getProviderMetadata(normalizedProvider);

  if (metadata.kind === 'relay' && metadata.label) {
    return metadata.label;
  }

  if (normalizedProvider === 'Google') {
    return getCurrentLanguage() === 'en-US' ? 'Google' : '谷歌';
  }

  if (normalizedProvider === 'OpenAI') {
    return 'OpenAI';
  }

  return metadata.label && metadata.kind !== 'custom' ? metadata.label : normalizedProvider;
}

export function resolveProviderIdentity(target: ProviderDisplayTarget): {
  provider?: string;
  providerLabel?: string;
} {
  const currentLabel = String(target.providerLabel || '').trim();
  const relayProviderFromBaseUrl = resolveRelayProviderFromBaseUrl(target.baseUrl);
  const currentProvider = relayProviderFromBaseUrl || String(target.provider || '').trim();
  const linkedProvider = target.keySlotId ? keyManager.getProviderForKeySlot(target.keySlotId) : undefined;
  const keySlot = target.keySlotId ? keyManager.getKey(target.keySlotId) : undefined;
  const routeLabel = String(linkedProvider?.name || keySlot?.name || '').trim();
  const resolvedProvider = normalizeValue(relayProviderFromBaseUrl || linkedProvider?.name || keySlot?.provider || currentProvider);

  if (relayProviderFromBaseUrl) {
    const metadata = getProviderMetadata(relayProviderFromBaseUrl);
    return {
      provider: relayProviderFromBaseUrl,
      providerLabel: metadata.label || relayProviderFromBaseUrl,
    };
  }

  if (shouldUseCanonicalOfficialLabel(target, resolvedProvider || currentProvider)) {
    const canonical = getCanonicalProviderDisplayName(resolvedProvider || currentProvider);
    return {
      provider: resolvedProvider || currentProvider,
      providerLabel: canonical,
    };
  }

  if (
    (currentProvider === 'Google' || currentProvider === 'OpenAI')
    && isOfficialAlias(currentProvider, currentLabel)
  ) {
    return {
      provider: currentProvider,
      providerLabel: getCanonicalProviderDisplayName(currentProvider),
    };
  }

  // When a node is still bound to a concrete route, the route label is the
  // authoritative display source. This prevents stale labels from a previous
  // provider (for example an old proxy name) from leaking into the current UI.
  if (routeLabel) {
    return {
      provider: resolvedProvider || currentProvider,
      providerLabel: routeLabel,
    };
  }

  if (currentLabel) {
    return {
      provider: currentProvider || currentLabel,
      providerLabel: currentLabel,
    };
  }

  return {
    provider: currentProvider,
    providerLabel: getCanonicalProviderDisplayName(currentProvider) || currentProvider,
  };
}

export function resolveDisplayedProviderLabel(target: ProviderDisplayTarget): string {
  const resolved = resolveProviderIdentity(target);
  return normalizeValue(resolved.providerLabel || resolved.provider);
}
