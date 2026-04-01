import { normalizeApiProtocolFormat, type ApiProtocolFormat, type AuthMethod } from "../api/apiConfig";
import { determineKeyType, parseModelString } from "./keyManager";
import { ProviderLinkProvider } from "./keyManagerProviderLinks";
import type { Provider } from "../../types";

export interface EffectiveKeySlot {
    id: string;
    key: string;
    name: string;
    provider: Provider;
    type: "official" | "proxy" | "third-party";
    format: string;
    baseUrl?: string;
    group?: string;
    supportedModels: string[];
    authMethod?: AuthMethod;
    headerName?: string;
    compatibilityMode?: "standard" | "chat";
    disabled: boolean;
    budgetLimit: number;
    tokenLimit?: number;
    usedTokens?: number;
    totalCost: number;
}

export function resolveProviderBudgetLimit(provider: Pick<ProviderLinkProvider, "budgetLimit" | "customCostValue"> & { customCostMode?: "unlimited" | "amount" | "tokens" }): number {
    if (typeof provider.budgetLimit === "number" && Number.isFinite(provider.budgetLimit)) {
        return provider.budgetLimit;
    }

    if (provider.customCostMode === "amount" && typeof provider.customCostValue === "number" && Number.isFinite(provider.customCostValue)) {
        return provider.customCostValue;
    }

    return -1;
}

export function resolveProviderTokenLimit(provider: Pick<ProviderLinkProvider, "tokenLimit" | "customCostValue"> & { customCostMode?: "unlimited" | "amount" | "tokens" }): number {
    if (typeof provider.tokenLimit === "number" && Number.isFinite(provider.tokenLimit)) {
        return provider.tokenLimit;
    }

    if (provider.customCostMode === "tokens" && typeof provider.customCostValue === "number" && Number.isFinite(provider.customCostValue)) {
        return provider.customCostValue;
    }

    return -1;
}

export function buildEffectiveSlotFromProvider<TSlot extends EffectiveKeySlot>(
    slot: TSlot,
    provider: ProviderLinkProvider,
    normalizeModels: (models: string[], providerName: string) => string[],
    resolveRuntime: (input: {
        provider: Provider;
        baseUrl?: string;
        format: ApiProtocolFormat;
        authMethod?: AuthMethod;
        headerName?: string;
        compatibilityMode?: "standard" | "chat";
    }) => {
        authMethod: AuthMethod;
        headerName?: string;
        compatibilityMode?: "standard" | "chat";
    },
): TSlot {
    const format = normalizeApiProtocolFormat(provider.format as ApiProtocolFormat, (slot.format as ApiProtocolFormat) || "auto");
    const runtime = resolveRuntime({
        provider: slot.provider,
        baseUrl: provider.baseUrl,
        format,
        authMethod: slot.authMethod,
        headerName: slot.headerName,
        compatibilityMode: slot.compatibilityMode,
    });

    return {
        ...slot,
        key: String(provider.apiKey || "").trim(),
        name: provider.name || slot.name,
        baseUrl: provider.baseUrl || slot.baseUrl,
        group: provider.group,
        disabled: !provider.isActive,
        budgetLimit: resolveProviderBudgetLimit(provider as Pick<ProviderLinkProvider, "budgetLimit" | "customCostValue"> & { customCostMode?: "unlimited" | "amount" | "tokens" }),
        tokenLimit: resolveProviderTokenLimit(provider as Pick<ProviderLinkProvider, "tokenLimit" | "customCostValue"> & { customCostMode?: "unlimited" | "amount" | "tokens" }),
        usedTokens: provider.usage?.totalTokens || 0,
        totalCost: provider.usage?.totalCost || 0,
        format,
        supportedModels: provider.models?.length
            ? normalizeModels(provider.models.map((model) => parseModelString(model).id || model), slot.provider)
            : slot.supportedModels,
        type: determineKeyType(slot.provider, provider.baseUrl || slot.baseUrl),
        authMethod: runtime.authMethod as AuthMethod,
        headerName: runtime.headerName,
        compatibilityMode: runtime.compatibilityMode,
    };
}
