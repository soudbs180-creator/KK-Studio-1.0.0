import { isMobileDevice } from '../../services/storage/storagePreference.ts';
import { getKkApiServerHealth } from '../../services/api/kkApiServerHealth.ts';
import { keyManager } from '../../services/auth/keyManager.ts';
import { getNetworkStatus, isUserVpnEnabled, probeNetwork } from '../../local/localNetworkProbe.ts';
import { decideRoute } from './routePolicies.ts';
import type { RouteContext, RouteMode } from './RouteContext';
import type { RouteDecision } from './RouteDecision';
import { isSystemModelRoute } from '../../services/model/modelRoute.ts';

export class ProviderRouteEngine {
  private static instance: ProviderRouteEngine;

  private constructor() {
    // Proactively trigger a network status check
    void probeNetwork().catch(() => {});
  }

  public static getInstance(): ProviderRouteEngine {
    if (!ProviderRouteEngine.instance) {
      ProviderRouteEngine.instance = new ProviderRouteEngine();
    }
    return ProviderRouteEngine.instance;
  }

  /**
   * Determine the route decision for a given task and model
   */
  public async decideRoute(options: {
    modelId: string;
    taskType: 'image' | 'text' | 'video' | 'batch' | 'audio';
    preferredKeyId?: string;
  }): Promise<RouteDecision> {
    // 1. Gather device type
    const isMobile = isMobileDevice();
    const deviceType = isMobile ? 'mobile' : 'desktop';

    // 2. Local runner availability
    const health = await getKkApiServerHealth();
    const localRunnerAvailable = health.reachable;

    // 3. User preferred routing mode
    const storedPreferredMode = localStorage.getItem('kk_studio_preferred_generation_mode');
    const userPreferredMode = (storedPreferredMode === 'local' || storedPreferredMode === 'cloud' || storedPreferredMode === 'platform')
      ? storedPreferredMode
      : 'local';

    // 4. Check locally resolved keys
    let hasLocalUserKey = false;
    let hasCloudUserKey = false;
    
    // Resolve key from manager
    const slot = keyManager.getNextKey(options.modelId, options.preferredKeyId);
    if (slot && slot.provider !== 'SystemProxy') {
      const keyStr = String(slot.key || '').trim();
      const isRedacted = keyStr === 'sk-readonly-0000' || keyStr.startsWith('__kk_redacted__:') || slot.type === 'proxy';
      if (isRedacted) {
        hasCloudUserKey = true;
      } else {
        hasLocalUserKey = true;
      }
    }

    // 5. Check platform credit status
    // If SystemProxy slot resolved or has usable credits, hasPlatformCredit is true
    const hasPlatformCredit = isSystemModelRoute(options.modelId) || Boolean(keyManager.getNextKey(options.modelId, 'system_proxy_slot'));

    // 6. Network status & VPN
    let networkStatus = getNetworkStatus();
    if (networkStatus === 'unknown') {
      networkStatus = await probeNetwork();
    }
    const userVpnEnabled = isUserVpnEnabled();

    // 7. Assemble routing context
    const isWebProvider = options.preferredKeyId && (options.preferredKeyId.startsWith('web-') || options.preferredKeyId.includes('web-provider') || options.preferredKeyId.startsWith('user-owned-'));
    const context: RouteContext = {
      deviceType,
      localRunnerAvailable,
      browserDirectAvailable: false, // Disabled for security direct from UI
      userVpnEnabled,
      userPreferredMode,
      provider: isWebProvider ? options.preferredKeyId! : (slot?.provider || 'Google'),
      hasLocalUserKey,
      hasCloudUserKey,
      hasPlatformCredit,
      networkStatus,
      taskType: options.taskType,
    };

    const decision = decideRoute(context);
    console.log(`[ProviderRouteEngine] Route decision for model ${options.modelId}: ${decision.mode} (${decision.reason})`);
    
    return decision;
  }
}

export const providerRouteEngine = ProviderRouteEngine.getInstance();
