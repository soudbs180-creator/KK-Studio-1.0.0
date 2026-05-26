import type { ApiProtocolFormat } from '../api/apiConfig.ts';
import { resolveProviderRuntime } from '../api/providerStrategy.ts';
import {
    DEFAULT_GOOGLE_MODELS,
    DEFAULT_OPENAI_MODELS,
} from './keyManagerDefaultModels.ts';
import { normalizeModelList } from './keyManagerModelList.ts';
import { getDocumentedStaticModelsForProvider } from './keyManagerProviderPresets.ts';

export function getDefaultOfficialModelsForRuntime(runtime: ReturnType<typeof resolveProviderRuntime>): string[] {
    if (runtime.strategyId === 'google' && runtime.providerFamily === 'google-official') {
        return DEFAULT_GOOGLE_MODELS;
    }

    if (runtime.strategyId === 'openai' && (!runtime.baseUrl || runtime.host === 'api.openai.com')) {
        return DEFAULT_OPENAI_MODELS;
    }

    return [];
}

export function resolveEffectiveProviderModels(input: {
    provider?: string;
    baseUrl?: string;
    format?: ApiProtocolFormat;
    models?: string[];
}): string[] {
    const runtime = resolveProviderRuntime({
        provider: input.provider,
        baseUrl: input.baseUrl,
        format: input.format,
    });
    const normalizedModels = normalizeModelList(
        Array.isArray(input.models) ? input.models : [],
        runtime.uiProvider || input.provider,
        input.baseUrl,
    );

    if (normalizedModels.length > 0) {
        return normalizedModels;
    }

    const builtInOfficialModels = getDefaultOfficialModelsForRuntime(runtime);
    if (builtInOfficialModels.length > 0) {
        return normalizeModelList(builtInOfficialModels, runtime.uiProvider || input.provider, input.baseUrl);
    }

    const documentedModels = getDocumentedStaticModelsForProvider(runtime.strategyId);
    if (documentedModels.length === 0) {
        return normalizedModels;
    }

    return normalizeModelList(documentedModels, runtime.uiProvider || input.provider, input.baseUrl);
}
