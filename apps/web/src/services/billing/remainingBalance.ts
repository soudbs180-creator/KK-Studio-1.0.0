export function normalizeRemainingCredits(balance: unknown): number {
  if (typeof balance === 'number' && Number.isFinite(balance)) {
    return Math.max(0, balance);
  }

  if (typeof balance === 'string' && balance.trim() !== '') {
    const parsed = Number(balance);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
}

export function getRemainingCreditsFractionDigits(balance: unknown): number {
  return Number.isInteger(normalizeRemainingCredits(balance)) ? 0 : 2;
}

export function formatRemainingCredits(balance: unknown, locale = 'zh-CN'): string {
  const normalizedBalance = normalizeRemainingCredits(balance);
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: getRemainingCreditsFractionDigits(normalizedBalance),
  }).format(normalizedBalance);
}

export interface RechargeActivityLike {
  created_at?: string | null;
}

export interface RemainingBalanceSummary<TLog extends RechargeActivityLike> {
  latestRecharge: TLog | null;
  todayRechargeCount: number;
}

function getTimestamp(value?: string | null): number {
  if (!value) {
    return Number.NaN;
  }

  return Date.parse(value);
}

function isSameLocalDay(value?: string | null, referenceDate: Date = new Date()): boolean {
  const timestamp = getTimestamp(value);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const target = new Date(timestamp);
  return (
    target.getFullYear() === referenceDate.getFullYear() &&
    target.getMonth() === referenceDate.getMonth() &&
    target.getDate() === referenceDate.getDate()
  );
}

export function selectRemainingBalanceSummary<TLog extends RechargeActivityLike>(
  billingLogs: TLog[],
  referenceDate: Date = new Date(),
): RemainingBalanceSummary<TLog> {
  let latestRecharge: TLog | null = null;
  let latestRechargeTimestamp = Number.NEGATIVE_INFINITY;
  let todayRechargeCount = 0;

  for (const log of billingLogs) {
    if (isSameLocalDay(log.created_at, referenceDate)) {
      todayRechargeCount += 1;
    }

    const timestamp = getTimestamp(log.created_at);
    if (!Number.isNaN(timestamp) && timestamp > latestRechargeTimestamp) {
      latestRecharge = log;
      latestRechargeTimestamp = timestamp;
    }
  }

  return {
    latestRecharge,
    todayRechargeCount,
  };
}
