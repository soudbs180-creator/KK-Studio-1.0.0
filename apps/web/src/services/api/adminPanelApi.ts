import type {
  AdminAdjustCreditsResponseDto,
  AdminRechargeCreditsResponseDto,
  ListAdminUsersQueryDto,
  ListAdminUsersResponseDto,
  SetUserRoleResponseDto,
} from "../../../../../packages/shared/src/index.ts";
import type { ApiResponse } from "../../../../../packages/shared/src/index.ts";
import { kkWebApiClient } from "./kkApiClient.ts";

function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (response.success) {
    return response.data;
  }

  throw new Error(response.error?.message || response.error?.code || "API request failed");
}

export async function adminGetUsers(
  params: ListAdminUsersQueryDto,
  _token?: string,
): Promise<ListAdminUsersResponseDto> {
  return unwrapApiResponse(await kkWebApiClient.listAdminUsers(params));
}

export async function adminRechargeUser(
  userId: string,
  amount: number,
  note: string,
  _token?: string,
): Promise<AdminRechargeCreditsResponseDto> {
  return unwrapApiResponse(await kkWebApiClient.adminRechargeCredits({
    identity: userId,
    creditAmount: amount,
    description: note,
  }));
}

export async function adminAdjustCredits(
  userId: string,
  delta: number,
  note: string,
  _token?: string,
): Promise<AdminAdjustCreditsResponseDto & { newBalance: number }> {
  const result = unwrapApiResponse(await kkWebApiClient.adjustAdminCredits({
    identity: userId,
    creditDelta: delta,
    description: note,
  }));

  return {
    ...result,
    newBalance: result.balanceAfter,
  };
}

export async function adminSetAdminLevel(
  userId: string,
  adminLevel: number,
  _token?: string,
): Promise<SetUserRoleResponseDto> {
  return unwrapApiResponse(await kkWebApiClient.setUserRole({
    identity: userId,
    role: adminLevel > 0 ? "admin" : "user",
  }));
}
