import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface PaymentCreditAmountResolverInput {
  amount: string;
  currency: string;
}

export interface PaymentCreditAmountResolver {
  resolve(input: PaymentCreditAmountResolverInput): Promise<number>;
}

interface CreditExchangeRateRow {
  credits_per_unit: string | number;
  is_active: boolean;
}

export interface SupabasePaymentCreditAmountResolverOptions {
  supabaseUrl?: string;
  serviceRoleKey?: string;
}

const DEFAULT_CREDITS_PER_UNIT = {
  CNY: 5,
  USD: 30,
} as const;

function normalizeCurrencyCode(currency: string): keyof typeof DEFAULT_CREDITS_PER_UNIT {
  return String(currency || "").trim().toUpperCase() === "USD" ? "USD" : "CNY";
}

function parseAmount(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Payment amount must be a positive decimal string.");
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function toCreditsPerUnit(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

export class SupabasePaymentCreditAmountResolver implements PaymentCreditAmountResolver {
  private readonly client?: SupabaseClient;

  constructor(options: SupabasePaymentCreditAmountResolverOptions = {}) {
    if (options.supabaseUrl && options.serviceRoleKey) {
      this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  async resolve(input: PaymentCreditAmountResolverInput): Promise<number> {
    const amount = parseAmount(input.amount);
    const currencyCode = normalizeCurrencyCode(input.currency);
    const creditsPerUnit = await this.loadCreditsPerUnit(currencyCode);
    return Math.max(1, Math.round(amount * creditsPerUnit));
  }

  private async loadCreditsPerUnit(currencyCode: keyof typeof DEFAULT_CREDITS_PER_UNIT): Promise<number> {
    const fallback = DEFAULT_CREDITS_PER_UNIT[currencyCode];
    if (!this.client) {
      return fallback;
    }

    try {
      const { data, error } = await this.client
        .from("credit_exchange_rates")
        .select("credits_per_unit,is_active")
        .eq("currency_code", currencyCode)
        .eq("is_active", true)
        .maybeSingle<CreditExchangeRateRow>();

      if (error || !data || data.is_active === false) {
        return fallback;
      }

      return toCreditsPerUnit(data.credits_per_unit, fallback);
    } catch {
      return fallback;
    }
  }
}
