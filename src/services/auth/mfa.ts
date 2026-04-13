export type AuthenticatorAssuranceLevel = "aal1" | "aal2" | null;

export interface MfaFactorSummary {
  id: string;
  factorType: "totp" | "phone" | "webauthn";
  status: "verified" | "unverified";
  friendlyName: string | null;
  createdAt: string | null;
}

export interface MfaStatusSnapshot {
  currentLevel: AuthenticatorAssuranceLevel;
  nextLevel: AuthenticatorAssuranceLevel;
  verifiedFactors: MfaFactorSummary[];
  pendingFactors: MfaFactorSummary[];
}

export interface TotpEnrollmentResult {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

const LOCAL_RUNTIME_MFA_UNAVAILABLE_MESSAGE =
  "当前本地运行时还没有接入双重验证后端，相关入口已停用。";

export async function loadMfaStatus(): Promise<MfaStatusSnapshot> {
  return {
    currentLevel: null,
    nextLevel: null,
    verifiedFactors: [],
    pendingFactors: [],
  };
}

export async function enrollTotpFactor(_friendlyName: string): Promise<TotpEnrollmentResult> {
  throw new Error(LOCAL_RUNTIME_MFA_UNAVAILABLE_MESSAGE);
}

export async function verifyTotpFactor(_factorId: string, _code: string): Promise<void> {
  throw new Error(LOCAL_RUNTIME_MFA_UNAVAILABLE_MESSAGE);
}
