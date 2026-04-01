import { legacyWebApiClient, shouldUseLegacyWebApiFallback } from '../api/kkApiClient';
import { supabase } from '../../lib/supabase';

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

interface CreditExchangeRateRow {
  currency_code?: SupportedRechargeCurrency | null;
  credits_per_unit?: number | null;
  min_amount?: number | null;
  max_amount?: number | null;
  is_active?: boolean | null;
  updated_at?: string | null;
}

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

const mapSupabaseRate = (row: CreditExchangeRateRow): CreditExchangeRate => mapApiRate({
  currencyCode: row.currency_code || 'CNY',
  creditsPerUnit: row.credits_per_unit ?? undefined,
  minAmount: row.min_amount ?? null,
  maxAmount: row.max_amount ?? null,
  isActive: row.is_active !== false,
  updatedAt: row.updated_at || null,
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

async function readCreditExchangeRatesViaSupabase(): Promise<CreditExchangeRate[]> {
  const { data, error } = await supabase
    .from('credit_exchange_rates')
    .select('currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at')
    .order('currency_code', { ascending: true })
    .returns<CreditExchangeRateRow[]>();

  if (error) {
    throw new Error(error.message || 'Failed to load exchange rates from Supabase.');
  }

  return (data || []).map((row) => mapSupabaseRate(row));
}

async function upsertCreditExchangeRateViaSupabase(rate: CreditExchangeRate): Promise<CreditExchangeRate> {
  const { data, error } = await supabase
    .from('credit_exchange_rates')
    .upsert(
      {
        currency_code: rate.currencyCode,
        credits_per_unit: Math.max(0.000001, Number(rate.creditsPerUnit) || 0),
        min_amount: rate.minAmount,
        max_amount: rate.maxAmount,
        is_active: rate.isActive !== false,
      },
      { onConflict: 'currency_code' },
    )
    .select('currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at')
    .single<CreditExchangeRateRow>();

  if (error) {
    throw new Error(error.message || 'Failed to update exchange rate in Supabase.');
  }

  return mapSupabaseRate(data as CreditExchangeRateRow);
}

export async function listCreditExchangeRates(): Promise<CreditExchangeRate[]> {
  if (shouldUseLegacyWebApiFallback()) {
    try {
      const response = await legacyWebApiClient.listCreditExchangeRates({
        requestId: `exchange-rates-list-${Date.now()}`,
      });

      if (response.success) {
        const mapped = (response.data.items || []).map((row) => mapApiRate(row as CreditExchangeRate));
        return Object.values(mergeWithDefaults(mapped));
      }

      console.warn(
        '[creditExchangeRateService] Failed to list exchange rates via local API, falling back to Supabase:',
        response.error?.message || 'Unknown error',
      );
    } catch (error) {
      console.warn('[creditExchangeRateService] Local API exchange-rate read failed, falling back to Supabase:', error);
    }
  }

  try {
    return Object.values(mergeWithDefaults(await readCreditExchangeRatesViaSupabase()));
  } catch (fallbackError) {
    console.warn('[creditExchangeRateService] Supabase exchange-rate fallback failed:', fallbackError);
    return Object.values(DEFAULT_CREDIT_EXCHANGE_RATES);
  }
}

export async function getCreditExchangeRateMap(): Promise<Record<SupportedRechargeCurrency, CreditExchangeRate>> {
  if (shouldUseLegacyWebApiFallback()) {
    try {
      const response = await legacyWebApiClient.listCreditExchangeRates({
        requestId: `exchange-rates-map-${Date.now()}`,
      });

      if (response.success) {
        const mapped = (response.data.items || []).map((row) => mapApiRate(row as CreditExchangeRate));
        return mergeWithInactiveFallback(mapped);
      }

      console.warn(
        '[creditExchangeRateService] Failed to read exchange rate map via local API, falling back to Supabase:',
        response.error?.message || 'Unknown error',
      );
    } catch (error) {
      console.warn('[creditExchangeRateService] Local API exchange-rate map failed, falling back to Supabase:', error);
    }
  }

  try {
    return mergeWithInactiveFallback(await readCreditExchangeRatesViaSupabase());
  } catch (fallbackError) {
    console.warn('[creditExchangeRateService] Supabase exchange-rate map fallback failed:', fallbackError);
    return mergeWithDefaults([]);
  }
}

export async function upsertCreditExchangeRate(rate: CreditExchangeRate): Promise<CreditExchangeRate> {
  if (shouldUseLegacyWebApiFallback()) {
    try {
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

      if (response.success) {
        return mapApiRate(response.data as CreditExchangeRate);
      }

      console.warn(
        '[creditExchangeRateService] Failed to update exchange rate via local API, falling back to Supabase:',
        response.error?.message || 'Unknown error',
      );
    } catch (error) {
      console.warn('[creditExchangeRateService] Local API exchange-rate update failed, falling back to Supabase:', error);
    }
  }

  return await upsertCreditExchangeRateViaSupabase(rate);
}

export function calculateCreditsByRate(
  amount: number,
  currency: SupportedRechargeCurrency,
  rateMap: Record<SupportedRechargeCurrency, CreditExchangeRate>
): number {
  const rate = rateMap[currency] || DEFAULT_CREDIT_EXCHANGE_RATES[currency];
  return Math.max(0, Math.round(Math.max(0, amount) * rate.creditsPerUnit));
}
