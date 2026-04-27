import { randomUUID } from 'node:crypto';

import type {
  AuthSessionDto,
  LogoutResponseDto,
} from '../../../../../../packages/contracts/src/index.ts';
import type { AuthService } from '../application/auth-service.ts';
import {
  buildErrorEnvelope,
  buildSuccessEnvelope,
  type HttpAuthRouteResult,
} from './http-auth-routes.ts';

export async function handleGetSession(
  service: AuthService,
  headers: Record<string, string>,
  cookies: Record<string, string>,
  ip: string,
  userAgent: string,
): Promise<HttpAuthRouteResult<AuthSessionDto>> {
  const requestId = headers['x-request-id'] || randomUUID();
  const clientVersion = headers['x-client-version'];
  const result = await service.getSession(headers, cookies, {
    ip,
    userAgent,
  });

  if (!result.body.success) {
    return buildErrorEnvelope(
      requestId,
      clientVersion,
      result.statusCode,
      result.body.error || 'Session restore failed.',
      undefined,
      result.headers,
    );
  }

  return buildSuccessEnvelope(
    requestId,
    clientVersion,
    result.statusCode,
    result.body.data as AuthSessionDto,
    result.headers,
  );
}

export async function handleRefreshSession(
  service: AuthService,
  headers: Record<string, string>,
  cookies: Record<string, string>,
  ip: string,
  userAgent: string,
): Promise<HttpAuthRouteResult<AuthSessionDto>> {
  const requestId = headers['x-request-id'] || randomUUID();
  const clientVersion = headers['x-client-version'];
  const result = await service.refreshSession(headers, cookies, {
    ip,
    userAgent,
  });

  if (!result.body.success) {
    return buildErrorEnvelope(
      requestId,
      clientVersion,
      result.statusCode,
      result.body.error || 'Session refresh failed.',
      undefined,
      result.headers,
    );
  }

  return buildSuccessEnvelope(
    requestId,
    clientVersion,
    result.statusCode,
    result.body.data as AuthSessionDto,
    result.headers,
  );
}

export async function handleLogoutSession(
  service: AuthService,
  headers: Record<string, string>,
  cookies: Record<string, string>,
): Promise<HttpAuthRouteResult<LogoutResponseDto>> {
  const requestId = headers['x-request-id'] || randomUUID();
  const clientVersion = headers['x-client-version'];
  const result = await service.logoutSession(headers, cookies);

  if (!result.body.success) {
    return buildErrorEnvelope(
      requestId,
      clientVersion,
      result.statusCode,
      result.body.error || 'Logout failed.',
      undefined,
      result.headers,
    );
  }

  return buildSuccessEnvelope(
    requestId,
    clientVersion,
    result.statusCode,
    result.body.data as LogoutResponseDto,
    result.headers,
  );
}
