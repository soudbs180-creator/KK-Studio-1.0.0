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

export interface PasswordResetRequestDto {
  email: string;
  turnstileToken?: string;
}

export interface PasswordResetRequestResponseDto {
  requested: boolean;
  email: string;
  delivery: "email";
  status: "accepted";
  message: string;
}

export interface PasswordResetConfirmDto {
  token: string;
  newPassword: string;
}

export interface PasswordResetConfirmResponseDto {
  updated: boolean;
  status: "completed";
  message: string;
}

export interface ProfileDto {
  id: string;
  email: string;
  nickname?: string;
  avatarUrl?: string;
  authProvider?: string;
  providers?: string[];
  adminLevel?: number;
  role: "user" | "admin";
  status: "active" | "suspended";
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequestDto {
  nickname?: string;
  avatarUrl?: string;
}

export interface UpdatePasswordRequestDto {
  newPassword: string;
  verificationCode?: string;
  currentPassword?: string;
}

export interface UpdatePasswordResponseDto {
  updated: boolean;
  profile: ProfileDto;
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

export type UserApiSecretRecordType = "slot" | "provider" | "entry";
export type UserApiSecretField = "key" | "apiKey";

export interface RevealUserApiSecretRequestDto {
  recordType: UserApiSecretRecordType;
  recordId: string;
  field: UserApiSecretField;
}

export interface RevealUserApiSecretResponseDto {
  recordType: UserApiSecretRecordType;
  recordId: string;
  field: UserApiSecretField;
  secret: string;
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

export interface UserRoutePricingSyncRequestDto {
  endpointUrl?: string;
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
  refreshToken?: string;
  expiresIn: number;
  sessionExpiresAt?: string;
  profile: ProfileDto;
}

export type AuthSessionDto = LoginResponseDto;

export interface RefreshSessionRequestDto {
  refreshToken?: string;
}

export interface LogoutResponseDto {
  loggedOut: boolean;
}

export interface SendCodeRequestDto {
  email: string;
  turnstileToken: string;
}

export interface SendPasswordChangeCodeResponseDto {
  sent: boolean;
  email: string;
  expiresAt: string;
}

export interface AuthActionResultDto {
  message: string;
}

export type WechatAuthMode = "login" | "bind";
export type GoogleAuthMode = "login" | "bind";

export interface GoogleAuthStartResponseDto {
  provider: "google";
  mode: GoogleAuthMode;
  authorizationUrl: string;
  callbackUrl: string;
  state: string;
  expiresAt: string;
}

export interface WechatAuthStartResponseDto {
  provider: "wechat";
  mode: WechatAuthMode;
  authorizationUrl: string;
  callbackUrl: string;
  state: string;
  expiresAt: string;
}
