import {
  buildRequestMeta,
  type ApiResponse,
  type KeyManagerCloudStateDto,
  type ReplaceKeyManagerCloudStateRequestDto,
  type ReplaceUserApiEntriesRequestDto,
  type TempUserSessionDto,
  type UserApiEntryListDto,
} from "../../../../../../packages/contracts/src/index.ts";
import { consoleLogger } from "../../../../../../packages/shared/src/index.ts";
import type { AuthDataRepository } from "../infrastructure/in-memory-auth-data-repository.ts";

export class AuthDataService {
  private readonly logger = consoleLogger.child({ module: "auth-data" });
  private readonly repository: AuthDataRepository;

  constructor(repository: AuthDataRepository) {
    this.repository = repository;
  }

  async listUserApiEntries(
    userId: string,
    email: string | undefined,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<UserApiEntryListDto>> {
    const entries = await this.repository.listUserApiEntries(userId, email);
    return {
      success: true,
      data: { entries },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async replaceUserApiEntries(
    userId: string,
    email: string | undefined,
    input: ReplaceUserApiEntriesRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<UserApiEntryListDto>> {
    const entries = await this.repository.replaceUserApiEntries(userId, email, input.entries);
    this.logger.info("User API entries replaced via migrated auth module", {
      userId,
      entryCount: entries.length,
    });

    return {
      success: true,
      data: { entries },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async getKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>> {
    const state = await this.repository.getKeyManagerCloudState(userId, email);
    return {
      success: true,
      data: state,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async replaceKeyManagerCloudState(
    userId: string,
    email: string | undefined,
    input: ReplaceKeyManagerCloudStateRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<KeyManagerCloudStateDto>> {
    const state = await this.repository.replaceKeyManagerCloudState(userId, email, input);
    this.logger.info("Key manager cloud state replaced via migrated auth module", {
      userId,
      slotCount: state.slots.length,
      providerCount: state.providers.length,
    });

    return {
      success: true,
      data: state,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async createTempUser(
    userAgent: string | undefined,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<TempUserSessionDto>> {
    const tempUser = await this.repository.createTempUser(userAgent);
    this.logger.info("Temporary guest session created via migrated auth module", {
      userId: tempUser.userId,
      expiresAt: tempUser.expiresAt,
    });

    return {
      success: true,
      data: tempUser,
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }
}
