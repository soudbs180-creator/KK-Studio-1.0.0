import {
  buildRequestMeta,
  type ApiResponse,
  type CreditExchangeRateDto,
  type CreditExchangeRateListDto,
  type UpsertCreditExchangeRateRequestDto,
} from "../../../../../../packages/contracts/src/index.ts";

import type { CreditExchangeRateRepository } from "../infrastructure/in-memory-credit-exchange-rate-repository.ts";

export class CreditExchangeRateService {
  private readonly repository: CreditExchangeRateRepository;

  constructor(repository: CreditExchangeRateRepository) {
    this.repository = repository;
  }

  async listRates(
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<CreditExchangeRateListDto>> {
    const items = await this.repository.list();

    return {
      success: true,
      data: { items },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async upsertRate(
    input: UpsertCreditExchangeRateRequestDto,
    actorUserId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<CreditExchangeRateDto>> {
    const rate = await this.repository.upsert(input, actorUserId);

    return {
      success: true,
      data: rate,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
