export interface RouteIdSlot {
    id: string;
    name?: string;
    provider?: string;
    proxyConfig?: {
        serverName?: string;
    };
}

export interface RouteIdProvider {
    id: string;
    name?: string;
}

export function extractSlotRouteTarget(suffix: string | null | undefined): string | null {
    const decodedSuffix = decodeRouteSuffix(suffix);

    if (!decodedSuffix) return null;
    if (decodedSuffix.startsWith('slot_key_')) return decodedSuffix.slice(5);
    if (decodedSuffix.startsWith('slot_')) return decodedSuffix.slice(5);
    if (decodedSuffix.startsWith('provider_')) return decodedSuffix;
    return null;
}

export function decodeRouteSuffix(suffix: string | null | undefined): string {
    try {
        return decodeURIComponent(String(suffix || '').trim().toLowerCase());
    } catch {
        return String(suffix || '').trim().toLowerCase();
    }
}

export function matchesSlotRouteSuffix(slot: RouteIdSlot, suffix: string | null | undefined): boolean {
    const decodedSuffix = decodeRouteSuffix(suffix);
    if (!decodedSuffix) return false;

    const routeTarget = extractSlotRouteTarget(decodedSuffix);
    const slotIdLower = String(slot.id || '').trim().toLowerCase();
    const slotNameLower = String(slot.name || '').trim().toLowerCase();
    const slotSuffixLower = String(slot.proxyConfig?.serverName || slot.provider || 'Custom').trim().toLowerCase();
    const providerLower = String(slot.provider || '').trim().toLowerCase();

    if (routeTarget) {
        return slotIdLower === routeTarget;
    }

    return (
        slotIdLower === decodedSuffix ||
        slotNameLower === decodedSuffix ||
        slotSuffixLower === decodedSuffix ||
        providerLower === decodedSuffix
    );
}

export function matchesProviderRouteSuffix(
    provider: RouteIdProvider,
    suffix: string | null | undefined
): boolean {
    const decodedSuffix = decodeRouteSuffix(suffix);
    if (!decodedSuffix) return false;

    const routeTarget = extractSlotRouteTarget(decodedSuffix);
    const providerIdLower = String(provider.id || '').trim().toLowerCase();
    const providerNameLower = String(provider.name || '').trim().toLowerCase();

    if (routeTarget) {
        return providerIdLower === routeTarget;
    }

    return providerIdLower === decodedSuffix || providerNameLower === decodedSuffix;
}

export function buildStableSystemRouteId(baseModelId: string, providerId?: string, fallbackIndex?: number): string {
    const normalizedBaseId = String(baseModelId || '').trim();
    const normalizedProviderId = String(providerId || '').trim();
    if (!normalizedProviderId) {
        return fallbackIndex && fallbackIndex > 1
            ? `${normalizedBaseId}@system_${fallbackIndex}`
            : `${normalizedBaseId}@system`;
    }
    return `${normalizedBaseId}@system_${encodeURIComponent(normalizedProviderId)}`;
}

export function buildUserSlotRouteId(baseModelId: string, slotId: string): string {
    return `${String(baseModelId || '').trim()}@slot_${encodeURIComponent(String(slotId || '').trim())}`;
}

export function buildProviderRouteId(baseModelId: string, providerId: string): string {
    const normalizedProviderId = String(providerId || '').trim();
    const routeProviderId = normalizedProviderId.startsWith('provider_')
        ? normalizedProviderId
        : `provider_${normalizedProviderId}`;
    return `${String(baseModelId || '').trim()}@${encodeURIComponent(routeProviderId)}`;
}
