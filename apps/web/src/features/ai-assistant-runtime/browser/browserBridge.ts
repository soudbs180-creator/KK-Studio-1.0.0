export type BrowserBridgeConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type BrowserBridgeCommandKind =
  | 'get_status'
  | 'extract_product'
  | 'generate_external'
  | 'publish_draft'
  | 'inspect_page'
  | 'open_desktop_project'
  | 'check_local_llm'
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

const SENSITIVE_KEY_PATTERN = /authorization|api[-_]?key|cookie|token|secret|password|credential|jwt|local[-_]?endpoint|endpoint/i;
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

// -------------------------------------------------------------
// 浏览器桥全局单例连接管理器 (实现真实守护进程与 Chrome 插件的回调通道)
// -------------------------------------------------------------
let globalWsClient: any = null;
let currentDaemonStatus: BrowserBridgeConnectionStatus = 'disconnected';
let currentExtensionStatus: BrowserBridgeConnectionStatus = 'disconnected';
let currentLatency: number | null = null;

if (typeof window !== 'undefined') {
  class RobustWebSocket {
    private ws: WebSocket | null = null;
    private url: string;
    private autoReconnect: boolean = true;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000;
    private onMessageCallback: (msg: any) => void;
    private onStatusCallback: (status: BrowserBridgeConnectionStatus) => void;
    private reconnectTimer: any = null;

    constructor(
      url: string,
      onMessage: (msg: any) => void,
      onStatus: (status: BrowserBridgeConnectionStatus) => void
    ) {
      this.url = url;
      this.onMessageCallback = onMessage;
      this.onStatusCallback = onStatus;
    }

    connect() {
      if (this.ws) {
        this.disconnect();
      }
      this.onStatusCallback('connecting');
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.onStatusCallback('connected');
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.onMessageCallback(data);
          } catch {
            this.onMessageCallback(event.data);
          }
        };

        this.ws.onclose = () => {
          this.onStatusCallback('disconnected');
          if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const backoff = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
            this.reconnectTimer = window.setTimeout(() => this.connect(), backoff);
          }
        };

        this.ws.onerror = () => {
          this.onStatusCallback('error');
        };
      } catch (err) {
        this.onStatusCallback('error');
      }
    }

    disconnect() {
      this.autoReconnect = false;
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      if (this.ws) {
        try {
          this.ws.close();
        } catch (err) {
          // 忽略关闭异常
        }
        this.ws = null;
      }
    }

    send(data: any): boolean {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        return true;
      }
      return false;
    }
  }

  const pendingCommands = new Map<string, {
    resolve: (value: BrowserBridgeResult) => void;
    timer: any;
  }>();

  const globalBridgeClient: BrowserBridgeClient = {
    async getStatus(): Promise<BrowserBridgeStatusSnapshot> {
      return {
        daemonStatus: currentDaemonStatus,
        extensionStatus: currentExtensionStatus,
        latencyMs: currentLatency,
        setupRequired: currentDaemonStatus !== 'connected' || currentExtensionStatus !== 'connected',
        setupHint: SETUP_HINT,
        platforms: JSON.parse(localStorage.getItem('kk_browser_platforms') || '[]'),
        sessions: JSON.parse(localStorage.getItem('kk_browser_sessions') || '[]'),
        socialChannels: JSON.parse(localStorage.getItem('kk_browser_social_channels') || '[]')
      };
    },

    async execute(command: BrowserBridgeCommand): Promise<BrowserBridgeResult> {
      if (!globalWsClient || currentDaemonStatus !== 'connected') {
        return createBrowserBridgeSetupRequiredResult(command.id);
      }

      const sent = globalWsClient.send({
        type: 'browser_bridge_command',
        command
      });

      if (!sent) {
        return createBrowserBridgeSetupRequiredResult(command.id);
      }

      return new Promise<BrowserBridgeResult>((resolve) => {
        const timer = setTimeout(() => {
          if (pendingCommands.has(command.id)) {
            pendingCommands.delete(command.id);
            resolve({
              id: command.id,
              status: 'failed',
              summary: '等待本地守护进程或 Chrome 插件回传结果超时。',
              error: 'Timeout waiting for response',
              audit: {
                redacted: true,
                commandKind: command.kind,
                targetHost: command.target
              }
            });
          }
        }, 30000); // 30秒超时

        pendingCommands.set(command.id, { resolve, timer });
      });
    }
  };

  (window as any).__KK_BROWSER_BRIDGE__ = globalBridgeClient;

  globalWsClient = new RobustWebSocket(
    'ws://localhost:9099',
    (msg) => {
      console.log('[Global Native WS Message]', msg);
      if (msg && typeof msg === 'object') {
        const commandId = msg.commandId || msg.id;
        if (commandId) {
          const pending = pendingCommands.get(commandId);
          if (pending) {
            pendingCommands.delete(commandId);
            clearTimeout(pending.timer);
            pending.resolve({
              id: commandId,
              status: msg.status || 'success',
              summary: msg.summary || '指令执行完成。',
              data: msg.data,
              error: msg.error,
              audit: {
                redacted: true,
                commandKind: msg.commandKind,
                targetHost: msg.targetHost
              }
            });
          }
        }

        // 全局分发自定义事件，供组件监听异步结果更新
        window.dispatchEvent(new CustomEvent('browser-bridge-message', { detail: msg }));

        // 异步生成成功时自动画入画布
        if (
          msg.status === 'success' &&
          (msg.commandKind === 'generate_external' || msg.kind === 'generate_external') &&
          msg.data
        ) {
          const data = msg.data;
          const imageUrl = data.finalImageUrl || data.imageUrl || data.resultUrl;
          if (imageUrl) {
            window.dispatchEvent(
              new CustomEvent('takeover-create-prompt-cards', {
                detail: {
                  prompts: [
                    `流水线自动编排海报: ${data.productTitle || data.title || 'Browser Bridge pipeline result'}\n营销文案: ${data.postText || data.caption || data.body || data.summary || 'Browser Bridge 已返回外部网页生成结果。'}`
                  ],
                  imageUrl: imageUrl
                }
              })
            );
          }
        }
      }
    },
    (status) => {
      currentDaemonStatus = status;
      if (status === 'connected') {
        currentExtensionStatus = 'connected';
        currentLatency = 8;
      } else {
        currentExtensionStatus = 'disconnected';
        currentLatency = null;
      }
    }
  );

  globalWsClient.connect();
}

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
