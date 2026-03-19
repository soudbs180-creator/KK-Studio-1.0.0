import {
    NewApiManagementService as BillingNewApiManagementService,
    type Channel,
    type PricingConfig,
    type TokenUsage,
} from '../billing/newApiManagementService';

const DEFAULT_BASE_URL = 'https://ai.newapi.pro';

export interface NewAPIChannel {
    id: number;
    type: number;
    name: string;
    models: string;
    key: string;
    base_url?: string;
    status: number;
    priority: number;
    weight: number;
}

export interface NewAPIModel {
    id: string;
    displayName: string;
    billingType: 'token' | 'per_request' | 'multiplier';
    inputPrice?: number;
    outputPrice?: number;
    perRequestPrice?: number;
    multiplier?: number;
    group?: string;
}

export interface NewAPIToken {
    id: number;
    name: string;
    key: string;
    created_time: number;
    expired_time?: number;
    remain_quota: number;
    unlimited_quota: boolean;
}

function formatModelName(id: string): string {
    return String(id || '')
        .split('/')
        .pop()!
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function createService(baseUrl: string, accessToken: string): BillingNewApiManagementService {
    return new BillingNewApiManagementService({
        baseUrl: (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, ''),
        accessToken,
    });
}

function extractModelIds(channel: Channel): string[] {
    const models = (channel as any)?.models;
    if (Array.isArray(models)) {
        return models.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(models || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function normalizePricingBaseUrl(baseUrl?: string): string {
    return String(baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
}

function buildPricingCandidateUrls(baseUrl?: string): string[] {
    const cleanBaseUrl = normalizePricingBaseUrl(baseUrl);
    const rootBaseUrl = cleanBaseUrl.replace(/\/v1$/i, '');
    return Array.from(new Set([
        `${cleanBaseUrl}/api/pricing`,
        `${cleanBaseUrl}/pricing`,
        `${cleanBaseUrl}/api/price`,
        `${cleanBaseUrl}/price`,
        cleanBaseUrl !== rootBaseUrl ? `${rootBaseUrl}/api/pricing` : '',
        cleanBaseUrl !== rootBaseUrl ? `${rootBaseUrl}/pricing` : '',
        cleanBaseUrl !== rootBaseUrl ? `${rootBaseUrl}/api/price` : '',
        cleanBaseUrl !== rootBaseUrl ? `${rootBaseUrl}/price` : '',
    ].filter(Boolean)));
}

function parsePricingNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function extractPricingPayloadRows(payload: any): any[] {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.prices)) return payload.prices;
    if (Array.isArray(payload?.models)) return payload.models;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
}

function extractPricingGroupRatioMap(payload: any): Record<string, number> {
    const raw = payload?.group_ratio ?? payload?.groupRatio ?? payload?.data?.group_ratio ?? payload?.data?.groupRatio;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return raw as Record<string, number>;
    }
    return {};
}

function normalizePricingRow(item: any, groupRatioMap: Record<string, number>): PricingConfig | null {
    const modelId = String(item?.modelId ?? item?.model ?? item?.id ?? '').trim();
    if (!modelId) return null;

    const groupKey = String(item?.group ?? item?.groupId ?? item?.group_id ?? item?.token_group ?? '').trim();
    const inferredType = String(
        item?.type ??
        item?.billingType ??
        item?.billing_type ??
        item?.quotaType ??
        item?.quota_type ??
        ''
    ).trim().toLowerCase();
    const type: PricingConfig['type'] = (
        inferredType.includes('times')
        || inferredType.includes('request')
        || inferredType.includes('per_request')
    )
        ? 'times'
        : 'tokens';

    const perRequestPrice = parsePricingNumber(
        item?.perRequestPrice ?? item?.per_request_price ?? item?.price_per_image ?? item?.price ?? item?.modelPrice ?? item?.model_price
    );
    const inputPrice = parsePricingNumber(
        item?.inputPrice ?? item?.input_price ?? item?.price ?? item?.modelPrice ?? item?.model_price ?? perRequestPrice
    ) ?? 0;
    const outputPrice = parsePricingNumber(
        item?.outputPrice ?? item?.output_price ?? item?.completionPrice ?? item?.completion_price
    ) ?? (type === 'times' ? 0 : inputPrice);
    const groupRatio = parsePricingNumber(
        item?.groupRatio ?? item?.group_ratio ?? item?.groupMultiplier ?? item?.group_multiplier
    ) ?? (groupKey ? parsePricingNumber(groupRatioMap[groupKey]) : undefined) ?? parsePricingNumber(groupRatioMap.default) ?? 1;

    return {
        modelId,
        modelName: String(item?.modelName ?? item?.model_name ?? modelId).trim() || modelId,
        inputPrice: type === 'times' ? (perRequestPrice ?? inputPrice) : inputPrice,
        outputPrice,
        groupRatio,
        currency: String(item?.currency ?? 'USD').trim() || 'USD',
        type,
    };
}

async function fetchPricingWithAccessToken(accessToken: string, baseUrl?: string): Promise<PricingConfig[]> {
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };

    for (const endpointUrl of buildPricingCandidateUrls(baseUrl)) {
        try {
            const response = await fetch(endpointUrl, {
                method: 'GET',
                headers,
            });

            if (!response.ok) continue;

            const text = await response.text();
            const trimmed = text.trimStart();
            if (!trimmed || trimmed.startsWith('<!') || trimmed.startsWith('<html')) continue;

            const payload = JSON.parse(text);
            const groupRatioMap = extractPricingGroupRatioMap(payload);
            const pricingRows = extractPricingPayloadRows(payload)
                .map((item) => normalizePricingRow(item, groupRatioMap))
                .filter((item): item is PricingConfig => Boolean(item));

            if (pricingRows.length > 0) {
                return pricingRows;
            }
        } catch {
            continue;
        }
    }

    return [];
}

class NewApiManagementFacade {
    async verifyAccessToken(accessToken: string, baseUrl?: string): Promise<{
        success: boolean;
        data?: {
            quota: number;
            usage: number;
            remain_quota: number;
        };
        error?: string;
    }> {
        const cleanBaseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');

        try {
            const dashboardResponse = await fetch(`${cleanBaseUrl}/api/user/dashboard`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!dashboardResponse.ok) {
                const errorText = await dashboardResponse.text().catch(() => '');
                return {
                    success: false,
                    error: errorText || `Token verification failed: ${dashboardResponse.status}`,
                };
            }

            const dashboardData = await dashboardResponse.json().catch(() => ({}));
            return {
                success: true,
                data: dashboardData?.data,
            };
        } catch (error: any) {
            const result = await createService(cleanBaseUrl, accessToken).testConnection().catch(() => null);
            if (result?.success) {
                return { success: true };
            }
            return {
                success: false,
                error: error?.message || result?.message || 'Token verification failed',
            };
        }
    }

    async listChannels(accessToken: string, baseUrl?: string): Promise<NewAPIChannel[]> {
        const channels = await createService(baseUrl || DEFAULT_BASE_URL, accessToken).getAllChannels();
        return channels.map((channel) => ({
            id: channel.id,
            type: channel.type,
            name: channel.name,
            models: extractModelIds(channel).join(','),
            key: channel.key,
            base_url: channel.baseUrl,
            status: channel.status,
            priority: channel.priority || 0,
            weight: channel.weight || 0,
        }));
    }

    async listTokens(accessToken: string, baseUrl?: string): Promise<NewAPIToken[]> {
        const tokens = await createService(baseUrl || DEFAULT_BASE_URL, accessToken).getAllTokens();
        return tokens.map((token: TokenUsage) => ({
            id: token.id,
            name: token.name,
            key: token.key,
            created_time: token.createdTime,
            expired_time: token.expiredTime,
            remain_quota: token.remainQuota,
            unlimited_quota: token.unlimitedQuota,
        }));
    }

    async getPricing(accessToken: string, baseUrl?: string): Promise<PricingConfig[]> {
        const pricing = await createService(baseUrl || DEFAULT_BASE_URL, accessToken)
            .getAllPricing()
            .catch(() => [] as PricingConfig[]);
        return pricing.length > 0 ? pricing : fetchPricingWithAccessToken(accessToken, baseUrl);
    }

    async fetchAdminModels(accessToken: string, baseUrl?: string): Promise<NewAPIModel[]> {
        const service = createService(baseUrl || DEFAULT_BASE_URL, accessToken);
        const [channels, pricing] = await Promise.all([
            service.getAllChannels(),
            this.getPricing(accessToken, baseUrl),
        ]);

        const pricingMap = new Map<string, PricingConfig>();
        pricing.forEach((item) => {
            pricingMap.set(item.modelId, item);
        });

        const modelMap = new Map<string, NewAPIModel>();
        channels.forEach((channel) => {
            extractModelIds(channel).forEach((modelId) => {
                if (modelMap.has(modelId)) return;

                const pricingItem = pricingMap.get(modelId);
                modelMap.set(modelId, {
                    id: modelId,
                    displayName: pricingItem?.modelName || formatModelName(modelId),
                    billingType: pricingItem?.type === 'times'
                        ? 'per_request'
                        : pricingItem?.groupRatio && pricingItem.groupRatio !== 1
                            ? 'multiplier'
                            : 'token',
                    inputPrice: pricingItem?.inputPrice,
                    outputPrice: pricingItem?.outputPrice,
                    perRequestPrice: pricingItem?.type === 'times' ? pricingItem.inputPrice : undefined,
                    multiplier: pricingItem?.groupRatio,
                    group: (channel as any)?.group || channel.name,
                });
            });
        });

        return Array.from(modelMap.values());
    }
}

export const newApiManagementService = new NewApiManagementFacade();
