export type RequestProfileId =
  | "12ai"
  | "gpt-best"
  | "suxi"
  | "wuyinkeji"
  | "openai-official"
  | "anthropic-official"
  | "generic-openai";

export type RequestProfileEvidenceSource =
  | "explicit-provider"
  | "docs-url"
  | "api-base"
  | "unknown";

export interface RequestProfile {
  id: RequestProfileId;
  displayName: string;
  docSources: string[];
  providerAliases: string[];
  docsUrlPatterns: RegExp[];
  hostPatterns: RegExp[];
  basePatterns: RegExp[];
  supportedProtocolFamilies: Array<"openai-compatible" | "gemini-native" | "claude-native">;
  requestSurfaceDefaults: {
    chat?: string;
    image?: string;
    video?: string;
  };
  apiBaseUrlPolicy: "profile-fixed" | "runtime-supplied";
  fallbackProfileId?: RequestProfileId;
}

export interface RequestProfileEvidence {
  profileId: RequestProfileId | "unknown";
  sourceType: RequestProfileEvidenceSource;
  isDocumentationUrl: boolean;
  canUseAsApiBaseUrl: boolean;
}

const REQUEST_PROFILES: RequestProfile[] = [
  {
    id: "12ai",
    displayName: "12AI",
    docSources: ["https://doc.12ai.org/api/", "https://doc.12ai.org/docs/api"],
    providerAliases: ["12ai", "12 api", "12api"],
    docsUrlPatterns: [
      /^https?:\/\/doc\.12ai\.org\/(?:api|docs\/api)(?:\/|$|[?#])/i,
    ],
    hostPatterns: [/^cdn\.12ai\.org$/i, /^new\.12ai\.org$/i, /^hk\.12ai\.org$/i, /(^|\.)12ai\.(org|xyz|io|net)$/i],
    basePatterns: [/12ai\.(org|xyz|io|net)/i],
    supportedProtocolFamilies: ["openai-compatible", "gemini-native", "claude-native"],
    requestSurfaceDefaults: {
      chat: "gemini-native-chat",
      image: "gemini-native-image",
    },
    apiBaseUrlPolicy: "runtime-supplied",
  },
  {
    id: "gpt-best",
    displayName: "GPT Best",
    docSources: ["https://gpt-best.apifox.cn/llms.txt"],
    providerAliases: ["gpt-best", "gpt best", "gptbest"],
    docsUrlPatterns: [/^https?:\/\/gpt-best\.apifox\.cn\/(?:llms\.txt|doc-\d+\.md|api-\d+\.md|schema-\d+\.md)(?:$|[?#])/i],
    hostPatterns: [/(^|[.-])gpt-?best(?=[.-]|$)/i],
    basePatterns: [/gpt-best/i, /gptbest/i],
    supportedProtocolFamilies: ["openai-compatible", "gemini-native", "claude-native"],
    requestSurfaceDefaults: {
      chat: "openai-chat",
      image: "provider-images",
    },
    apiBaseUrlPolicy: "runtime-supplied",
  },
  {
    id: "suxi",
    displayName: "New Suxi AI",
    docSources: ["https://new-suxi-ai.apifox.cn/llms.txt"],
    providerAliases: ["new-suxi-ai", "new suxi ai", "new suxi", "suxi ai", "suxi"],
    docsUrlPatterns: [/^https?:\/\/new-suxi-ai\.apifox\.cn\/(?:llms\.txt|doc-\d+\.md|api-\d+\.md|schema-\d+\.md)(?:$|[?#])/i],
    hostPatterns: [/^new\.suxi\.ai$/i, /(^|\.)suxi\.ai$/i],
    basePatterns: [/new\.suxi\.ai/i, /suxi/i],
    supportedProtocolFamilies: ["openai-compatible", "gemini-native", "claude-native"],
    requestSurfaceDefaults: {
      chat: "openai-chat",
      image: "provider-images",
    },
    apiBaseUrlPolicy: "runtime-supplied",
  },
  {
    id: "wuyinkeji",
    displayName: "Wuyin Keji",
    docSources: ["https://api.wuyinkeji.com/type/all", "https://api.wuyinkeji.com/doc/65", "https://api.wuyinkeji.com/doc/72"],
    providerAliases: ["wuyin", "wuyin keji", "wuyinkeji", "wu yin", "suchuang", "su chuang", "速创", "速创 api"],
    docsUrlPatterns: [
      /^https?:\/\/api\.wuyinkeji\.com\/(?:type\/all|doc\/\d+)(?:$|[?#])/i,
    ],
    hostPatterns: [/^api\.wuyinkeji\.com$/i],
    basePatterns: [/api\.wuyinkeji\.com/i, /wuyinkeji/i],
    supportedProtocolFamilies: ["openai-compatible", "gemini-native"],
    requestSurfaceDefaults: {
      image: "async-image",
      video: "async-video",
    },
    apiBaseUrlPolicy: "runtime-supplied",
  },
  {
    id: "openai-official",
    displayName: "OpenAI API",
    docSources: ["https://platform.openai.com/docs/api-reference/chat/create-chat-completion"],
    providerAliases: ["openai", "openai api", "openai official"],
    docsUrlPatterns: [/^https?:\/\/platform\.openai\.com\/docs\//i],
    hostPatterns: [/^api\.openai\.com$/i],
    basePatterns: [/api\.openai\.com/i],
    supportedProtocolFamilies: ["openai-compatible"],
    requestSurfaceDefaults: {
      chat: "openai-chat",
      image: "provider-images",
    },
    apiBaseUrlPolicy: "profile-fixed",
  },
  {
    id: "anthropic-official",
    displayName: "Anthropic API",
    docSources: ["https://docs.anthropic.com/en/api/getting-started"],
    providerAliases: ["anthropic", "anthropic api", "anthropic official"],
    docsUrlPatterns: [/^https?:\/\/docs\.anthropic\.com\/en\/api\//i],
    hostPatterns: [/^api\.anthropic\.com$/i],
    basePatterns: [/api\.anthropic\.com/i],
    supportedProtocolFamilies: ["claude-native"],
    requestSurfaceDefaults: {
      chat: "claude-messages",
    },
    apiBaseUrlPolicy: "profile-fixed",
  },
  {
    id: "generic-openai",
    displayName: "Generic OpenAI-Compatible",
    docSources: [],
    providerAliases: [],
    docsUrlPatterns: [],
    hostPatterns: [],
    basePatterns: [],
    supportedProtocolFamilies: ["openai-compatible", "gemini-native", "claude-native"],
    requestSurfaceDefaults: {
      chat: "openai-chat",
      image: "chat-image",
    },
    apiBaseUrlPolicy: "runtime-supplied",
  },
];

function normalizeProviderAlias(value?: string): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeBaseUrl(baseUrl?: string): string {
  return String(baseUrl || "").trim().replace(/\/+$/, "");
}

function normalizeHost(baseUrl?: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";

  const candidates = /^https?:\/\//i.test(normalized)
    ? [normalized]
    : [`https://${normalized}`, `http://${normalized}`];

  for (const candidate of candidates) {
    try {
      return new URL(candidate).hostname.toLowerCase();
    } catch {
      continue;
    }
  }

  return "";
}

function matchesRegex(patterns: RegExp[], value: string): boolean {
  return Boolean(value) && patterns.some((pattern) => pattern.test(value));
}

function matchesProviderAlias(profile: RequestProfile, provider?: string): boolean {
  const normalized = normalizeProviderAlias(provider);
  if (!normalized) return false;
  if (profile.id === "gpt-best" && (normalized.includes("llms.txt") || normalized.includes("llms"))) {
    return true;
  }
  return profile.providerAliases.includes(normalized);
}

function matchesDocumentationUrl(profile: RequestProfile, baseUrl?: string): boolean {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return false;
  if (profile.id === "gpt-best" && /\/llms\.txt(?:$|[?#])/i.test(normalized)) {
    return true;
  }
  return matchesRegex(profile.docsUrlPatterns, normalized);
}

function matchesApiBase(profile: RequestProfile, baseUrl?: string): boolean {
  return matchesRegex(profile.basePatterns, normalizeBaseUrl(baseUrl))
    || matchesRegex(profile.hostPatterns, normalizeHost(baseUrl));
}

export function getRequestProfiles(): RequestProfile[] {
  return [...REQUEST_PROFILES];
}

export function getRequestProfile(id: RequestProfileId): RequestProfile | undefined {
  return REQUEST_PROFILES.find((profile) => profile.id === id);
}

export function detectRequestProfileEvidence(
  input: { provider?: string; baseUrl?: string },
  expectedProfileId?: Exclude<RequestProfileId, "generic-openai">,
): RequestProfileEvidence {
  const profiles = expectedProfileId
    ? REQUEST_PROFILES.filter((profile) => profile.id === expectedProfileId)
    : REQUEST_PROFILES.filter((profile) => profile.id !== "generic-openai");

  for (const profile of profiles) {
    const providerHit = matchesProviderAlias(profile, input.provider);
    const docsHit = matchesDocumentationUrl(profile, input.baseUrl);
    const apiBaseHit = matchesApiBase(profile, input.baseUrl) && !docsHit;

    if (providerHit) {
      return {
        profileId: profile.id,
        sourceType: "explicit-provider",
        isDocumentationUrl: docsHit,
        canUseAsApiBaseUrl: Boolean(normalizeBaseUrl(input.baseUrl)) && !docsHit,
      };
    }

    if (docsHit) {
      return {
        profileId: profile.id,
        sourceType: "docs-url",
        isDocumentationUrl: true,
        canUseAsApiBaseUrl: false,
      };
    }

    if (apiBaseHit) {
      return {
        profileId: profile.id,
        sourceType: "api-base",
        isDocumentationUrl: false,
        canUseAsApiBaseUrl: true,
      };
    }
  }

  return {
    profileId: "unknown",
    sourceType: "unknown",
    isDocumentationUrl: false,
    canUseAsApiBaseUrl: false,
  };
}

export function resolveLocalRequestProfile(input: {
  provider?: string;
  baseUrl?: string;
}): RequestProfile {
  const evidence = detectRequestProfileEvidence(input);
  if (evidence.profileId !== "unknown") {
    return getRequestProfile(evidence.profileId)!;
  }

  return getRequestProfile("generic-openai")!;
}
