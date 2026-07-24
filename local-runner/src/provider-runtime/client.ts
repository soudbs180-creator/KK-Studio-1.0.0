import type { ZodType } from 'zod';
import type { ProviderRuntimeConfig } from './config';
import {
  ProviderRuntimeHealthSchema,
  ProviderRuntimeModelsSchema,
  type ProviderRuntimeHealth,
  type ProviderRuntimeModel,
} from './contracts';

const MAX_RESPONSE_BYTES = 1024 * 1024;

export type ProviderRuntimeErrorCode =
  | 'PROVIDER_RUNTIME_DISABLED'
  | 'PROVIDER_RUNTIME_INVALID_RESPONSE'
  | 'PROVIDER_RUNTIME_REJECTED'
  | 'PROVIDER_RUNTIME_TIMEOUT'
  | 'PROVIDER_RUNTIME_UNAVAILABLE';

export class ProviderRuntimeError extends Error {
  constructor(
    public readonly code: ProviderRuntimeErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ProviderRuntimeError';
  }
}

export type ProviderRuntimeFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

function responseTooLargeError(): ProviderRuntimeError {
  return new ProviderRuntimeError(
    'PROVIDER_RUNTIME_INVALID_RESPONSE',
    'CLIProxyAPI response exceeds the local size limit.',
  );
}

async function readBoundedBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw responseTooLargeError();
  }
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw responseTooLargeError();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, totalBytes).toString('utf8');
}

function parseBoundedJson<T>(rawBody: string, schema: ZodType<T>): T {
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_RESPONSE_BYTES) {
    throw responseTooLargeError();
  }

  try {
    return schema.parse(JSON.parse(rawBody) as unknown);
  } catch (cause) {
    if (cause instanceof ProviderRuntimeError) {
      throw cause;
    }
    throw new ProviderRuntimeError(
      'PROVIDER_RUNTIME_INVALID_RESPONSE',
      'CLIProxyAPI returned an invalid response.',
      { cause },
    );
  }
}

function mapTransportError(cause: unknown): ProviderRuntimeError {
  const errorName = cause instanceof Error ? cause.name : '';
  if (errorName === 'TimeoutError' || errorName === 'AbortError') {
    return new ProviderRuntimeError(
      'PROVIDER_RUNTIME_TIMEOUT',
      'CLIProxyAPI did not respond before the local timeout.',
      { cause },
    );
  }
  return new ProviderRuntimeError(
    'PROVIDER_RUNTIME_UNAVAILABLE',
    'CLIProxyAPI is unavailable on the configured loopback endpoint.',
    { cause },
  );
}

/** Read-only client for the two CLIProxyAPI endpoints approved by KK Studio. */
export class ProviderRuntimeClient {
  constructor(
    private readonly config: ProviderRuntimeConfig,
    private readonly fetchFn: ProviderRuntimeFetch = fetch,
  ) {}

  public get enabled(): boolean {
    return this.config.enabled;
  }

  private assertEnabled(): void {
    if (!this.config.enabled) {
      throw new ProviderRuntimeError(
        'PROVIDER_RUNTIME_DISABLED',
        'CLIProxyAPI integration is disabled.',
      );
    }
  }

  private async requestJson<T>(
    path: '/healthz' | '/v1/models',
    schema: ZodType<T>,
    authorize: boolean,
  ): Promise<T> {
    this.assertEnabled();
    try {
      const response = await this.fetchFn(new URL(path, this.config.baseUrl), {
        method: 'GET',
        headers: authorize ? { Authorization: `Bearer ${this.config.apiKey}` } : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (!response.ok) {
        throw new ProviderRuntimeError(
          'PROVIDER_RUNTIME_REJECTED',
          'CLIProxyAPI rejected the local request.',
        );
      }
      return parseBoundedJson(await readBoundedBody(response), schema);
    } catch (cause) {
      if (cause instanceof ProviderRuntimeError) {
        throw cause;
      }
      throw mapTransportError(cause);
    }
  }

  public getHealth(): Promise<ProviderRuntimeHealth> {
    return this.requestJson('/healthz', ProviderRuntimeHealthSchema, false);
  }

  public async listModels(): Promise<ProviderRuntimeModel[]> {
    const response = await this.requestJson('/v1/models', ProviderRuntimeModelsSchema, true);
    return response.data.map((model) => ({
      id: model.id,
      ...(model.owned_by ? { ownedBy: model.owned_by } : {}),
    }));
  }
}
