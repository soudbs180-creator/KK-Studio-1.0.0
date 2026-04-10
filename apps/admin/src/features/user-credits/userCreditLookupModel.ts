import type {
  AdminCreditAccountLookupDto,
  AdminRechargeCreditsRequestDto,
} from '../../../../../packages/contracts/src/index.ts';

export function getLatestCreditBalance(payload: AdminCreditAccountLookupDto): number {
  return Number(payload.balance || 0);
}

export function buildAdminRechargeRequest(
  input: AdminRechargeCreditsRequestDto,
): AdminRechargeCreditsRequestDto {
  return {
    identity: input.identity.trim(),
    creditAmount: Number(input.creditAmount),
    description: input.description?.trim() || undefined,
  };
}
