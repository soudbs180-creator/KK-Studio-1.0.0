import type {
  CreditExchangeRateDto,
  SupportedRechargeCurrencyDto,
  UpsertCreditExchangeRateRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { getSharedPostgresPool, hasPostgresConfig, type PostgresQueryable } from "../../../lib/postgres.ts";
import {
  DEFAULT_CREDIT_EXCHANGE_RATE_ROWS,
  InMemoryCreditExchangeRateRepository,
  type CreditExchangeRateRepository,
} from "./in-memory-credit-exchange-rate-repository.ts";

interface CreditExchangeRateRow {
  currency_code: SupportedRechargeCurrencyDto;
  credits_per_unit: string | number;
  min_amount: string | number | null;
  max_amount: string | number | null;
  is_active: boolean | null;
  updated_at: string | null;
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toDto(row: CreditExchangeRateRow): CreditExchangeRateDto {
  return {
    currencyCode: row.currency_code,
    creditsPerUnit: Math.max(0.000001, parseNumber(row.credits_per_unit) || 0),
    minAmount: parseNumber(row.min_amount),
    maxAmount: parseNumber(row.max_amount),
    isActive: row.is_active !== false,
    updatedAt: row.updated_at || null,
  };
}

export class PostgresCreditExchangeRateRepository implements CreditExchangeRateRepository {
  private readonly queryable: PostgresQueryable;

  constructor(queryable: PostgresQueryable) {
    this.queryable = queryable;
  }

  async list(): Promise<CreditExchangeRateDto[]> {
    const result = await this.queryable.query(
      `select currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at
         from credit_exchange_rates
        where currency_code in ('CNY', 'USD')
        order by currency_code asc`,
    );

    const rows = (result.rows as CreditExchangeRateRow[]).map((row) => toDto(row));
    if (rows.length > 0) {
      return rows;
    }

    return (["CNY", "USD"] as SupportedRechargeCurrencyDto[]).map((currencyCode) => ({
      ...DEFAULT_CREDIT_EXCHANGE_RATE_ROWS[currencyCode],
    }));
  }

  async upsert(
    input: UpsertCreditExchangeRateRequestDto,
    _updatedBy?: string,
  ): Promise<CreditExchangeRateDto> {
    const payload = {
      currencyCode: input.currencyCode,
      creditsPerUnit: Math.max(0.000001, Number(input.creditsPerUnit) || 0),
      minAmount: input.minAmount ?? null,
      maxAmount: input.maxAmount ?? null,
      isActive: input.isActive !== false,
      updatedAt: new Date().toISOString(),
    };

    await this.queryable.query(
      `insert into credit_exchange_rates (
         currency_code,
         credits_per_unit,
         min_amount,
         max_amount,
         is_active,
         updated_at
       ) values (
         $1, $2, $3, $4, $5, $6
       )
       on conflict (currency_code) do update
         set credits_per_unit = excluded.credits_per_unit,
             min_amount = excluded.min_amount,
             max_amount = excluded.max_amount,
             is_active = excluded.is_active,
             updated_at = excluded.updated_at`,
      [
        payload.currencyCode,
        payload.creditsPerUnit,
        payload.minAmount,
        payload.maxAmount,
        payload.isActive,
        payload.updatedAt,
      ],
    );

    return payload;
  }
}

export function createCreditExchangeRateRepositoryFromEnv(): CreditExchangeRateRepository | null {
  if (!hasPostgresConfig()) {
    return null;
  }

  return new PostgresCreditExchangeRateRepository(getSharedPostgresPool());
}
