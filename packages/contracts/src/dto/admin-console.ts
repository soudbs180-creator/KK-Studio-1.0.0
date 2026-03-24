import type { EntityId } from "./common.ts";

export interface AdminAccessDto {
  userId: EntityId;
  role: "user" | "admin";
  isAdmin: boolean;
  requiresPasswordChange: boolean;
  adminSessionActive: boolean;
  adminSessionExpiresAt?: string;
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
