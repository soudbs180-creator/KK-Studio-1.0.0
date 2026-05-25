import { resolveProviderKeyType } from '../api/providerStrategy.ts';
import type { Provider } from '../../types';

/**
 * Determine key type based on provider and base URL.
 * Strictly enforces "official" status only for official provider endpoints.
 */
export function determineKeyType(provider: string | Provider, baseUrl?: string): 'official' | 'proxy' | 'third-party' {
    return resolveProviderKeyType(provider, baseUrl);
}
