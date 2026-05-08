export interface ProviderUsageTotals {
    totalTokens: number;
    totalCost: number;
    dailyTokens: number;
    dailyCost: number;
    lastReset: number;
}

export interface ProviderUsageCarrier {
    usage?: ProviderUsageTotals;
    updatedAt?: number;
}

export function isUsageLimitExceeded(target: {
    budgetLimit?: number;
    totalCost?: number;
    tokenLimit?: number;
    usedTokens?: number;
}): boolean {
    const budgetLimit = target.budgetLimit ?? -1;
    const totalCost = target.totalCost ?? 0;
    const tokenLimit = target.tokenLimit ?? -1;
    const usedTokens = target.usedTokens ?? 0;

    if (budgetLimit > 0 && totalCost >= budgetLimit) {
        return true;
    }

    if (tokenLimit > 0 && usedTokens >= tokenLimit) {
        return true;
    }

    return false;
}

export function applyProviderUsageDeltaToProvider<TProvider extends ProviderUsageCarrier>(
    provider: TProvider,
    tokenDelta: number,
    costDelta: number,
    now = Date.now(),
): TProvider {
    if (!provider.usage) {
        provider.usage = {
            totalTokens: 0,
            totalCost: 0,
            dailyTokens: 0,
            dailyCost: 0,
            lastReset: now,
        };
    }

    const lastResetDate = new Date(provider.usage.lastReset || 0);
    const today = new Date(now);
    if (lastResetDate.toDateString() !== today.toDateString()) {
        provider.usage.dailyTokens = 0;
        provider.usage.dailyCost = 0;
        provider.usage.lastReset = now;
    }

    provider.usage.totalTokens = Math.max(0, (provider.usage.totalTokens || 0) + tokenDelta);
    provider.usage.totalCost = Math.max(0, (provider.usage.totalCost || 0) + costDelta);
    provider.usage.dailyTokens = Math.max(0, (provider.usage.dailyTokens || 0) + tokenDelta);
    provider.usage.dailyCost = Math.max(0, (provider.usage.dailyCost || 0) + costDelta);
    provider.updatedAt = now;

    return provider;
}
