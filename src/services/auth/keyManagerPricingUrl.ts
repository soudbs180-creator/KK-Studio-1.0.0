const PROVIDER_MARKETING_SUFFIX_RE = /(\/(pricing|models))(\/.*)?$/i;

export function buildSilentProviderPricingUrl(baseUrl: string): string {
    const cleanBaseUrl = String(baseUrl || '');
    const sanitizedPricingBase = cleanBaseUrl.replace(PROVIDER_MARKETING_SUFFIX_RE, '') || cleanBaseUrl;
    const normalizedPricingBase = sanitizedPricingBase.replace(/\/+$/, '') || cleanBaseUrl;
    const pricingBase = normalizedPricingBase.endsWith('/v1')
        ? normalizedPricingBase.replace(/\/v1$/, '')
        : normalizedPricingBase;

    return `${pricingBase}/pricing`;
}
