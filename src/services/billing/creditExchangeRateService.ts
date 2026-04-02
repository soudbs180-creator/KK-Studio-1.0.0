import { legacyWebApiClient } from '../api/kkApiClient';

export type SupportedRechargeCurrency = 'CNY' | 'USD';

export interface CreditExchangeRate {
  currencyCode: SupportedRechargeCurrency;
  creditsPerUnit: number;
  minAmount: number | null;
  maxAmount: number | null;
  isActive: boolean;
  updatedAt?: string | null;
}

export const DEFAULT_CREDIT_EXCHANGE_RATES: Record<SupportedRechargeCurrency, CreditExchangeRate> = {
  CNY: {
    currencyCode: 'CNY',
    creditsPerUnit: 5,
    minAmount: 5,
    maxAmount: 500,
    isActive: true,
  },
  USD: {
    currencyCode: 'USD',
    creditsPerUnit: 30,
    minAmount: 1,
    maxAmount: 100,
    isActive: true,
  },
};

const toNumber = (value: unknown, fallback: number | null = null): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const mapApiRate = (row: Partial<CreditExchangeRate> & { currencyCode?: SupportedRechargeCurrency | null }): CreditExchangeRate => ({
  currencyCode: row.currencyCode || 'CNY',
  creditsPerUnit: Math.max(
    0.000001,
    toNumber(
      row.creditsPerUnit,
      DEFAULT_CREDIT_EXCHANGE_RATES[(row.currencyCode || 'CNY') as SupportedRechargeCurrency].creditsPerUnit,
    ) || 0,
  ),
  minAmount: toNumber(row.minAmount, null),
  maxAmount: toNumber(row.maxAmount, null),
  isActive: row.isActive !== false,
  updatedAt: row.updatedAt || null,
});

const mergeWithDefaults = (rows: CreditExchangeRate[]): Record<SupportedRechargeCurrency, CreditExchangeRate> => {
  const merged = {
    ...DEFAULT_CREDIT_EXCHANGE_RATES,
  };

  rows.forEach((row) => {
    merged[row.currencyCode] = {
      ...merged[row.currencyCode],
      ...row,
    };
  });

  return merged;
};

const mergeWithInactiveFallback = (rows: CreditExchangeRate[]): Record<SupportedRechargeCurrency, CreditExchangeRate> => {
  const merged: Record<SupportedRechargeCurrency, CreditExchangeRate> = {
    CNY: {
      ...DEFAULT_CREDIT_EXCHANGE_RATES.CNY,
      isActive: false,
    },
    USD: {
      ...DEFAULT_CREDIT_EXCHANGE_RATES.USD,
      isActive: false,
    },
  };

  rows.forEach((row) => {
    merged[row.currencyCode] = {
      ...merged[row.currencyCode],
      ...row,
    };
  });

  return merged;
};

export async function listCreditExchangeRates(): Promise<CreditExchangeRate[]> {
  try {
    const response = await legacyWebApiClient.listCreditExchangeRates({
      requestId: `exchange-rates-list-${Date.now()}`,
    });

    if (!response.success) {
      console.warn(
        '[creditExchangeRateService] Failed to list exchange rates via canonical API, using defaults:',
        response.error?.message || 'Unknown error',
      );
      return Object.values(DEFAULT_CREDIT_EXCHANGE_RATES);
    }

    const mapped = (response.data.items || []).map((row) => mapApiRate(row as CreditExchangeRate));
    return Object.values(mergeWithDefaults(mapped));
  } catch (error) {
    console.warn('[creditExchangeRateService] Canonical API exchange-rate read failed, using defaults:', error);
    return Object.values(DEFAULT_CREDIT_EXCHANGE_RATES);
  }
}

export async function getCreditExchangeRateMap(): Promise<Record<SupportedRechargeCurrency, CreditExchangeRate>> {
  try {
    const response = await legacyWebApiClient.listCreditExchangeRates({
      requestId: `exchange-rates-map-${Date.now()}`,
    });

    if (!response.success) {
      console.warn(
        '[creditExchangeRateService] Failed to read exchange rate map via canonical API, using defaults:',
        response.error?.message || 'Unknown error',
      );
      return mergeWithDefaults([]);
    }

    const mapped = (response.data.items || []).map((row) => mapApiRate(row as CreditExchangeRate));
    return mergeWithInactiveFallback(mapped);
  } catch (error) {
    console.warn('[creditExchangeRateService] Canonical API exchange-rate map failed, using defaults:', error);
    return mergeWithDefaults([]);
  }
}

export async function upsertCreditExchangeRate(rate: CreditExchangeRate): Promise<CreditExchangeRate> {
  const response = await legacyWebApiClient.upsertCreditExchangeRate(
    {
      currencyCode: rate.currencyCode,
      creditsPerUnit: Math.max(0.000001, Number(rate.creditsPerUnit) || 0),
      minAmount: rate.minAmount,
      maxAmount: rate.maxAmount,
      isActive: rate.isActive !== false,
    },
    {
      requestId: `exchange-rates-upsert-${rate.currencyCode}-${Date.now()}`,
    },
  );

  if (!response.success) {
    throw new Error(response.error?.message || 'Failed to update exchange rate via canonical API.');
  }

  return mapApiRate(response.data as CreditExchangeRate);
}

export function calculateCreditsByRate(
  amount: number,
  currency: SupportedRechargeCurrency,
  rateMap: Record<SupportedRechargeCurrency, CreditExchangeRate>
): number {
  const rate = rateMap[currency] || DEFAULT_CREDIT_EXCHANGE_RATES[currency];
  return Math.max(0, Math.round(Math.max(0, amount) * rate.creditsPerUnit));
}
