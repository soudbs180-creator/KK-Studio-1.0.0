export type AdminModelVisibility = 'hidden' | 'visible';

export interface AdminModelRefreshPolicyInput {
  cooldownMs: number;
  force: boolean;
  hasInflightRequest: boolean;
  lastAttemptAt: number;
  now: number;
}

export function shouldStartAdminModelRefresh(
  input: AdminModelRefreshPolicyInput,
): boolean {
  if (input.hasInflightRequest) {
    return false;
  }

  if (input.force) {
    return true;
  }

  if (!input.lastAttemptAt) {
    return true;
  }

  return input.now - input.lastAttemptAt >= input.cooldownMs;
}

export function getAdminModelAutoRefreshDelay(
  visibility: AdminModelVisibility,
): number {
  return visibility === 'visible' ? 10_000 : 60_000;
}
