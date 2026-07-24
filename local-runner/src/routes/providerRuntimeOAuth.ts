import { Router, type RequestHandler, type Response } from 'express';
import { ZodError } from 'zod';
import {
  ProviderOAuthError,
  type ProviderOAuthController,
} from '../provider-runtime/oauthController';
import {
  ProviderOAuthDisconnectSchema,
  ProviderOAuthSessionListSchema,
  ProviderOAuthSessionSchema,
} from '../provider-runtime/oauthContracts';

const OAUTH_ERROR_MESSAGES = {
  PROVIDER_RUNTIME_DISABLED: 'CLIProxyAPI integration is disabled.',
  SECURE_OAUTH_COMPANION_REQUIRED:
    'A secure local OAuth companion is required before credentials can be changed.',
} as const;

function sendOAuthError(response: Response, error: unknown): void {
  if (error instanceof ProviderOAuthError) {
    response.status(error.code === 'SECURE_OAUTH_COMPANION_REQUIRED' ? 409 : 503).json({
      error: { code: error.code, message: OAUTH_ERROR_MESSAGES[error.code] },
    });
    return;
  }
  if (error instanceof ZodError) {
    response.status(502).json({
      error: {
        code: 'PROVIDER_OAUTH_INVALID_RESPONSE',
        message: 'The secure local OAuth companion returned an invalid status.',
      },
    });
    return;
  }
  response.status(500).json({
    error: {
      code: 'PROVIDER_OAUTH_OPERATION_FAILED',
      message: 'The local OAuth operation could not be completed.',
    },
  });
}

function createStatusHandler(controller: ProviderOAuthController): RequestHandler {
  return async (_request, response) => {
    try {
      const sessions = ProviderOAuthSessionListSchema.parse(await controller.listStatuses());
      response.json({ runtime: 'cliproxyapi', sessions });
    } catch (error: unknown) {
      sendOAuthError(response, error);
    }
  };
}

function createDisconnectHandler(controller: ProviderOAuthController): RequestHandler {
  return async (request, response) => {
    if (request.headers['x-user-approved-gesture'] !== 'true') {
      response.status(403).json({
        error: {
          code: 'USER_CONFIRMATION_REQUIRED',
          message: 'Disconnecting a local OAuth session requires explicit confirmation.',
        },
      });
      return;
    }

    const command = ProviderOAuthDisconnectSchema.safeParse(request.body);
    if (!command.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_OAUTH_COMMAND',
          message: 'The local OAuth command is invalid.',
        },
      });
      return;
    }

    try {
      const session = ProviderOAuthSessionSchema.parse(
        await controller.disconnect(command.data.provider),
      );
      response.json({ runtime: 'cliproxyapi', session });
    } catch (error: unknown) {
      sendOAuthError(response, error);
    }
  };
}

/** Builds the secret-free OAuth status and confirmed disconnect route surface. */
export function createProviderRuntimeOAuthRouter(
  controller: ProviderOAuthController,
): Router {
  const router = Router();
  router.get('/status', createStatusHandler(controller));
  router.post('/disconnect', createDisconnectHandler(controller));
  return router;
}
