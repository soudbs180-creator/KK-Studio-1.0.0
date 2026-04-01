import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  CreditExchangeRateDto,
  SupportedRechargeCurrencyDto,
  UpsertCreditExchangeRateRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { CreditExchangeRateRepository } from "./in-memory-credit-exchange-rate-repository.ts";

interface CreditExchangeRateRow {
  currency_code: SupportedRechargeCurrencyDto;
  credits_per_unit: string | number;
  min_amount: string | number | null;
  max_amount: string | number | null;
  is_active: boolean | null;
  updated_at: string | null;
}

export interface SupabaseCreditExchangeRateRepositoryOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
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

export class SupabaseCreditExchangeRateRepository implements CreditExchangeRateRepository {
  private readonly client: SupabaseClient;

  constructor(options: SupabaseCreditExchangeRateRepositoryOptions) {
    this.client = createClient(options.supabaseUrl, options.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async list(): Promise<CreditExchangeRateDto[]> {
    const { data, error } = await this.client
      .from("credit_exchange_rates")
      .select("currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at")
      .in("currency_code", ["CNY", "USD"])
      .order("currency_code", { ascending: true })
      .returns<CreditExchangeRateRow[]>();

    if (error) {
      throw error;
    }

    return (data || []).map((row) => toDto(row));
  }

  async upsert(
    input: UpsertCreditExchangeRateRequestDto,
    updatedBy?: string,
  ): Promise<CreditExchangeRateDto> {
    const payload = {
      currency_code: input.currencyCode,
      credits_per_unit: Math.max(0.000001, Number(input.creditsPerUnit) || 0),
      min_amount: input.minAmount ?? null,
      max_amount: input.maxAmount ?? null,
      is_active: input.isActive !== false,
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from("credit_exchange_rates")
      .upsert(payload, { onConflict: "currency_code" })
      .select("currency_code, credits_per_unit, min_amount, max_amount, is_active, updated_at")
      .single<CreditExchangeRateRow>();

    if (error) {
      throw error;
    }

    return toDto(data);
  }
}
