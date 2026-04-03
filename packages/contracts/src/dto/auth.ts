export interface RegisterRequestDto {
  email: string;
  password: string;
  turnstileToken: string;
}

export interface RegisterResponseDto {
  userId: string;
  email: string;
  status: "registered" | "verification_pending";
}

export interface LoginRequestDto {
  email: string;
  password: string;
  turnstileToken?: string;
}

export interface ProfileDto {
  id: string;
  email: string;
  nickname?: string;
  avatarUrl?: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequestDto {
  nickname?: string;
  avatarUrl?: string;
}

export type UserApiEntryType = "official" | "proxy" | "third-party";
export type UserApiProtocolFormat = "gemini" | "openai" | "auto" | "claude";
export type UserApiEntryStatus = "valid" | "invalid" | "rate_limited" | "unknown";

export interface UserApiEntryDto {
  id: string;
  key: string;
  name: string;
  provider: string;
  type: UserApiEntryType;
  format: UserApiProtocolFormat;
  baseUrl?: string;
  supportedModels: string[];
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
  status: UserApiEntryStatus;
  failCount: number;
  successCount: number;
  totalCost: number;
  budgetLimit: number;
  tokenLimit: number;
  usedTokens: number;
  lastUsed: number | null;
  lastError: string | null;
}

export interface UserApiEntryListDto {
  entries: UserApiEntryDto[];
}

export interface ReplaceUserApiEntriesRequestDto {
  entries: UserApiEntryDto[];
}

export interface ReplaceUserApisPayloadRequestDto {
  version?: number;
  slots: KeyManagerCloudRecordDto[];
  providers: KeyManagerCloudRecordDto[];
  entries: UserApiEntryDto[];
}

export interface KeyManagerCloudRecordDto {
  [key: string]: unknown;
}

export interface UserRouteConnectivityCheckDto {
  routeId: string;
  ok: boolean;
  message?: string;
  endpointUrl: string;
  latencyMs?: number | null;
  resolvedFormat: UserApiProtocolFormat;
  models: string[];
}

export interface UserRoutePricingSyncDto {
  routeId: string;
  ok: boolean;
  message?: string;
  endpointUrl?: string;
  attemptedUrls?: string[];
  count: number;
  pricingData: KeyManagerCloudRecordDto[];
  groupRatio: Record<string, number>;
}

export interface KeyManagerCloudStateDto {
  version: number;
  slots: KeyManagerCloudRecordDto[];
  providers: KeyManagerCloudRecordDto[];
  entries: UserApiEntryDto[];
}

export interface ReplaceKeyManagerCloudStateRequestDto {
  version?: number;
  slots: KeyManagerCloudRecordDto[];
  providers?: KeyManagerCloudRecordDto[];
}

export interface TempUserSessionDto {
  userId: string;
  email: string;
  nickname: string;
  createdAt: string;
  expiresAt: string;
  isTempUser: true;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  profile: ProfileDto;
}

export interface SendCodeRequestDto {
  email: string;
  turnstileToken: string;
}

export interface AuthActionResultDto {
  message: string;
}

export type WechatAuthMode = "login" | "bind";

export interface WechatAuthStartResponseDto {
  provider: "wechat";
  mode: WechatAuthMode;
  authorizationUrl: string;
  callbackUrl: string;
  state: string;
  expiresAt: string;
}
