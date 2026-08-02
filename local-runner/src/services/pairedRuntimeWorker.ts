import { randomUUID } from 'node:crypto';
import {
  PairedRuntimeCapabilityManifestSchema,
  PairedRuntimeCommandSchema,
  type PairedRuntimeCapabilityManifest,
  type PairedRuntimeCommand,
  type PairedRuntimeOpencliCommand,
} from '../contracts/pairedRuntime';
import { opencliService } from './opencliService';

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const RUNTIME_CREDENTIAL_HEADER = 'x-kk-runtime-credential';

interface ApiEnvelope<T> {
  success: true;
  data: T;
}

export interface PairedRuntimeCommandResult {
  status: 'completed' | 'failed';
  resultSummary?: string;
  errorCode?: string;
}

export interface PairedRuntimeWorkerOptions {
  apiBaseUrl: string;
  runtimeId: string;
  credential: string;
  capabilityManifest: PairedRuntimeCapabilityManifest;
  executeCommand: (command: PairedRuntimeCommand) => Promise<PairedRuntimeCommandResult>;
  fetchImpl?: typeof fetch;
  heartbeatIntervalMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
}

function assertSafeControlPlaneUrl(value: string): URL {
  const url = new URL(value);
  const loopbackHttp = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !loopbackHttp) {
    throw new Error('Paired runtime control plane must use HTTPS or loopback HTTP.');
  }
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return url;
}

function buildEndpoint(baseUrl: URL, path: string): string {
  const normalized = baseUrl.toString().endsWith('/') ? baseUrl : new URL(`${baseUrl.toString()}/`);
  return new URL(path.replace(/^\//, ''), normalized).toString();
}

function parseApiEnvelope<T>(value: unknown): ApiEnvelope<T> {
  if (!value || typeof value !== 'object' || (value as { success?: unknown }).success !== true || !('data' in value)) {
    throw new Error('Paired runtime control plane returned an invalid response envelope.');
  }
  return value as ApiEnvelope<T>;
}

export class PairedRuntimeWorker {
  private readonly apiBaseUrl: URL;
  private readonly fetchImpl: typeof fetch;
  private readonly heartbeatIntervalMs: number;
  private readonly pollIntervalMs: number;
  private readonly now: () => number;
  private lastHeartbeatAt = 0;
  private running = false;
  private timer: NodeJS.Timeout | undefined;

  public constructor(private readonly options: PairedRuntimeWorkerOptions) {
    this.apiBaseUrl = assertSafeControlPlaneUrl(options.apiBaseUrl);
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.pollIntervalMs = options.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
    this.now = options.now || Date.now;
    PairedRuntimeCapabilityManifestSchema.parse(options.capabilityManifest);
    if (!/^[0-9a-f-]{36}$/i.test(options.runtimeId) || options.credential.length < 32) {
      throw new Error('Paired runtime ID or credential is invalid.');
    }
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    void this.tick();
  }

  public stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Runs one authenticated outbound cycle; exposed for deterministic integration tests. */
  public async runOnce(): Promise<void> {
    if (this.now() - this.lastHeartbeatAt >= this.heartbeatIntervalMs) await this.sendHeartbeat();
    const command = await this.claimCommand();
    if (!command) return;
    const result = await this.executeSafely(command);
    await this.completeCommand(command, result);
  }

  private async tick(): Promise<void> {
    try {
      await this.runOnce();
    } catch {
      // The next bounded poll retries; credentials and response bodies are never logged.
    }
    if (this.running) this.timer = setTimeout(() => void this.tick(), this.pollIntervalMs);
  }

  private async request(path: string, body?: unknown): Promise<unknown> {
    const response = await this.fetchImpl(buildEndpoint(this.apiBaseUrl, path), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [RUNTIME_CREDENTIAL_HEADER]: this.options.credential,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Paired runtime control plane request failed with status ${response.status}.`);
    return response.json();
  }

  private async sendHeartbeat(): Promise<void> {
    const observedAt = new Date(this.now()).toISOString();
    await this.request(`api/v1/paired-runtimes/${encodeURIComponent(this.options.runtimeId)}/heartbeat`, {
      capabilityManifest: this.options.capabilityManifest,
      observedAt,
    });
    this.lastHeartbeatAt = this.now();
  }

  private async claimCommand(): Promise<PairedRuntimeCommand | null> {
    const response = parseApiEnvelope<unknown>(await this.request(
      `api/v1/paired-runtimes/${encodeURIComponent(this.options.runtimeId)}/commands/claim`,
    ));
    return response.data === null ? null : PairedRuntimeCommandSchema.parse(response.data);
  }

  private async executeSafely(command: PairedRuntimeCommand): Promise<PairedRuntimeCommandResult> {
    try {
      return await this.options.executeCommand(command);
    } catch {
      return { status: 'failed', errorCode: 'PAIRED_RUNTIME_EXECUTION_FAILED' };
    }
  }

  private async completeCommand(command: PairedRuntimeCommand, result: PairedRuntimeCommandResult): Promise<void> {
    await this.request(
      `api/v1/paired-runtimes/${encodeURIComponent(this.options.runtimeId)}/commands/${encodeURIComponent(command.commandId)}/result`,
      { leaseToken: command.leaseToken, ...result },
    );
  }
}

export async function executePairedOpencliCommand(command: PairedRuntimeCommand): Promise<PairedRuntimeCommandResult> {
  const summaries: string[] = [];
  for (const [index, item] of command.executionEnvelope.commands.entries()) {
    const result = await opencliService.executeCommand({
      ...(item as PairedRuntimeOpencliCommand),
      logId: `paired:${command.commandId}:${index}:${randomUUID()}`,
    });
    summaries.push(result.summary);
  }
  return { status: 'completed', resultSummary: summaries.join(' ').slice(0, 1000) };
}

export function createPairedRuntimeWorkerFromEnvironment(): PairedRuntimeWorker | null {
  const apiBaseUrl = process.env.KK_PAIRED_RUNTIME_API_BASE_URL;
  const runtimeId = process.env.KK_PAIRED_RUNTIME_ID;
  const credential = process.env.KK_PAIRED_RUNTIME_CREDENTIAL;
  if (!apiBaseUrl || !runtimeId || !credential) return null;
  const siteAdapters = String(process.env.KK_PAIRED_RUNTIME_SITE_ADAPTERS || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  return new PairedRuntimeWorker({
    apiBaseUrl,
    runtimeId,
    credential,
    capabilityManifest: {
      schemaVersion: 1,
      runtimeVersion: process.env.KK_STUDIO_VERSION || 'local-runner',
      tools: ['browser.inspectPage', 'browser.extractProduct'],
      siteAdapters,
    },
    executeCommand: executePairedOpencliCommand,
  });
}
