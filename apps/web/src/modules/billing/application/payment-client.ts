import type {
  ApiClientRequestOptions,
  KkApiClient,
} from "../../../../../../packages/contracts/src/client/kk-api-client.ts";
import type {
  CreatePaymentOrderRequestDto,
  PaymentOrderDto,
  PaymentOrderStatusViewDto,
} from "../../../../../../packages/contracts/src/dto/payment.ts";
import type { ApiResponse } from "../../../../../../packages/contracts/src/http/envelope.ts";

export class PaymentClient {
  private readonly apiClient: KkApiClient;

  constructor(apiClient: KkApiClient) {
    this.apiClient = apiClient;
  }

  createPaymentOrder(
    input: CreatePaymentOrderRequestDto,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<PaymentOrderDto>> {
    return this.apiClient.createPaymentOrder(input, options);
  }

  getPaymentOrderStatus(
    merchantOrderNo: string,
    options?: ApiClientRequestOptions,
  ): Promise<ApiResponse<PaymentOrderStatusViewDto>> {
    return this.apiClient.getPaymentOrderStatus(merchantOrderNo, options);
  }
}
