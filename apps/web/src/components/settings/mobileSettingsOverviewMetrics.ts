import type { CreditTransactionLog } from '../../context/BillingContext';
import type { BrowserBridgeStatusSnapshot } from '../../features/ai-assistant-runtime/browser/browserBridge';
import type { KeySlot, ThirdPartyProvider } from '../../services/auth/keyManager';

const CONNECTED_SESSION_STATES = new Set(['logged_in', 'connected', 'ready', 'authenticated', 'active']);

const isSameLocalDay = (value: string | number, now: Date | number) => {
  const target = new Date(value);
  const today = new Date(now);
  return !Number.isNaN(target.getTime())
    && target.getFullYear() === today.getFullYear()
    && target.getMonth() === today.getMonth()
    && target.getDate() === today.getDate();
};

const toFinitePositive = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export interface MobileSettingsOverviewMetrics {
  availableRoutes: number;
  failedRoutes: number;
  successfulApiCalls: number;
  failedApiCalls: number;
  totalTokens: number;
  todayCreditSpend: number;
  authenticatedBrowserAccounts: number;
  latencyMs: number | null;
  latencySourceName: string | null;
  latencySource: 'recent' | 'fastest' | null;
}

export const deriveMobileSettingsOverviewMetrics = (input: {
  slots: KeySlot[];
  providers: ThirdPartyProvider[];
  usageLogs: CreditTransactionLog[];
  todayTokens: number;
  browserStatus: BrowserBridgeStatusSnapshot;
  now?: Date | number;
}): MobileSettingsOverviewMetrics => {
  const providerBackedSlotIds = new Set(
    input.providers.flatMap((provider) => [provider.id, ...(provider.legacyIds || [])]),
  );
  const standaloneSlots = input.slots.filter((slot) => !providerBackedSlotIds.has(slot.id));
  const availableSlots = standaloneSlots.filter((slot) => !slot.disabled && slot.status === 'valid');
  const activeProviders = input.providers.filter((provider) => provider.isActive && provider.status !== 'error');
  const failedRoutes = standaloneSlots.filter((slot) => slot.status === 'invalid').length
    + input.providers.filter((provider) => provider.isActive && provider.status === 'error').length;

  const successfulApiCalls = input.slots.reduce(
    (sum, slot) => sum + Math.max(0, Number(slot.successCount) || 0),
    0,
  );
  const failedApiCalls = input.slots.reduce(
    (sum, slot) => sum + Math.max(0, Number(slot.failCount) || 0),
    0,
  );
  const totalTokens = standaloneSlots.reduce(
    (sum, slot) => sum + Math.max(0, Number(slot.usedTokens) || 0),
    0,
  ) + input.providers.reduce(
    (sum, provider) => sum + Math.max(0, Number(provider.usage?.totalTokens) || 0),
    0,
  );
  const now = input.now ?? Date.now();
  const todayCreditSpend = input.usageLogs
    .filter((log) => (
      isSameLocalDay(log.created_at, now)
      && (log.type === 'consumption' || log.type === 'debit')
      && log.status !== 'failed'
      && log.status !== 'refunded'
    ))
    .reduce((sum, log) => sum + Math.abs(Number(log.amount) || 0), 0);

  const bridgeConnected = input.browserStatus.daemonStatus === 'connected'
    && input.browserStatus.extensionStatus === 'connected';
  const authenticatedBrowserAccounts = bridgeConnected
    ? input.browserStatus.sessions.filter((session) => (
      session.enabled !== false
      && CONNECTED_SESSION_STATES.has(String(session.status || '').toLowerCase())
    )).length
    : 0;

  const latencyCandidates = [
    ...input.slots.map((slot) => ({
      name: slot.name || slot.provider,
      latency: toFinitePositive(slot.lastResponseTime) || toFinitePositive(slot.avgResponseTime),
      updatedAt: toFinitePositive(slot.lastUsed),
    })),
    ...input.providers.map((provider) => ({
      name: provider.name,
      latency: toFinitePositive(provider.activitySummary?.lastLatencyMs),
      updatedAt: toFinitePositive(provider.activitySummary?.updatedAt),
    })),
  ].filter((item) => item.latency > 0);
  const recentLatency = latencyCandidates
    .filter((item) => item.updatedAt > 0)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
  const fastestLatency = [...latencyCandidates].sort((left, right) => left.latency - right.latency)[0];
  const selectedLatency = recentLatency || fastestLatency;

  return {
    availableRoutes: availableSlots.length + activeProviders.length,
    failedRoutes,
    successfulApiCalls,
    failedApiCalls,
    totalTokens: Math.max(totalTokens, Math.max(0, input.todayTokens || 0)),
    todayCreditSpend,
    authenticatedBrowserAccounts,
    latencyMs: selectedLatency ? Math.round(selectedLatency.latency) : null,
    latencySourceName: selectedLatency?.name || null,
    latencySource: recentLatency ? 'recent' : fastestLatency ? 'fastest' : null,
  };
};
