import {
  GenerationJobDtoV3Schema,
  GenerationJobEventSchema,
  type GenerationJobDto,
  type GenerationJobEvent,
} from '@kk/shared';
import {
  getPreferredKkApiAccessToken,
  refreshPreferredKkApiAccessToken,
} from '../api/authAccessToken.ts';
import { resolveKkApiBaseUrl } from '../api/kkApiBaseUrl.ts';
import { getRuntimeOwnerId } from '../auth/runtimeSessionProfile.ts';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 4;
const MAX_RECONNECT_DELAY_MS = 8_000;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type Sleep = (delayMs: number, signal?: AbortSignal) => Promise<void>;

export interface GenerationJobObserverOptions {
  apiBaseUrl?: string;
  fetchImpl?: FetchLike;
  getAccessToken?: () => Promise<string | undefined | null>;
  getOwnerId?: () => string;
  maxReconnectAttempts?: number;
  onEvent?: (job: GenerationJobDto, event: GenerationJobEvent) => void;
  reconnectBaseDelayMs?: number;
  refreshAccessToken?: () => Promise<string | undefined | null>;
  signal?: AbortSignal;
  sleep?: Sleep;
}

export class GenerationJobObservationError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'GenerationJobObservationError';
    this.code = code;
    this.retryable = retryable;
  }
}

function createAbortError(): GenerationJobObservationError {
  return new GenerationJobObservationError('ABORTED', 'Generation Job observation was aborted.');
}

function assertObservationActive(expectedOwnerId: string, options: GenerationJobObserverOptions): void {
  if (options.signal?.aborted) throw createAbortError();
  const currentOwnerId = (options.getOwnerId || getRuntimeOwnerId)();
  if (currentOwnerId !== expectedOwnerId) {
    throw new GenerationJobObservationError('OWNER_CHANGED', 'Generation Job owner changed while observing.');
  }
}

function createJobEventsUrl(jobId: string, apiBaseUrl: string): string {
  const normalizedBaseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`;
  return new URL(`api/v1/generation/jobs/${encodeURIComponent(jobId)}/events`, normalizedBaseUrl).toString();
}

function parseProjection(frame: string, expectedJobId: string): {
  event: GenerationJobEvent;
  job: GenerationJobDto;
} | null {
  const lines = frame.split('\n');
  const dataLines = lines.filter((line) => line.startsWith('data:'));
  if (dataLines.length === 0) return null;
  const rawData = dataLines.map((line) => line.slice(5).trimStart()).join('\n');
  const parsedEvent = GenerationJobEventSchema.safeParse(JSON.parse(rawData));
  if (!parsedEvent.success) {
    throw new GenerationJobObservationError('INVALID_EVENT', 'Generation Job event failed validation.', true);
  }
  const payload = parsedEvent.data.payload;
  const rawJob = payload && typeof payload === 'object' && 'job' in payload ? payload.job : undefined;
  const parsedJob = GenerationJobDtoV3Schema.safeParse(rawJob);
  if (!parsedJob.success || parsedEvent.data.jobId !== expectedJobId || parsedJob.data.jobId !== expectedJobId) {
    throw new GenerationJobObservationError('INVALID_PROJECTION', 'Generation Job projection failed validation.', true);
  }
  return { event: parsedEvent.data, job: parsedJob.data };
}

async function consumeEventStream(
  response: Response,
  jobId: string,
  expectedOwnerId: string,
  options: GenerationJobObserverOptions,
): Promise<GenerationJobDto | undefined> {
  const reader = response.body?.getReader();
  if (!reader) throw new GenerationJobObservationError('STREAM_UNAVAILABLE', 'SSE response body is unavailable.', true);
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
      let boundaryIndex = buffer.indexOf('\n\n');
      while (boundaryIndex >= 0) {
        assertObservationActive(expectedOwnerId, options);
        const projection = parseProjection(buffer.slice(0, boundaryIndex), jobId);
        buffer = buffer.slice(boundaryIndex + 2);
        if (projection) {
          options.onEvent?.(projection.job, projection.event);
          if (TERMINAL_STATUSES.has(projection.job.status)) return projection.job;
        }
        boundaryIndex = buffer.indexOf('\n\n');
      }
    }
    return undefined;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function waitForDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(createAbortError());
  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      clearTimeout(timeoutId);
      reject(createAbortError());
    };
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

async function fetchEventStream(
  jobId: string,
  accessToken: string,
  options: GenerationJobObserverOptions,
): Promise<Response> {
  const fetchImpl = options.fetchImpl || fetch;
  const apiBaseUrl = options.apiBaseUrl || resolveKkApiBaseUrl();
  return fetchImpl(createJobEventsUrl(jobId, apiBaseUrl), {
    method: 'GET',
    headers: { Accept: 'text/event-stream', Authorization: `Bearer ${accessToken}` },
    signal: options.signal,
  });
}

function normalizeObservationError(error: unknown): GenerationJobObservationError {
  if (error instanceof GenerationJobObservationError) return error;
  return new GenerationJobObservationError('STREAM_INTERRUPTED', 'Generation Job stream was interrupted.', true);
}

async function resolveResponse(
  jobId: string,
  accessToken: string,
  canRefresh: boolean,
  options: GenerationJobObserverOptions,
): Promise<{ accessToken: string; refreshed: boolean; response: Response }> {
  let response = await fetchEventStream(jobId, accessToken, options);
  if (response.status !== 401) return { accessToken, refreshed: false, response };
  if (!canRefresh) {
    throw new GenerationJobObservationError('AUTH_REQUIRED', 'Generation Job stream authentication expired.');
  }
  const refreshAccessToken = options.refreshAccessToken || refreshPreferredKkApiAccessToken;
  const refreshedToken = String(await refreshAccessToken() || '').trim();
  if (!refreshedToken) {
    throw new GenerationJobObservationError('AUTH_REQUIRED', 'Generation Job stream requires authentication.');
  }
  response = await fetchEventStream(jobId, refreshedToken, options);
  return { accessToken: refreshedToken, refreshed: true, response };
}

/** Observes one owner-scoped Generation v3 Job until terminal state or an explicit 404 fallback. */
export async function observeGenerationJob(
  jobId: string,
  options: GenerationJobObserverOptions = {},
): Promise<GenerationJobDto | null> {
  const expectedOwnerId = (options.getOwnerId || getRuntimeOwnerId)();
  const getAccessToken = options.getAccessToken || getPreferredKkApiAccessToken;
  let accessToken = String(await getAccessToken() || '').trim();
  if (!accessToken) throw new GenerationJobObservationError('AUTH_REQUIRED', 'Generation Job stream requires authentication.');
  const maxAttempts = options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS;
  const baseDelayMs = options.reconnectBaseDelayMs ?? 500;
  const sleep = options.sleep || waitForDelay;
  let hasRefreshed = false;

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    assertObservationActive(expectedOwnerId, options);
    try {
      const resolved = await resolveResponse(jobId, accessToken, !hasRefreshed, options);
      accessToken = resolved.accessToken;
      hasRefreshed ||= resolved.refreshed;
      if (resolved.response.status === 404) return null;
      if (!resolved.response.ok) {
        throw new GenerationJobObservationError('STREAM_HTTP_ERROR', `Generation Job stream returned HTTP ${resolved.response.status}.`, resolved.response.status >= 500);
      }
      const terminalJob = await consumeEventStream(resolved.response, jobId, expectedOwnerId, options);
      if (terminalJob) return terminalJob;
      throw new GenerationJobObservationError('STREAM_ENDED', 'Generation Job stream ended before a terminal projection.', true);
    } catch (error) {
      if (options.signal?.aborted) throw createAbortError();
      const observationError = normalizeObservationError(error);
      if (!observationError.retryable || attempt >= maxAttempts) throw observationError;
      const delayMs = Math.min(baseDelayMs * (2 ** attempt), MAX_RECONNECT_DELAY_MS);
      await sleep(delayMs, options.signal);
    }
  }
  throw new GenerationJobObservationError('STREAM_INTERRUPTED', 'Generation Job stream retry budget was exhausted.');
}
