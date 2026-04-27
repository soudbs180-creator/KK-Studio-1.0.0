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

export class StaticPaymentCreditAmountResolver implements PaymentCreditAmountResolver {
  async resolve(input: PaymentCreditAmountResolverInput): Promise<number> {
    const amount = parseAmount(input.amount);
    const currencyCode = normalizeCurrencyCode(input.currency);
    const creditsPerUnit = DEFAULT_CREDITS_PER_UNIT[currencyCode];
    return Math.max(1, Math.round(amount * creditsPerUnit));
  }
}
