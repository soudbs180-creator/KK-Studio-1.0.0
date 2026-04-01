import type {
  CreditExchangeRateDto,
  SupportedRechargeCurrencyDto,
  UpsertCreditExchangeRateRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";

export interface CreditExchangeRateRepository {
  list(): Promise<CreditExchangeRateDto[]>;
  upsert(
    input: UpsertCreditExchangeRateRequestDto,
    updatedBy?: string,
  ): Promise<CreditExchangeRateDto>;
}

export const DEFAULT_CREDIT_EXCHANGE_RATE_ROWS: Record<
  SupportedRechargeCurrencyDto,
  CreditExchangeRateDto
> = {
  CNY: {
    currencyCode: "CNY",
    creditsPerUnit: 5,
    minAmount: 5,
    maxAmount: 500,
    isActive: true,
    updatedAt: null,
  },
  USD: {
    currencyCode: "USD",
    creditsPerUnit: 30,
    minAmount: 1,
    maxAmount: 100,
    isActive: true,
    updatedAt: null,
  },
};

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

export class InMemoryCreditExchangeRateRepository implements CreditExchangeRateRepository {
  private readonly rates = new Map<SupportedRechargeCurrencyDto, CreditExchangeRateDto>();

  constructor(seed?: Partial<Record<SupportedRechargeCurrencyDto, Partial<CreditExchangeRateDto>>>) {
    for (const currency of Object.keys(DEFAULT_CREDIT_EXCHANGE_RATE_ROWS) as SupportedRechargeCurrencyDto[]) {
      const merged = {
        ...DEFAULT_CREDIT_EXCHANGE_RATE_ROWS[currency],
        ...(seed?.[currency] || {}),
      };

      this.rates.set(currency, cloneRate(merged));
    }
  }

  async list(): Promise<CreditExchangeRateDto[]> {
    return (["CNY", "USD"] as SupportedRechargeCurrencyDto[])
      .map((currency) => this.rates.get(currency))
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

    this.rates.set(input.currencyCode, cloneRate(nextRate));
    return cloneRate(nextRate);
  }
}
