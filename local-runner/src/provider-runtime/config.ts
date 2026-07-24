const DEFAULT_BASE_URL = 'http://127.0.0.1:8317/';
const DEFAULT_TIMEOUT_MS = 3_000;
const MIN_TIMEOUT_MS = 10;
const MAX_TIMEOUT_MS = 10_000;
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', '[::1]']);

type ProviderRuntimeEnvironment = Readonly<Record<string, string | undefined>>;

export interface ProviderRuntimeConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}

export class ProviderRuntimeConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ProviderRuntimeConfigurationError';
  }
}

function parseBaseUrl(value: string | undefined): string {
  try {
    const parsedUrl = new URL(value?.trim() || DEFAULT_BASE_URL);
    const hasUnsafeComponents = parsedUrl.protocol !== 'http:'
      || !LOOPBACK_HOSTNAMES.has(parsedUrl.hostname)
      || Boolean(parsedUrl.username || parsedUrl.password)
      || Boolean(parsedUrl.search || parsedUrl.hash)
      || (parsedUrl.pathname !== '/' && parsedUrl.pathname !== '');
    if (hasUnsafeComponents) {
      throw new Error('unsafe local provider runtime URL');
    }
    return `${parsedUrl.origin}/`;
  } catch (cause) {
    throw new ProviderRuntimeConfigurationError(
      'CLIProxyAPI base URL must be an HTTP loopback origin without credentials or a path.',
      { cause },
    );
  }
}

function parseTimeout(value: string | undefined): number {
  if (!value) {
    return DEFAULT_TIMEOUT_MS;
  }

  const timeoutMs = Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new ProviderRuntimeConfigurationError(
      `CLIProxyAPI timeout must be an integer from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS} ms.`,
    );
  }
  return timeoutMs;
}

/** Local provider runtime configuration defaults off and never accepts a remote origin. */
export function parseProviderRuntimeConfig(
  environment: ProviderRuntimeEnvironment = process.env,
): ProviderRuntimeConfig {
  const enabled = environment.KK_CLI_PROXY_ENABLED?.trim().toLowerCase() === 'true';
  const apiKey = environment.KK_CLI_PROXY_API_KEY?.trim();
  if (enabled && !apiKey) {
    throw new ProviderRuntimeConfigurationError(
      'CLIProxyAPI requires a local API key when the integration is enabled.',
    );
  }

  return {
    enabled,
    baseUrl: parseBaseUrl(environment.KK_CLI_PROXY_BASE_URL),
    ...(enabled ? { apiKey } : {}),
    timeoutMs: parseTimeout(environment.KK_CLI_PROXY_TIMEOUT_MS),
  };
}
