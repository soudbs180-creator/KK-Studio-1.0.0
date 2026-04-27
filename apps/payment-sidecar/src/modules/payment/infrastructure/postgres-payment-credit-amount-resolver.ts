import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import type {
  PaymentCreditAmountResolver,
  PaymentCreditAmountResolverInput,
} from "./payment-credit-amount-resolver.ts";
import { StaticPaymentCreditAmountResolver } from "./payment-credit-amount-resolver.ts";

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

export class PostgresPaymentCreditAmountResolver implements PaymentCreditAmountResolver {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async resolve(input: PaymentCreditAmountResolverInput): Promise<number> {
    const amount = parseAmount(input.amount);
    const currencyCode = normalizeCurrencyCode(input.currency);
    const creditsPerUnit = await this.loadCreditsPerUnit(currencyCode);
    return Math.max(1, Math.round(amount * creditsPerUnit));
  }

  private async loadCreditsPerUnit(currencyCode: keyof typeof DEFAULT_CREDITS_PER_UNIT): Promise<number> {
    const fallback = DEFAULT_CREDITS_PER_UNIT[currencyCode];

    try {
      const result = await this.queryable.query(
        `select credits_per_unit, is_active
           from credit_exchange_rates
          where currency_code = $1
            and is_active = true
          limit 1`,
        [currencyCode],
      );
      const row = result.rows[0] as CreditExchangeRateRow | undefined;
      if (!row || row.is_active === false) {
        return fallback;
      }

      return toCreditsPerUnit(row.credits_per_unit, fallback);
    } catch {
      return fallback;
    }
  }
}

export function createPaymentCreditAmountResolverFromEnv(options: {
  createPostgresResolver?: () => PaymentCreditAmountResolver;
} = {}): PaymentCreditAmountResolver {
  if (hasPostgresConfig()) {
    if (options.createPostgresResolver) {
      return options.createPostgresResolver();
    }

    return new PostgresPaymentCreditAmountResolver(getSharedPostgresPool());
  }

  return new StaticPaymentCreditAmountResolver();
}
