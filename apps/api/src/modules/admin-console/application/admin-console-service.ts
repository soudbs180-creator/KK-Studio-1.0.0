import { randomBytes } from "node:crypto";

import {
  buildRequestMeta,
  type AdminAccessDto,
  type ApiResponse,
  type ChangeAdminPasswordRequestDto,
  type ChangeAdminPasswordResponseDto,
  type SetUserRoleRequestDto,
  type SetUserRoleResponseDto,
  type VerifyAdminPasswordRequestDto,
  type VerifyAdminPasswordResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";
import {
  AdminConsoleTargetNotFoundError,
  hashAdminSessionToken,
  type AdminConsoleRepository,
  AdminConsolePasswordInvalidError,
} from "../infrastructure/in-memory-admin-console-repository.ts";

const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;

export class AdminConsoleService {
  private readonly repository: AdminConsoleRepository;

  constructor(repository: AdminConsoleRepository) {
    this.repository = repository;
  }

  async getAccess(
    userId: string,
    requestId: string,
    clientVersion?: string,
    adminSessionToken?: string,
  ): Promise<ApiResponse<AdminAccessDto>> {
    const profile = await this.repository.getUserProfile(userId);
    const role = profile?.role || "user";
    const isAdmin = role === "admin";
    const passwordState = isAdmin
      ? await this.repository.getAdminPasswordState()
      : { requiresPasswordChange: false };
    const adminSession = isAdmin
      ? await this.resolveAdminSession(userId, adminSessionToken)
      : { active: false };

    return {
      success: true,
      data: {
        userId,
        role,
        isAdmin,
        requiresPasswordChange: passwordState.requiresPasswordChange,
        adminSessionActive: adminSession.active,
        adminSessionExpiresAt: adminSession.expiresAt,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async verifyAdminPassword(
    userId: string,
    input: VerifyAdminPasswordRequestDto,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<VerifyAdminPasswordResponseDto>> {
    const access = await this.requireAdmin(userId, requestId, clientVersion);
    if (!access.success) {
      return access;
    }

    const verified = await this.repository.verifyAdminPassword(input.password);
    if (!verified) {
      return {
        success: false,
        error: {
          code: "ADMIN_PASSWORD_INVALID",
          message: "The provided admin password is invalid.",
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    }

    const now = new Date();
    const adminSessionToken = this.generateAdminSessionToken();
    const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS).toISOString();
    await this.repository.revokeAdminSessions(userId, now.toISOString());
    await this.repository.createAdminSession({
      adminUserId: userId,
      sessionTokenHash: hashAdminSessionToken(adminSessionToken),
      createdAt: now.toISOString(),
      expiresAt,
    });

    const passwordState = await this.repository.getAdminPasswordState();
    return {
      success: true,
      data: {
        verified: true,
        requiresPasswordChange: passwordState.requiresPasswordChange,
        adminSessionToken,
        adminSessionExpiresAt: expiresAt,
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  async changeAdminPassword(
    userId: string,
    input: ChangeAdminPasswordRequestDto,
    requestId: string,
    clientVersion?: string,
    adminSessionToken?: string,
  ): Promise<ApiResponse<ChangeAdminPasswordResponseDto>> {
    const access = await this.requireElevatedAdmin(
      userId,
      adminSessionToken,
      requestId,
      clientVersion,
    );
    if (!access.success) {
      return access;
    }

    try {
      await this.repository.changeAdminPassword(input.oldPassword, input.newPassword);
      await this.repository.revokeAdminSessions(userId, new Date().toISOString());
      return {
        success: true,
        data: {
          changed: true,
        },
        meta: buildRequestMeta(requestId, clientVersion),
      };
    } catch (error) {
      if (error instanceof AdminConsolePasswordInvalidError) {
        return {
          success: false,
          error: {
            code: "ADMIN_PASSWORD_INVALID",
            message: error.message,
          },
          meta: buildRequestMeta(requestId, clientVersion),
        };
      }

      throw error;
    }
  }

  async setUserRole(
    userId: string,
    input: SetUserRoleRequestDto,
    requestId: string,
    clientVersion?: string,
    adminSessionToken?: string,
  ): Promise<ApiResponse<SetUserRoleResponseDto>> {
    const access = await this.requireElevatedAdmin(
      userId,
      adminSessionToken,
      requestId,
      clientVersion,
    );
    if (!access.success) {
      return access;
    }

    try {
      const updated = await this.repository.setUserRole(input.identity, input.role);
      return {
        success: true,
        data: updated,
        meta: buildRequestMeta(requestId, clientVersion),
      };
    } catch (error) {
      if (error instanceof AdminConsoleTargetNotFoundError) {
        return {
          success: false,
          error: {
            code: "ADMIN_TARGET_NOT_FOUND",
            message: error.message,
          },
          meta: buildRequestMeta(requestId, clientVersion),
        };
      }

      throw error;
    }
  }

  private async requireAdmin(
    userId: string,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<never> | { success: true }> {
    const profile = await this.repository.getUserProfile(userId);
    if (profile?.role === "admin") {
      return { success: true };
    }

    return {
      success: false,
      error: {
        code: "ADMIN_FORBIDDEN",
        message: "Admin role is required to access this endpoint.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  private async requireElevatedAdmin(
    userId: string,
    adminSessionToken: string | undefined,
    requestId: string,
    clientVersion?: string,
  ): Promise<ApiResponse<never> | { success: true }> {
    const access = await this.requireAdmin(userId, requestId, clientVersion);
    if (!access.success) {
      return access;
    }

    const session = await this.resolveAdminSession(userId, adminSessionToken);
    if (session.active) {
      return { success: true };
    }

    return {
      success: false,
      error: {
        code: "ADMIN_ELEVATION_REQUIRED",
        message: "A verified admin session is required to perform this action.",
      },
      meta: buildRequestMeta(requestId, clientVersion),
    };
  }

  private async resolveAdminSession(
    userId: string,
    adminSessionToken?: string,
  ): Promise<{ active: boolean; expiresAt?: string }> {
    const normalizedToken = String(adminSessionToken || "").trim();
    if (!normalizedToken) {
      return {
        active: false,
      };
    }

    const session = await this.repository.getActiveAdminSession(
      userId,
      hashAdminSessionToken(normalizedToken),
      new Date().toISOString(),
    );
    if (!session) {
      return {
        active: false,
      };
    }

    return {
      active: true,
      expiresAt: session.expiresAt,
    };
  }

  private generateAdminSessionToken(): string {
    return `adm_${randomBytes(32).toString("hex")}`;
  }
}
