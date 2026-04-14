import {
  buildRequestMeta,
  type ApiResponse,
  type RechargePaymentChannelConfigListDto,
} from "../../../../../../packages/contracts/src/index.ts";
import type { RechargePaymentChannelConfigRepository } from "../infrastructure/in-memory-recharge-payment-channel-config-repository.ts";

export class RechargePaymentChannelConfigService {
  private readonly repository: RechargePaymentChannelConfigRepository;

  constructor(repository: RechargePaymentChannelConfigRepository) {
    this.repository = repository;
  }

  async listChannels(
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<RechargePaymentChannelConfigListDto>> {
    const items = await this.repository.list();

    return {
      success: true,
      data: { items },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
