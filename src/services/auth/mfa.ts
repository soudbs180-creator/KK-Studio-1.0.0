import { supabase } from '../../lib/supabase';

export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2' | null;

export interface MfaFactorSummary {
  id: string;
  factorType: 'totp' | 'phone' | 'webauthn';
  status: 'verified' | 'unverified';
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

function normalizeMfaErrorMessage(error: any): string {
  const code = String(error?.code || '').trim();

  if (code === 'mfa_totp_enroll_not_enabled') {
    return 'Supabase 侧还没有开启 TOTP 双重验证，请先在 Auth 控制台启用 MFA TOTP。';
  }

  if (code === 'mfa_totp_verify_not_enabled') {
    return 'Supabase 侧还没有开启 TOTP 校验，请先在 Auth 控制台启用 MFA TOTP。';
  }

  if (code === 'insufficient_aal') {
    return '当前会话安全等级不足，请先完成一次双重验证后再执行该操作。';
  }

  if (code === 'mfa_challenge_expired') {
    return '验证码挑战已过期，请重新发起验证。';
  }

  if (code === 'mfa_verification_failed' || code === 'mfa_verification_rejected') {
    return '验证码校验失败，请确认动态口令后重试。';
  }

  return error?.message || '双重验证操作失败，请稍后重试。';
}

function toFactorSummary(factor: any): MfaFactorSummary {
  const factorType = factor?.factor_type;
  return {
    id: String(factor?.id || ''),
    factorType:
      factorType === 'phone' || factorType === 'webauthn'
        ? factorType
        : 'totp',
    status: factor?.status === 'verified' ? 'verified' : 'unverified',
    friendlyName: factor?.friendly_name || null,
    createdAt: factor?.created_at || null,
  };
}

export async function loadMfaStatus(): Promise<MfaStatusSnapshot> {
  const [{ data: levelData, error: levelError }, { data: factorsData, error: factorsError }] =
    await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

  if (levelError) {
    throw new Error(normalizeMfaErrorMessage(levelError));
  }

  if (factorsError) {
    throw new Error(normalizeMfaErrorMessage(factorsError));
  }

  const allFactors = Array.isArray(factorsData?.all)
    ? factorsData.all.map(toFactorSummary)
    : [];

  return {
    currentLevel: levelData?.currentLevel || null,
    nextLevel: levelData?.nextLevel || null,
    verifiedFactors: allFactors.filter((factor) => factor.status === 'verified'),
    pendingFactors: allFactors.filter((factor) => factor.status !== 'verified'),
  };
}

export async function enrollTotpFactor(friendlyName: string): Promise<TotpEnrollmentResult> {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: 'KK Studio',
    friendlyName: friendlyName.trim() || 'KK Studio',
  });

  if (error) {
    throw new Error(normalizeMfaErrorMessage(error));
  }

  if (!data || data.type !== 'totp' || !data.id) {
    throw new Error('Supabase 没有返回有效的 TOTP 绑定信息。');
  }

  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyTotpFactor(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  });

  if (error) {
    throw new Error(normalizeMfaErrorMessage(error));
  }
}
