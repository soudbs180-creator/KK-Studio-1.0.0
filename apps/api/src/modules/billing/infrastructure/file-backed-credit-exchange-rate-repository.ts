import path from "node:path";

import type {
  CreditExchangeRateDto,
  SupportedRechargeCurrencyDto,
  UpsertCreditExchangeRateRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { FileBackedJsonStore } from "./file-backed-json-store.ts";
import {
  type CreditExchangeRateRepository,
  DEFAULT_CREDIT_EXCHANGE_RATE_ROWS,
} from "./in-memory-credit-exchange-rate-repository.ts";

interface PersistedCreditExchangeRateState {
  version: 1;
  rates: Partial<Record<SupportedRechargeCurrencyDto, CreditExchangeRateDto>>;
}

export interface FileBackedCreditExchangeRateRepositoryOptions {
  filePath?: string;
  seed?: Partial<Record<SupportedRechargeCurrencyDto, Partial<CreditExchangeRateDto>>>;
}

function buildDefaultFilePath(): string {
  const configuredPath = String(process.env.KK_LOCAL_RECHARGE_CONFIG_FILE || "").trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), ".kk-local", "billing", "exchange-rates.json");
}

function isPersistedState(value: unknown): value is PersistedCreditExchangeRateState {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as { version?: unknown }).version === 1
    && typeof (value as { rates?: unknown }).rates === "object"
  );
}

function cloneRate(rate: CreditExchangeRateDto): CreditExchangeRateDto {
  return {
    currencyCode: rate.currencyCode,
    creditsPerUnit: rate.creditsPerUnit,
    minAmount: rate.minAmount ?? null,
    maxAmount: rate.maxAmount ?? null,
    isActive: rate.isActive !== false,
    updatedAt: rate.updatedAt ?? null,
  };
}

function buildSeedRates(
  seed?: Partial<Record<SupportedRechargeCurrencyDto, Partial<CreditExchangeRateDto>>>,
): Partial<Record<SupportedRechargeCurrencyDto, CreditExchangeRateDto>> {
  const rates: Partial<Record<SupportedRechargeCurrencyDto, CreditExchangeRateDto>> = {};

  for (const currency of Object.keys(DEFAULT_CREDIT_EXCHANGE_RATE_ROWS) as SupportedRechargeCurrencyDto[]) {
    rates[currency] = cloneRate({
      ...DEFAULT_CREDIT_EXCHANGE_RATE_ROWS[currency],
      ...(seed?.[currency] || {}),
    });
  }

  return rates;
}

export class FileBackedCreditExchangeRateRepository implements CreditExchangeRateRepository {
  private readonly store: FileBackedJsonStore<PersistedCreditExchangeRateState>;

  constructor(options: FileBackedCreditExchangeRateRepositoryOptions = {}) {
    const seedRates = buildSeedRates(options.seed);
    this.store = new FileBackedJsonStore<PersistedCreditExchangeRateState>({
      filePath: options.filePath?.trim() ? options.filePath.trim() : buildDefaultFilePath(),
      createEmptyState: () => ({
        version: 1,
        rates: seedRates,
      }),
      isState: isPersistedState,
    });
  }

  async list(): Promise<CreditExchangeRateDto[]> {
    const state = await this.store.readState();
    return (["CNY", "USD"] as SupportedRechargeCurrencyDto[])
      .map((currency) => state.rates[currency] || DEFAULT_CREDIT_EXCHANGE_RATE_ROWS[currency])
      .filter((rate): rate is CreditExchangeRateDto => Boolean(rate))
      .map((rate) => cloneRate(rate));
  }

  async upsert(
    input: UpsertCreditExchangeRateRequestDto,
    _updatedBy?: string,
  ): Promise<CreditExchangeRateDto> {
    const nextRate: CreditExchangeRateDto = {
      currencyCode: input.currencyCode,
      creditsPerUnit: Math.max(0.000001, Number(input.creditsPerUnit) || 0),
      minAmount: input.minAmount ?? null,
      maxAmount: input.maxAmount ?? null,
      isActive: input.isActive !== false,
      updatedAt: new Date().toISOString(),
    };

    return this.store.withState(async (state) => ({
      state: {
        ...state,
        rates: {
          ...state.rates,
          [input.currencyCode]: cloneRate(nextRate),
        },
      },
      result: cloneRate(nextRate),
    }));
  }
}
