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

type CreditExchangeRateRow = {
  currency_code: SupportedRechargeCurrency;
  credits_per_unit: number;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
  updated_at?: string | null;
};

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

const mapRow = (row: CreditExchangeRateRow): CreditExchangeRate => ({
  currencyCode: row.currency_code,
  creditsPerUnit: Math.max(1, toNumber(row.credits_per_unit, DEFAULT_CREDIT_EXCHANGE_RATES[row.currency_code].creditsPerUnit) || 1),
  minAmount: toNumber(row.min_amount, null),
  maxAmount: toNumber(row.max_amount, null),
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

export async function listCreditExchangeRates(): Promise<CreditExchangeRate[]> {
  const { data, error } = await supabase
    .from('credit_exchange_rates')
    .select('currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at')
    .in('currency_code', ['CNY', 'USD'])
    .order('currency_code', { ascending: true });

  if (error) {
    console.warn('[creditExchangeRateService] Failed to list exchange rates:', error.message);
    return Object.values(DEFAULT_CREDIT_EXCHANGE_RATES);
  }

  const mapped = (data || []).map((row) => mapRow(row as CreditExchangeRateRow));
  return Object.values(mergeWithDefaults(mapped));
}

export async function getCreditExchangeRateMap(): Promise<Record<SupportedRechargeCurrency, CreditExchangeRate>> {
  const { data, error } = await supabase
    .from('credit_exchange_rates')
    .select('currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at')
    .in('currency_code', ['CNY', 'USD'])
    .order('currency_code', { ascending: true });

  if (error) {
    console.warn('[creditExchangeRateService] Failed to read exchange rate map:', error.message);
    return mergeWithDefaults([]);
  }

  const mapped = (data || []).map((row) => mapRow(row as CreditExchangeRateRow));
  return mergeWithInactiveFallback(mapped);
}

export async function upsertCreditExchangeRate(rate: CreditExchangeRate): Promise<CreditExchangeRate> {
  const payload: CreditExchangeRateRow = {
    currency_code: rate.currencyCode,
    credits_per_unit: Math.max(1, rate.creditsPerUnit),
    min_amount: rate.minAmount,
    max_amount: rate.maxAmount,
    is_active: rate.isActive !== false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('credit_exchange_rates')
    .upsert(payload, { onConflict: 'currency_code' })
    .select('currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return mapRow(data as CreditExchangeRateRow);
}

export function calculateCreditsByRate(
  amount: number,
  currency: SupportedRechargeCurrency,
  rateMap: Record<SupportedRechargeCurrency, CreditExchangeRate>
): number {
  const rate = rateMap[currency] || DEFAULT_CREDIT_EXCHANGE_RATES[currency];
  return Math.max(0, Math.round(Math.max(0, amount) * rate.creditsPerUnit));
}
