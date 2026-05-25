import { normalizeApiProtocolFormat } from "../api/apiConfig.ts";
import type { Provider } from "../../types";

export interface ProviderLinkKeySlot {
    id: string;
    key: string;
    name: string;
    provider: Provider;
    baseUrl?: string;
}

export interface ProviderLinkProvider {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    models: string[];
    format: string;
    isActive: boolean;
    group?: string;
    usage: {
        totalTokens: number;
        totalCost: number;
        dailyTokens: number;
        dailyCost: number;
        lastReset: number;
    };
    status: "active" | "error" | "checking";
    createdAt: number;
    updatedAt: number;
    budgetLimit?: number;
    tokenLimit?: number;
    customCostValue?: number;
    lastChecked?: number;
    activitySummary?: {
        lastLatencyMs?: number | null;
        lastTokens?: number | null;
        lastAmount?: number | null;
        updatedAt?: number | null;
    };
}

export function normalizeProviderLinkValue(value: string | undefined | null): string {
    return String(value || "").trim().replace(/\/+$/, "").toLowerCase();
}

export interface ProviderLinkedSlotMatchOptions {
    allowSingleBaseUrlFallback?: boolean;
}

type ProviderLinkCandidateProvider = Partial<Pick<ProviderLinkProvider, "baseUrl" | "name" | "apiKey">>;

function buildProviderLinkCandidates(
    providers: Array<ProviderLinkCandidateProvider | null | undefined>,
): Array<{ baseUrl: string; apiKey: string; name: string }> {
    return providers
        .filter((item): item is ProviderLinkCandidateProvider => !!item && !!item.baseUrl)
        .map((item) => ({
            baseUrl: normalizeProviderLinkValue(item.baseUrl),
            apiKey: String(item.apiKey || "").trim(),
            name: normalizeProviderLinkValue(item.name),
        }))
        .filter((item) => !!item.baseUrl);
}

export function findProviderLinkedSlots<TSlot extends Pick<ProviderLinkKeySlot, "baseUrl" | "name" | "key">>(
    slots: TSlot[],
    providers: Array<ProviderLinkCandidateProvider | null | undefined>,
    options: ProviderLinkedSlotMatchOptions = {},
): TSlot[] {
    const candidateProviders = buildProviderLinkCandidates(providers);
    if (candidateProviders.length === 0) return [];

    const matchedSlots = slots.filter((slot) => {
        const slotBaseUrl = normalizeProviderLinkValue(slot.baseUrl);
        if (!slotBaseUrl) return false;

        return candidateProviders.some((candidate) => {
            if (slotBaseUrl !== candidate.baseUrl) return false;

            const slotKey = String(slot.key || "").trim();
            const slotName = normalizeProviderLinkValue(slot.name);

            if (candidate.apiKey && slotKey && slotKey === candidate.apiKey) return true;
            if (candidate.name && slotName && slotName === candidate.name) return true;
            return false;
        });
    });

    if (matchedSlots.length > 0 || !options.allowSingleBaseUrlFallback) {
        return matchedSlots;
    }

    const currentBaseUrl = normalizeProviderLinkValue(providers[0]?.baseUrl);
    if (!currentBaseUrl) return [];

    const sameBaseUrlSlots = slots.filter((slot) => normalizeProviderLinkValue(slot.baseUrl) === currentBaseUrl);
    return sameBaseUrlSlots.length === 1 ? [sameBaseUrlSlots[0]] : [];
}

export function normalizeStoredProviders<TProvider extends ProviderLinkProvider>(
    rawProviders: unknown,
    normalizeModels: (models: string[], providerName: string) => string[],
): TProvider[] {
    if (!Array.isArray(rawProviders)) return [];

    return rawProviders.map((provider, index) => {
        const now = Date.now();
        const raw = ((provider && typeof provider === "object") ? provider : {}) as Partial<TProvider>;
        const usage = raw.usage || {
            totalTokens: 0,
            totalCost: 0,
            dailyTokens: 0,
            dailyCost: 0,
            lastReset: now,
        };

        return {
            ...raw,
            id: String(raw.id || `provider_${now}_${index}`),
            name: String(raw.name || "Custom Provider"),
            baseUrl: String(raw.baseUrl || "").trim(),
            apiKey: String(raw.apiKey || "").trim(),
            models: normalizeModels(Array.isArray(raw.models) ? raw.models : [], String(raw.name || "Custom")),
            format: normalizeApiProtocolFormat(raw.format, "auto"),
            isActive: raw.isActive !== false,
            usage: {
                totalTokens: Number(usage.totalTokens || 0),
                totalCost: Number(usage.totalCost || 0),
                dailyTokens: Number(usage.dailyTokens || 0),
                dailyCost: Number(usage.dailyCost || 0),
                lastReset: Number(usage.lastReset || now),
            },
            status: raw.status === "active" || raw.status === "error" || raw.status === "checking"
                ? raw.status
                : "checking",
            createdAt: Number(raw.createdAt || now),
            updatedAt: Number(raw.updatedAt || now),
            budgetLimit: raw.budgetLimit !== undefined ? Number(raw.budgetLimit) : raw.budgetLimit,
            tokenLimit: raw.tokenLimit !== undefined ? Number(raw.tokenLimit) : raw.tokenLimit,
            customCostValue: raw.customCostValue !== undefined ? Number(raw.customCostValue) : raw.customCostValue,
            lastChecked: raw.lastChecked !== undefined ? Number(raw.lastChecked) : raw.lastChecked,
            activitySummary: raw.activitySummary ? {
                lastLatencyMs: raw.activitySummary.lastLatencyMs !== undefined ? Number(raw.activitySummary.lastLatencyMs) : raw.activitySummary.lastLatencyMs,
                lastTokens: raw.activitySummary.lastTokens !== undefined ? Number(raw.activitySummary.lastTokens) : raw.activitySummary.lastTokens,
                lastAmount: raw.activitySummary.lastAmount !== undefined ? Number(raw.activitySummary.lastAmount) : raw.activitySummary.lastAmount,
                updatedAt: raw.activitySummary.updatedAt !== undefined ? Number(raw.activitySummary.updatedAt) : raw.activitySummary.updatedAt,
            } : undefined,
        } as TProvider;
    });
}

export function findLinkedProviderForSlot<TSlot extends Pick<ProviderLinkKeySlot, "baseUrl" | "name" | "key">, TProvider extends Pick<ProviderLinkProvider, "baseUrl" | "name" | "apiKey" | "isActive">>(
    slot: TSlot,
    providers: TProvider[],
): TProvider | null {
    const slotBaseUrl = normalizeProviderLinkValue(slot.baseUrl);
    if (!slotBaseUrl) return null;

    const sameBaseProviders = providers.filter((provider) => {
        if (!provider.isActive) return false;
        return normalizeProviderLinkValue(provider.baseUrl) === slotBaseUrl;
    });

    if (sameBaseProviders.length === 0) return null;
    if (sameBaseProviders.length === 1) return sameBaseProviders[0];

    const slotName = normalizeProviderLinkValue(slot.name);
    const slotKey = String(slot.key || "").trim();

    return sameBaseProviders.find((provider) => {
        const providerName = normalizeProviderLinkValue(provider.name);
        const providerKey = String(provider.apiKey || "").trim();
        return (slotName && slotName === providerName) || (slotKey && slotKey === providerKey);
    }) || null;
}
