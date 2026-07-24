import { Router, type RequestHandler, type Response } from 'express';
import {
  ProviderRuntimeClient,
  ProviderRuntimeError,
} from '../provider-runtime/client';
import { parseProviderRuntimeConfig } from '../provider-runtime/config';
import type {
  ProviderRuntimeHealth,
  ProviderRuntimeModel,
} from '../provider-runtime/contracts';
import { localToken } from '../security/localToken';

interface ProviderRuntimeReader {
  readonly enabled: boolean;
  getHealth: () => Promise<ProviderRuntimeHealth>;
  listModels: () => Promise<ProviderRuntimeModel[]>;
}

export interface ProviderRuntimeRouterOptions {
  client?: ProviderRuntimeReader;
  validateLocalToken?: (authorization: string) => boolean;
}

const defaultClient = new ProviderRuntimeClient(parseProviderRuntimeConfig());

function statusForRuntimeError(error: ProviderRuntimeError): number {
  if (error.code === 'PROVIDER_RUNTIME_INVALID_RESPONSE') {
    return 502;
  }
  return 503;
}

function sendRuntimeError(
  response: Response,
  error: unknown,
): void {
  const runtimeError = error instanceof ProviderRuntimeError
    ? error
    : new ProviderRuntimeError(
      'PROVIDER_RUNTIME_UNAVAILABLE',
      'CLIProxyAPI is unavailable on the configured loopback endpoint.',
    );
  response.status(statusForRuntimeError(runtimeError)).json({
    error: {
      code: runtimeError.code,
      message: runtimeError.message,
    },
  });
}

function createLocalAuthHandler(
  validateLocalToken: (authorization: string) => boolean,
): RequestHandler {
  return (request, response, next) => {
    if (!validateLocalToken(request.headers.authorization || '')) {
      response.status(401).json({
        error: {
          code: 'INVALID_LOCAL_TOKEN',
          message: 'Local Runner authentication failed.',
        },
      });
      return;
    }
    next();
  };
}

function createHealthHandler(client: ProviderRuntimeReader): RequestHandler {
  return async (_request, response) => {
    if (!client.enabled) {
      response.json({
        runtime: 'cliproxyapi',
        status: 'disabled',
        reachable: false,
      });
      return;
    }

    try {
      await client.getHealth();
      response.json({
        runtime: 'cliproxyapi',
        status: 'ready',
        reachable: true,
      });
    } catch (error: unknown) {
      sendRuntimeError(response, error);
    }
  };
}

function createModelsHandler(client: ProviderRuntimeReader): RequestHandler {
  return async (_request, response) => {
    try {
      const models = await client.listModels();
      response.json({ runtime: 'cliproxyapi', models });
    } catch (error: unknown) {
      sendRuntimeError(response, error);
    }
  };
}

/** Exposes only secret-free runtime health and model projections to the local frontend. */
export function createProviderRuntimeRouter(
  options: ProviderRuntimeRouterOptions = {},
): Router {
  const router = Router();
  const client = options.client ?? defaultClient;
  const validateLocalToken = options.validateLocalToken
    ?? ((authorization: string) => localToken.validate(authorization));

  router.use(createLocalAuthHandler(validateLocalToken));
  router.get('/health', createHealthHandler(client));
  router.get('/models', createModelsHandler(client));

  return router;
}

export default createProviderRuntimeRouter();
