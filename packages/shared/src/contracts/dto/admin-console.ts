import type { EntityId } from "./common.ts";

export interface AdminAccessDto {
  userId: EntityId;
  role: "user" | "admin";
  isAdmin: boolean;
  requiresPasswordChange: boolean;
  adminSessionActive: boolean;
  adminSessionExpiresAt?: string;
}

export interface AdminUserListItemDto {
  id: EntityId;
  email: string;
  credits: number;
  adminLevel: number;
  createdAt: string;
}

export interface ListAdminUsersQueryDto {
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListAdminUsersResponseDto {
  users: AdminUserListItemDto[];
  total: number;
  page: number;
  limit: number;
}

export interface VerifyAdminPasswordRequestDto {
  password: string;
}

export interface VerifyAdminPasswordResponseDto {
  verified: boolean;
  requiresPasswordChange: boolean;
  adminSessionToken: string;
  adminSessionExpiresAt: string;
}

export interface ChangeAdminPasswordRequestDto {
  oldPassword: string;
  newPassword: string;
}

export interface ChangeAdminPasswordResponseDto {
  changed: boolean;
}

export interface SetUserRoleRequestDto {
  identity: string;
  role: "user" | "admin";
}

export interface SetUserRoleResponseDto {
  identity: string;
  subjectId: EntityId;
  role: "user" | "admin";
  subjectEmail?: string;
}

export interface AdminAdjustCreditsRequestDto {
  identity: string;
  creditDelta: number;
  description: string;
}

export interface AdminAdjustCreditsResponseDto {
  identity: string;
  subjectId: EntityId;
  subjectEmail?: string;
  balanceAfter: number;
  delta: number;
}
