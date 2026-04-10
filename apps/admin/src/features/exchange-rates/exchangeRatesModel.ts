import type { CreditExchangeRateDto, UpsertCreditExchangeRateRequestDto } from '../../../../../packages/contracts/src/index.ts';

export function createEditableExchangeRateRows(rows: CreditExchangeRateDto[]) {
  return [...rows].sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));
}

export function toUpsertCreditExchangeRateInput(
  row: CreditExchangeRateDto,
): UpsertCreditExchangeRateRequestDto {
  return {
    currencyCode: row.currencyCode,
    creditsPerUnit: Number(row.creditsPerUnit),
    minAmount: row.minAmount,
    maxAmount: row.maxAmount,
    isActive: row.isActive,
  };
}
