import type {
  ApiClientRequestOptions,
  KkApiClient,
} from "../../../../../../packages/contracts/src/index.ts";
import type {
  AdminRechargeCreditsRequestDto,
  AdminRechargeCreditsResponseDto,
  CreditTransactionListDto,
  CreditBalanceDto,
  DebitCreditsRequestDto,
  DebitCreditsResponseDto,
  ListCreditTransactionsQueryDto,
  RefundCreditsRequestDto,
  RefundCreditsResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { ApiResponse } from "../../../../../../packages/contracts/src/index.ts";

export class BillingClient {
  private readonly apiClient: KkApiClient;

  constructor(apiClient: KkApiClient) {
    this.apiClient = apiClient;
  }

  getBalance(
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CreditBalanceDto>> {
    return this.apiClient.getCreditBalance(options);
  }

  listTransactions(
    input?: ListCreditTransactionsQueryDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<CreditTransactionListDto>> {
    return this.apiClient.listCreditTransactions(input, options);
  }

  debitCredits(
    input: DebitCreditsRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<DebitCreditsResponseDto>> {
    return this.apiClient.debitCredits(input, options);
  }

  refundCredits(
    input: RefundCreditsRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<RefundCreditsResponseDto>> {
    return this.apiClient.refundCredits(input, options);
  }

  adminRechargeCredits(
    input: AdminRechargeCreditsRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<AdminRechargeCreditsResponseDto>> {
    return this.apiClient.adminRechargeCredits(input, options);
  }
}
