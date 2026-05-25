export type EntityId = string;

export interface MoneyDto {
  amount: string;
  currency: string;
}

export interface AuditFieldsDto {
  createdAt: string;
  updatedAt: string;
}

export interface IdempotentRequestDto {
  idempotencyKey: string;
}
