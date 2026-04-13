import type {
  ApiResponse,
  RechargePaymentChannelDto,
  RechargeSubmissionStatusDto,
  SubmitRechargeRequestDto,
  SubmitRechargeResponseDto,
  SupportedRechargeCurrencyDto,
} from '../../../packages/contracts/src/index.ts';
import { kkWebApiClient } from '../api/kkApiClient.ts';
import { localizeUserFacingText } from '../../utils/localeText.ts';

export type RechargeSubmissionChannel = Extract<RechargePaymentChannelDto, 'alipay' | 'wechat' | 'paypal' | 'bank' | 'manual'>;

export interface RechargeSubmissionDraft {
  amount: number;
  currencyCode: SupportedRechargeCurrencyDto;
  paymentChannel: RechargeSubmissionChannel;
  transferReferenceLast4: string;
  note?: string;
}

function normalizeSubmissionAmount(value: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error('充值金额无效，请重新填写。');
  }

  return Number(numericValue.toFixed(2));
}

export function sanitizeTransferReferenceLast4(value: string): string {
  return String(value || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(-4);
}

function normalizeTransferReferenceLast4(value: string): string {
  const sanitized = sanitizeTransferReferenceLast4(value);
  if (sanitized.length !== 4) {
    throw new Error('请填写转账流水后四位。');
  }

  return sanitized;
}

function normalizeRechargeNote(value?: string): string | undefined {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, 200);
}

export function buildRechargeSubmissionRequest(input: RechargeSubmissionDraft): SubmitRechargeRequestDto {
  return {
    amount: normalizeSubmissionAmount(input.amount),
    currencyCode: input.currencyCode,
    paymentChannel: input.paymentChannel,
    transferReferenceLast4: normalizeTransferReferenceLast4(input.transferReferenceLast4),
    note: normalizeRechargeNote(input.note),
  };
}

export function buildRechargeSubmissionRequestId(userId: string): string {
  const normalizedUserId = String(userId || 'anonymous').trim() || 'anonymous';
  return `recharge-submit-${normalizedUserId}-${Date.now()}`;
}

export function getRechargeSubmissionStatusLabel(
  status: RechargeSubmissionStatusDto | string | null | undefined,
): string {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  switch (normalizedStatus) {
    case 'approved':
      return '审核通过';
    case 'rejected':
      return '审核驳回';
    case 'credited':
      return '已入账';
    case 'pending':
      return '等待审核';
    case 'completed':
      return '已完成';
    default:
      return localizeUserFacingText(status) || String(status || '').trim() || '已完成';
  }
}

export function getRechargeSubmissionErrorMessage(
  response: { error?: { code?: string | null; message?: string | null } } | null | undefined,
  fallback: string,
): string {
  const errorCode = String(response?.error?.code || '').trim().toUpperCase();
  if (errorCode === 'SERVER_PERSISTENCE_REQUIRED') {
    return '当前充值申请需要可持久化的正式后端，请联系管理员检查账本配置。';
  }

  const explicitMessage = String(response?.error?.message || '').trim();
  if (explicitMessage) {
    return localizeUserFacingText(explicitMessage) || explicitMessage;
  }

  if (errorCode === 'HTTP_404') {
    return '当前运行时尚未部署充值提交接口，请联系管理员。';
  }

  return fallback;
}

export async function submitRechargeRequest(
  input: RechargeSubmissionDraft,
  options?: { requestId?: string },
): Promise<ApiResponse<SubmitRechargeResponseDto>> {
  return kkWebApiClient.submitRecharge(
    buildRechargeSubmissionRequest(input),
    options?.requestId ? { requestId: options.requestId } : undefined,
  );
}
