export type BrowserBridgeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type BrowserBridgeCommandKind =
  | 'get_status'
  | 'extract_product'
  | 'generate_external'
  | 'publish_draft'
  | 'write_back_dom';

export interface BrowserBridgeCommand {
  id: string;
  kind: BrowserBridgeCommandKind;
  target?: string;
  payload: Record<string, any>;
  auditPayload?: Record<string, any>;
  requiresUserGesture: boolean;
  createdAt: number;
}

export interface BrowserBridgeResult<TData = any> {
  id: string;
  status: 'success' | 'queued' | 'setup_required' | 'failed';
  summary: string;
  data?: TData;
  error?: string;
  audit: {
    redacted: boolean;
    commandKind?: BrowserBridgeCommandKind;
    targetHost?: string;
  };
}

export interface BrowserBridgeStatusSnapshot {
  daemonStatus: BrowserBridgeConnectionStatus;
  extensionStatus: BrowserBridgeConnectionStatus;
  latencyMs?: number | null;
  setupRequired: boolean;
  setupHint: string;
  platforms: Array<{ id: string; name?: string; enabled?: boolean; status?: string }>;
  sessions: Array<{ id: string; platformId?: string; username?: string; enabled?: boolean; status?: string }>;
  socialChannels: Array<{ id: string; name?: string; enabled?: boolean; status?: string }>;
}

export interface BrowserBridgeClient {
  getStatus?: () => Promise<BrowserBridgeStatusSnapshot> | BrowserBridgeStatusSnapshot;
  execute?: (command: BrowserBridgeCommand) => Promise<BrowserBridgeResult> | BrowserBridgeResult;
}

export interface BrowserBridgeExecuteOptions {
  client?: BrowserBridgeClient;
  snapshot?: Partial<BrowserBridgeStatusSnapshot>;
  transport?: (command: BrowserBridgeCommand) => Promise<BrowserBridgeResult> | BrowserBridgeResult;
}

const SETUP_HINT = '请先启动本地守护进程并连接 Chrome Bridge 插件，然后回到浏览器助手重试。';

const SENSITIVE_KEY_PATTERN = /authorization|api[-_]?key|cookie|token|secret|password|credential|jwt/i;
const BEARER_PATTERN = /^Bearer\s+/i;
const API_KEY_PATTERN = /^sk-[a-zA-Z0-9_-]{8,}/i;

const isPlainObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPrivateIpv4 = (hostname: string): boolean => {
  const parts = hostname.split('.').map(part => Number(part));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 0)
  );
};

const isPrivateIpv6 = (hostname: string): boolean => {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
};

const assertPublicBrowserHost = (url: URL): void => {
  const hostname = url.hostname.toLowerCase();
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
  if (
    normalizedHostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    isPrivateIpv4(normalizedHostname) ||
    isPrivateIpv6(normalizedHostname)
  ) {
    throw new Error('Browser Bridge cannot target localhost, browser internals, or private network URLs.');
  }
};

export const sanitizeBrowserBridgeUrl = (rawUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Browser Bridge requires a valid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Browser Bridge only accepts http or https URLs.');
  }

  assertPublicBrowserHost(parsed);
  return parsed.toString();
};

const sanitizeCommandTarget = (target?: string): string | undefined => {
  if (!target) return undefined;
  if (/^https?:\/\//i.test(target)) {
    return sanitizeBrowserBridgeUrl(target);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    throw new Error('Browser Bridge only accepts http or https URLs for URL targets.');
  }
  return target;
};

export const redactBrowserBridgePayload = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(item => redactBrowserBridgePayload(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          return [key, '[redacted]'];
        }
        return [key, redactBrowserBridgePayload(entry)];
      })
    );
  }

  if (typeof value === 'string') {
    if (BEARER_PATTERN.test(value) || API_KEY_PATTERN.test(value) || value.length > 64) {
      return '[redacted]';
    }
  }

  return value;
};

export const createBrowserBridgeCommand = (input: {
  kind: BrowserBridgeCommandKind;
  target?: string;
  payload?: Record<string, any>;
  requiresUserGesture?: boolean;
}): BrowserBridgeCommand => {
  const payload = input.payload || {};
  return {
    id: `browser_cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    kind: input.kind,
    target: sanitizeCommandTarget(input.target),
    payload,
    auditPayload: redactBrowserBridgePayload(payload),
    requiresUserGesture: input.requiresUserGesture ?? false,
    createdAt: Date.now()
  };
};

export const createBrowserBridgeSetupRequiredResult = (
  commandId = `browser_cmd_${Date.now()}`
): BrowserBridgeResult => ({
  id: commandId,
  status: 'setup_required',
  summary: SETUP_HINT,
  error: 'Browser Bridge disconnected',
  audit: {
    redacted: true
  }
});

const createDisconnectedStatus = (snapshot?: Partial<BrowserBridgeStatusSnapshot>): BrowserBridgeStatusSnapshot => ({
  daemonStatus: snapshot?.daemonStatus || 'disconnected',
  extensionStatus: snapshot?.extensionStatus || 'disconnected',
  latencyMs: snapshot?.latencyMs ?? null,
  setupRequired: snapshot?.setupRequired ?? true,
  setupHint: snapshot?.setupHint || SETUP_HINT,
  platforms: snapshot?.platforms || [],
  sessions: snapshot?.sessions || [],
  socialChannels: snapshot?.socialChannels || []
});

const resolveWindowBridge = (): BrowserBridgeClient | null => {
  if (typeof window === 'undefined') return null;
  return ((window as any).__KK_BROWSER_BRIDGE__ || null) as BrowserBridgeClient | null;
};

export const browserBridgeAdapter = {
  async getStatus(options: BrowserBridgeExecuteOptions = {}): Promise<BrowserBridgeStatusSnapshot> {
    const client = options.client || resolveWindowBridge();
    if (client?.getStatus) {
      return await client.getStatus();
    }
    return createDisconnectedStatus(options.snapshot);
  },

  async execute(
    command: BrowserBridgeCommand,
    options: BrowserBridgeExecuteOptions = {}
  ): Promise<BrowserBridgeResult> {
    const client = options.client || resolveWindowBridge();
    if (client?.execute) {
      return await client.execute(command);
    }

    const status = await this.getStatus(options);
    if (status.daemonStatus !== 'connected' || status.extensionStatus !== 'connected') {
      return createBrowserBridgeSetupRequiredResult(command.id);
    }

    if (options.transport) {
      return await options.transport(command);
    }

    return createBrowserBridgeSetupRequiredResult(command.id);
  }
};
