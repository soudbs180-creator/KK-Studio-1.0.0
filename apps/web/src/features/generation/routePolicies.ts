import type { RouteContext, RouteDecision } from './generationIntent.ts';

export function decideRoute(context: RouteContext): RouteDecision {
  const {
    deviceType,
    localRunnerAvailable,
    userPreferredMode,
    hasLocalUserKey,
    hasCloudUserKey,
    networkStatus
  } = context;

  // 1. Platform Mode override
  if (userPreferredMode === 'platform') {
    return {
      mode: 'cloud-platform-key',
      reason: 'User explicitly selected platform credits mode.'
    };
  }

  // 2. Cloud Mode override
  if (userPreferredMode === 'cloud') {
    if (hasCloudUserKey) {
      return {
        mode: 'cloud-user-key',
        reason: 'User explicitly selected cloud relay with cloud-encrypted user key.'
      };
    }
    return {
      mode: 'cloud-platform-key',
      reason: 'User preferred cloud relay but no cloud key exists. Using platform credits.'
    };
  }

  // 3. Local Mode override
  if (userPreferredMode === 'local') {
    if (localRunnerAvailable && hasLocalUserKey) {
      return {
        mode: 'local-runner',
        reason: 'User explicitly selected local mode, local runner and key are ready.',
        fallback: hasCloudUserKey
          ? { mode: 'cloud-user-key', reason: 'Local run failed; falling back to cloud user key.' }
          : { mode: 'cloud-platform-key', reason: 'Local run failed; falling back to platform credits.' }
      };
    }
    if (hasCloudUserKey) {
      return {
        mode: 'cloud-user-key',
        reason: 'User preferred local, but local key is missing. Using cloud user key.'
      };
    }
    return {
      mode: 'cloud-platform-key',
      reason: 'User preferred local, but no keys are configured. Using platform credits.'
    };
  }

  // 4. Auto Mode
  if (deviceType === 'mobile') {
    if (hasCloudUserKey) {
      return {
        mode: 'cloud-user-key',
        reason: 'Mobile auto mode: prioritizes cloud relay user key.'
      };
    }
    return {
      mode: 'cloud-platform-key',
      reason: 'Mobile auto mode: using platform credits.'
    };
  }

  // Desktop Auto Mode
  if (localRunnerAvailable && hasLocalUserKey && networkStatus !== 'blocked') {
    return {
      mode: 'local-runner',
      reason: 'Desktop auto mode: local runner available and network normal.',
      fallback: hasCloudUserKey
        ? { mode: 'cloud-user-key', reason: 'Local run failed; falling back to cloud user key.' }
        : { mode: 'cloud-platform-key', reason: 'Local run failed; falling back to platform credits.' }
    };
  }

  if (hasCloudUserKey) {
    return {
      mode: 'cloud-user-key',
      reason: 'Desktop local runner or network blocked. Routing to cloud user key.'
    };
  }

  return {
    mode: 'cloud-platform-key',
    reason: 'Desktop local runner unavailable. Routing to platform credits.'
  };
}
