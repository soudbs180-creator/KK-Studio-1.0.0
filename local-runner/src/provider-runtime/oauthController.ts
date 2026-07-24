import {
  PROVIDER_OAUTH_PROVIDERS,
  type ProviderOAuthProvider,
  type ProviderOAuthSession,
} from './oauthContracts';

export type ProviderOAuthErrorCode =
  | 'PROVIDER_RUNTIME_DISABLED'
  | 'SECURE_OAUTH_COMPANION_REQUIRED';

export class ProviderOAuthError extends Error {
  constructor(
    public readonly code: ProviderOAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderOAuthError';
  }
}

export interface ProviderOAuthController {
  listStatuses: () => Promise<ProviderOAuthSession[]>;
  disconnect: (provider: ProviderOAuthProvider) => Promise<ProviderOAuthSession>;
}

/**
 * Fail-closed OAuth controller used until the secure companion supplies an
 * OS-keychain-backed implementation. It never reads or deletes credentials.
 */
export class PendingSecureOAuthController implements ProviderOAuthController {
  constructor(private readonly runtimeEnabled: boolean) {}

  public async listStatuses(): Promise<ProviderOAuthSession[]> {
    const status = this.runtimeEnabled ? 'not_installed' : 'disabled';
    return PROVIDER_OAUTH_PROVIDERS.map((provider) => ({ provider, status }));
  }

  public async disconnect(
    _provider: ProviderOAuthProvider,
  ): Promise<ProviderOAuthSession> {
    if (!this.runtimeEnabled) {
      throw new ProviderOAuthError(
        'PROVIDER_RUNTIME_DISABLED',
        'CLIProxyAPI integration is disabled.',
      );
    }
    throw new ProviderOAuthError(
      'SECURE_OAUTH_COMPANION_REQUIRED',
      'A secure local OAuth companion is required before credentials can be changed.',
    );
  }
}
