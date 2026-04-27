import type {
  ApiResponse,
  CreateRechargeSubmissionRequestDto,
  CreateRechargeSubmissionResponseDto,
  ListAdminRechargeSubmissionsResponseDto,
  ManualRechargeProviderDto,
  MarkRechargeSubmissionPaidResponseDto,
  RechargePaymentChannelConfigDto,
  RechargePaymentChannelConfigListDto,
  RechargePaymentChannelDto,
  RechargeSubmissionStatusDto,
  SubmitRechargeProofRequestDto,
  SubmitRechargeProofResponseDto,
  SubmitRechargeRequestDto,
  SubmitRechargeResponseDto,
  SupportedRechargeCurrencyDto,
} from '../../../packages/contracts/src/index.ts';
import { kkWebApiClient } from '../api/kkApiClient.ts';
import { localizeUserFacingText } from '../../utils/localeText.ts';

export type RechargeSubmissionChannel = Extract<
  RechargePaymentChannelDto,
  'alipay' | 'wechat' | 'paypal' | 'bank' | 'manual'
>;

export interface RechargeSubmissionDraft {
  amount: number;
  currencyCode: SupportedRechargeCurrencyDto;
  paymentChannel: RechargeSubmissionChannel;
  transferReferenceLast4: string;
  note?: string;
}

export interface RechargeBillDraft {
  amount: number;
  currencyCode: SupportedRechargeCurrencyDto;
  paymentChannel: RechargeSubmissionChannel;
  manualProvider?: ManualRechargeProviderDto;
  note?: string;
}

export interface RechargeProofSubmissionDraft extends RechargeSubmissionDraft {
  submissionId?: string;
  billNumber?: string;
}

export interface RechargeQrDisplay {
  title?: string;
  subtitle?: string;
  helperText?: string;
  accentLabel?: string;
  codeValue?: string | null;
  imageUrl?: string | null;
}

export interface RechargePaymentChannelConfig extends RechargePaymentChannelConfigDto {
  qrDisplay?: RechargeQrDisplay;
}

export interface RechargeBillRequest {
  amount: number;
  currencyCode: SupportedRechargeCurrencyDto;
  paymentChannel: RechargeSubmissionChannel;
  manualProvider?: ManualRechargeProviderDto;
  note?: string;
}

export interface RechargeProofSubmissionRequest extends SubmitRechargeRequestDto {
  submissionId?: string;
  billNumber?: string;
}

export interface RechargeBillSnapshotSeed {
  submissionId?: string;
  billNumber?: string;
  amount: number;
  currencyCode: SupportedRechargeCurrencyDto;
  paymentChannel: RechargeSubmissionChannel;
  manualProvider?: ManualRechargeProviderDto | null;
  baseAmount?: number;
  serviceFee?: number;
  payableAmount?: number;
  baseCredits?: number;
  bonusCredits?: number;
  creditAmount?: number;
  estimatedCredits?: number;
  transferReferenceLast4?: string;
  note?: string;
  status?: string;
  qrDisplay?: RechargeQrDisplay;
  expiresAt?: string;
  paymentMarkedAt?: string | null;
  submittedAt?: string;
}

export interface RechargeBillSnapshot {
  submissionId: string;
  billNumber: string;
  amount: number;
  currencyCode: SupportedRechargeCurrencyDto;
  paymentChannel: RechargeSubmissionChannel;
  manualProvider?: ManualRechargeProviderDto | null;
  baseAmount?: number;
  serviceFee?: number;
  payableAmount?: number;
  baseCredits?: number;
  bonusCredits?: number;
  creditAmount?: number;
  estimatedCredits?: number;
  transferReferenceLast4?: string;
  note?: string;
  status: string;
  statusLabel: string;
  expiresAt?: string;
  paymentMarkedAt?: string | null;
  qrDisplay?: RechargeQrDisplay;
  submittedAt?: string;
}

export interface RechargeBillRecord {
  submissionId?: string | null;
  billNumber?: string | null;
  amount?: number | null;
  currencyCode?: SupportedRechargeCurrencyDto | null;
  paymentChannel?: RechargeSubmissionChannel | null;
  manualProvider?: ManualRechargeProviderDto | null;
  baseAmount?: number | null;
  serviceFee?: number | null;
  payableAmount?: number | null;
  baseCredits?: number | null;
  bonusCredits?: number | null;
  creditAmount?: number | null;
  estimatedCredits?: number | null;
  transferReferenceLast4?: string | null;
  note?: string | null;
  status?: string | null;
  expiresAt?: string | null;
  paymentMarkedAt?: string | null;
  qrDisplay?: RechargeQrDisplay | null;
  submittedAt?: string | null;
}

export interface RechargeBillResponseDto {
  bill: RechargeBillRecord;
}

export interface RechargeProofSubmissionResponseDto {
  bill?: RechargeBillRecord;
  submission?: Partial<SubmitRechargeResponseDto['submission']>;
}

type RechargeClientOptions = { requestId?: string };

type ExtendedRechargeApiClient = typeof kkWebApiClient & {
  createRechargeSubmission?: (
    input: CreateRechargeSubmissionRequestDto,
    options?: RechargeClientOptions,
  ) => Promise<ApiResponse<CreateRechargeSubmissionResponseDto>>;
  submitRechargeProof?: (
    submissionId: string,
    input: SubmitRechargeProofRequestDto,
    options?: RechargeClientOptions,
  ) => Promise<ApiResponse<SubmitRechargeProofResponseDto>>;
  listRechargePaymentChannels?: (
    options?: RechargeClientOptions,
  ) => Promise<ApiResponse<RechargePaymentChannelConfigListDto>>;
  markRechargeSubmissionPaid?: (
    submissionId: string,
    options?: RechargeClientOptions,
  ) => Promise<ApiResponse<MarkRechargeSubmissionPaidResponseDto>>;
  listAdminRechargeSubmissions?: (
    options?: RechargeClientOptions,
  ) => Promise<ApiResponse<ListAdminRechargeSubmissionsResponseDto>>;
};

const rechargeApiClient = kkWebApiClient as ExtendedRechargeApiClient;

const RECHARGE_CHANNELS: RechargeSubmissionChannel[] = ['alipay', 'wechat', 'paypal', 'bank', 'manual'];
const RECHARGE_CURRENCIES: SupportedRechargeCurrencyDto[] = ['CNY', 'USD'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickFirstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = String(value ?? '').trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function pickNumericValue(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return fallback;
  }

  return Number(numericValue.toFixed(2));
}

function pickEstimatedCredits(value: unknown, fallback?: number): number | undefined {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return fallback;
  }

  return Math.round(numericValue);
}

function normalizeSubmissionAmount(value: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error('\u5145\u503c\u91d1\u989d\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u586b\u5199\u3002');
  }

  return Number(numericValue.toFixed(2));
}

function normalizeRechargeCurrency(
  value: unknown,
  fallback: SupportedRechargeCurrencyDto,
): SupportedRechargeCurrencyDto {
  const normalized = String(value ?? '').trim().toUpperCase() as SupportedRechargeCurrencyDto;
  return RECHARGE_CURRENCIES.includes(normalized) ? normalized : fallback;
}

function normalizeRechargeChannel(
  value: unknown,
  fallback: RechargeSubmissionChannel,
): RechargeSubmissionChannel {
  const normalized = String(value ?? '').trim().toLowerCase() as RechargeSubmissionChannel;
  return RECHARGE_CHANNELS.includes(normalized) ? normalized : fallback;
}

function normalizeManualProvider(value: unknown): ManualRechargeProviderDto | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'alipay' || normalized === 'wechat' ? normalized : undefined;
}

function normalizeRechargeNote(value?: string): string | undefined {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, 200);
}

function normalizeQrDisplay(value: unknown): RechargeQrDisplay | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const title = pickFirstString(value.title, value.label);
  const subtitle = pickFirstString(value.subtitle, value.caption);
  const helperText = pickFirstString(value.helperText, value.description, value.tip);
  const accentLabel = pickFirstString(value.accentLabel, value.badgeText);
  const codeValue = pickFirstString(value.codeValue, value.payload, value.value) ?? null;
  const imageUrl = pickFirstString(value.imageUrl, value.qrImageUrl) ?? null;

  if (!title && !subtitle && !helperText && !accentLabel && !codeValue && !imageUrl) {
    return undefined;
  }

  const normalized: RechargeQrDisplay = {};
  if (title) {
    normalized.title = title;
  }
  if (subtitle) {
    normalized.subtitle = subtitle;
  }
  if (helperText) {
    normalized.helperText = helperText;
  }
  if (accentLabel) {
    normalized.accentLabel = accentLabel;
  }
  if (codeValue) {
    normalized.codeValue = codeValue;
  }
  if (imageUrl) {
    normalized.imageUrl = imageUrl;
  }

  return normalized;
}

function buildRequestMeta(requestId: string) {
  return {
    requestId,
    timestamp: new Date().toISOString(),
  };
}

function buildLocalBillNumber(seed: string): string {
  const normalizedSeed = seed.replace(/[^A-Z0-9]/gi, '').toUpperCase() || Date.now().toString(36).toUpperCase();
  return `BILL-${normalizedSeed.slice(-12)}`;
}

function buildLocalRechargeBill(
  input: RechargeBillRequest,
  requestId?: string,
): RechargeBillRecord {
  const timestamp = new Date().toISOString();
  const submissionId = requestId || `recharge-bill-${Date.now()}`;

  return {
    submissionId,
    billNumber: buildLocalBillNumber(submissionId),
    amount: input.amount,
    currencyCode: input.currencyCode,
    paymentChannel: input.paymentChannel,
    note: input.note,
    status: 'bill_created',
    submittedAt: timestamp,
  };
}

function buildDefaultRechargePaymentChannelConfigs(): RechargePaymentChannelConfig[] {
  const defaults: RechargePaymentChannelConfig[] = [
    {
      channel: 'alipay',
      label: '支付宝',
      instructionText: '使用支付宝静态码完成转账后，再提交账单编号和流水尾号。',
      isActive: true,
      qrImageDataUrl: null,
      qrImagePath: null,
    },
    {
      channel: 'wechat',
      label: '微信',
      instructionText: '使用微信静态码完成转账后，再提交账单编号和流水尾号。',
      isActive: true,
      qrImageDataUrl: null,
      qrImagePath: null,
    },
    {
      channel: 'paypal',
      label: 'PayPal',
      instructionText: '国际付款完成后，再提交账单编号和流水尾号。',
      isActive: false,
      qrImageDataUrl: null,
      qrImagePath: null,
    },
    {
      channel: 'bank',
      label: '银行卡',
      instructionText: '线下或网银转账后，再提交账单编号和流水尾号。',
      isActive: false,
      qrImageDataUrl: null,
      qrImagePath: null,
    },
    {
      channel: 'manual',
      label: '人工处理',
      instructionText: '联系管理员确认付款后，再按账单编号核销。',
      isActive: true,
      qrImageDataUrl: null,
      qrImagePath: null,
    },
  ];

  return defaults.map((item) => ({
    ...item,
    qrDisplay: normalizeQrDisplay({
      title: item.label,
      helperText: item.instructionText,
      imageUrl: item.qrImageDataUrl,
    }),
  }));
}

function normalizeRechargePaymentChannelConfig(
  value: RechargePaymentChannelConfigDto,
): RechargePaymentChannelConfig {
  return {
    channel: normalizeRechargeChannel(value.channel, 'manual'),
    label: pickFirstString(value.label) || 'Manual',
    qrImageDataUrl: pickFirstString(value.qrImageDataUrl) ?? null,
    qrImagePath: pickFirstString(value.qrImagePath) ?? null,
    instructionText: pickFirstString(value.instructionText) ?? null,
    isActive: value.isActive !== false,
    qrDisplay: normalizeQrDisplay({
      title: value.label,
      helperText: value.instructionText,
      imageUrl: value.qrImageDataUrl,
      codeValue: value.qrImagePath,
    }),
  };
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
    throw new Error('\u8bf7\u586b\u5199\u8f6c\u8d26\u6d41\u6c34\u540e\u56db\u4f4d\u3002');
  }

  return sanitized;
}

export function buildRechargeBillRequest(input: RechargeBillDraft): RechargeBillRequest {
  const manualProvider = normalizeManualProvider(input.manualProvider);
  return {
    amount: normalizeSubmissionAmount(input.amount),
    currencyCode: input.currencyCode,
    paymentChannel: input.paymentChannel,
    manualProvider,
    note: normalizeRechargeNote(input.note),
  };
}

export function buildRechargeProofSubmissionRequest(
  input: RechargeProofSubmissionDraft,
): RechargeProofSubmissionRequest {
  return {
    submissionId: pickFirstString(input.submissionId),
    billNumber: pickFirstString(input.billNumber),
    amount: normalizeSubmissionAmount(input.amount),
    currencyCode: input.currencyCode,
    paymentChannel: input.paymentChannel,
    transferReferenceLast4: normalizeTransferReferenceLast4(input.transferReferenceLast4),
    note: normalizeRechargeNote(input.note),
  };
}

export function buildRechargeSubmissionRequest(input: RechargeSubmissionDraft): SubmitRechargeRequestDto {
  const normalizedProof = buildRechargeProofSubmissionRequest(input);

  return {
    amount: normalizedProof.amount,
    currencyCode: normalizedProof.currencyCode,
    paymentChannel: normalizedProof.paymentChannel,
    transferReferenceLast4: normalizedProof.transferReferenceLast4,
    note: normalizedProof.note,
  };
}

export function buildRechargeSubmissionRequestId(
  userId: string,
  action: 'submit' | 'bill' | 'proof' = 'submit',
): string {
  const normalizedUserId = String(userId || 'anonymous').trim() || 'anonymous';
  return `recharge-${action}-${normalizedUserId}-${Date.now()}`;
}

export function getRechargeSubmissionStatusLabel(
  status: RechargeSubmissionStatusDto | string | null | undefined,
): string {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  switch (normalizedStatus) {
    case 'draft':
      return '\u5f85\u521b\u5efa\u8d26\u5355';
    case 'bill_created':
    case 'awaiting_payment':
    case 'awaiting_transfer':
      return '\u5f85\u8f6c\u8d26';
    case 'proof_submitted':
    case 'pending_review':
      return '\u5f85\u5ba1\u6838';
    case 'approved':
      return '\u5ba1\u6838\u901a\u8fc7';
    case 'rejected':
      return '\u5ba1\u6838\u9a73\u56de';
    case 'credited':
      return '\u5df2\u5165\u8d26';
    case 'pending':
      return '\u7b49\u5f85\u5ba1\u6838';
    case 'paying':
      return '\u652f\u4ed8\u4e2d';
    case 'expired':
      return '\u652f\u4ed8\u5931\u8d25';
    case 'completed':
      return '\u5df2\u5b8c\u6210';
    default:
      return localizeUserFacingText(status) || String(status || '').trim() || '\u5df2\u5b8c\u6210';
  }
}

export function normalizeRechargeBillSnapshot(
  payload: RechargeProofSubmissionResponseDto | RechargeBillResponseDto | Partial<SubmitRechargeResponseDto> | null | undefined,
  seed: RechargeBillSnapshotSeed,
): RechargeBillSnapshot {
  const container: Record<string, unknown> = isRecord(payload) ? payload : {};
  const source: Record<string, unknown> = isRecord(container['bill'])
    ? container['bill'] as Record<string, unknown>
    : isRecord(container['submission'])
      ? container['submission'] as Record<string, unknown>
      : container;

  const submissionId = pickFirstString(
    source['submissionId'],
    seed.submissionId,
    source['billNumber'],
    seed.billNumber,
  ) || '--';
  const billNumber = pickFirstString(
    source['billNumber'],
    source['submissionId'],
    seed.billNumber,
    seed.submissionId,
  ) || '--';
  const amount = pickNumericValue(source['amount'], normalizeSubmissionAmount(seed.amount));
  const currencyCode = normalizeRechargeCurrency(source['currencyCode'], seed.currencyCode);
  const paymentChannel = normalizeRechargeChannel(source['paymentChannel'], seed.paymentChannel);
  const manualProvider = normalizeManualProvider(source['manualProvider']) || normalizeManualProvider(seed.manualProvider) || null;
  const baseAmount = pickNumericValue(source['baseAmount'], seed.baseAmount ?? amount);
  const serviceFee = pickNumericValue(source['serviceFee'], seed.serviceFee ?? 0);
  const payableAmount = pickNumericValue(source['payableAmount'], seed.payableAmount ?? amount);
  const baseCredits = pickEstimatedCredits(source['baseCredits'], seed.baseCredits);
  const bonusCredits = pickEstimatedCredits(source['bonusCredits'], seed.bonusCredits);
  const creditAmount = pickEstimatedCredits(source['creditAmount'], seed.creditAmount ?? seed.estimatedCredits);
  const estimatedCredits = pickEstimatedCredits(source['estimatedCredits'], seed.estimatedCredits);
  const transferReferenceLast4 = pickFirstString(source['transferReferenceLast4'], seed.transferReferenceLast4);
  const note = pickFirstString(source['note'], seed.note);
  const status = pickFirstString(source['status'], seed.status) || 'draft';
  const expiresAt = pickFirstString(source['expiresAt'], seed.expiresAt);
  const paymentMarkedAt = pickFirstString(source['paymentMarkedAt'], seed.paymentMarkedAt) ?? null;
  const qrDisplay = normalizeQrDisplay(source['qrDisplay'])
    || normalizeQrDisplay(source['staticQr'])
    || normalizeQrDisplay(seed.qrDisplay)
    || seed.qrDisplay;
  const submittedAt = pickFirstString(source['submittedAt'], seed.submittedAt);
  const snapshot: RechargeBillSnapshot = {
    submissionId,
    billNumber,
    amount,
    currencyCode,
    paymentChannel,
    estimatedCredits,
    transferReferenceLast4,
    note,
    status,
    statusLabel: getRechargeSubmissionStatusLabel(status),
    qrDisplay,
    submittedAt,
  };

  if (manualProvider) {
    snapshot.manualProvider = manualProvider;
  }
  if (typeof source['baseAmount'] !== 'undefined' || typeof seed.baseAmount !== 'undefined') {
    snapshot.baseAmount = baseAmount;
  }
  if (typeof source['serviceFee'] !== 'undefined' || typeof seed.serviceFee !== 'undefined') {
    snapshot.serviceFee = serviceFee;
  }
  if (typeof source['payableAmount'] !== 'undefined' || typeof seed.payableAmount !== 'undefined') {
    snapshot.payableAmount = payableAmount;
  }
  if (typeof source['baseCredits'] !== 'undefined' || typeof seed.baseCredits !== 'undefined') {
    snapshot.baseCredits = baseCredits;
  }
  if (typeof source['bonusCredits'] !== 'undefined' || typeof seed.bonusCredits !== 'undefined') {
    snapshot.bonusCredits = bonusCredits;
  }
  if (typeof source['creditAmount'] !== 'undefined' || typeof seed.creditAmount !== 'undefined') {
    snapshot.creditAmount = creditAmount;
  }
  if (expiresAt) {
    snapshot.expiresAt = expiresAt;
  }
  if (paymentMarkedAt) {
    snapshot.paymentMarkedAt = paymentMarkedAt;
  }

  return snapshot;
}

export function getRechargeSubmissionErrorMessage(
  response: { error?: { code?: string | null; message?: string | null } } | null | undefined,
  fallback: string,
): string {
  const errorCode = String(response?.error?.code || '').trim().toUpperCase();
  if (errorCode === 'SERVER_PERSISTENCE_REQUIRED') {
    return '\u5f53\u524d\u5145\u503c\u7533\u8bf7\u9700\u8981\u53ef\u6301\u4e45\u5316\u7684\u6b63\u5f0f\u540e\u7aef\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u68c0\u67e5\u8d26\u672c\u914d\u7f6e\u3002';
  }

  const explicitMessage = String(response?.error?.message || '').trim();
  if (explicitMessage) {
    return localizeUserFacingText(explicitMessage) || explicitMessage;
  }

  if (errorCode === 'HTTP_404') {
    return '\u5f53\u524d\u8fd0\u884c\u65f6\u5c1a\u672a\u90e8\u7f72\u5145\u503c\u63d0\u4ea4\u63a5\u53e3\uff0c\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u3002';
  }

  return fallback;
}

export async function createRechargeBill(
  input: RechargeBillDraft,
  options?: RechargeClientOptions,
): Promise<ApiResponse<RechargeBillResponseDto>> {
  const request = buildRechargeBillRequest(input);
  const requestId = options?.requestId || `recharge-bill-${Date.now()}`;

  if (typeof rechargeApiClient.createRechargeSubmission === 'function') {
    const response = await rechargeApiClient.createRechargeSubmission(
      request,
      options?.requestId ? { requestId } : undefined,
    );

    if (!response.success) {
      return response as ApiResponse<RechargeBillResponseDto>;
    }

    return {
      ...response,
      data: {
        bill: {
          submissionId: response.data.submission.submissionId,
          billNumber: response.data.submission.submissionId,
          amount: response.data.submission.amount,
          currencyCode: response.data.submission.currencyCode,
          paymentChannel: response.data.submission.paymentChannel as RechargeSubmissionChannel,
          manualProvider: response.data.submission.manualProvider ?? null,
          baseAmount: response.data.submission.baseAmount ?? response.data.submission.amount,
          serviceFee: response.data.submission.serviceFee ?? 0,
          payableAmount: response.data.submission.payableAmount ?? response.data.submission.amount,
          baseCredits: response.data.submission.baseCredits ?? response.data.submission.creditAmount,
          bonusCredits: response.data.submission.bonusCredits ?? 0,
          creditAmount: response.data.submission.creditAmount,
          estimatedCredits: response.data.submission.creditAmount,
          transferReferenceLast4: response.data.submission.transferReferenceLast4 ?? null,
          note: response.data.submission.note,
          status: response.data.submission.status,
          expiresAt: response.data.submission.expiresAt ?? null,
          paymentMarkedAt: response.data.submission.paymentMarkedAt ?? null,
          submittedAt: response.data.submission.submittedAt ?? undefined,
        },
      },
    };
  }

  return {
    success: true,
    data: {
      bill: buildLocalRechargeBill(request, requestId),
    },
    meta: buildRequestMeta(requestId),
  };
}

export async function markRechargeSubmissionPaid(
  submissionId: string,
  options?: RechargeClientOptions,
): Promise<ApiResponse<MarkRechargeSubmissionPaidResponseDto>> {
  if (typeof rechargeApiClient.markRechargeSubmissionPaid === 'function') {
    return rechargeApiClient.markRechargeSubmissionPaid(
      submissionId,
      options?.requestId ? { requestId: options.requestId } : undefined,
    );
  }

  const requestId = options?.requestId || `recharge-mark-paid-${Date.now()}`;
  return {
    success: false,
    error: {
      code: 'HTTP_404',
      message: 'Recharge paid marker endpoint is not deployed.',
    },
    meta: buildRequestMeta(requestId),
  };
}

export async function listAdminRechargeSubmissions(
  options?: RechargeClientOptions,
): Promise<ApiResponse<ListAdminRechargeSubmissionsResponseDto>> {
  if (typeof rechargeApiClient.listAdminRechargeSubmissions === 'function') {
    return rechargeApiClient.listAdminRechargeSubmissions(
      options?.requestId ? { requestId: options.requestId } : undefined,
    );
  }

  const requestId = options?.requestId || `admin-recharge-submissions-${Date.now()}`;
  return {
    success: true,
    data: {
      items: [],
    },
    meta: buildRequestMeta(requestId),
  };
}

export async function submitRechargeProof(
  input: RechargeProofSubmissionDraft,
  options?: RechargeClientOptions,
): Promise<ApiResponse<RechargeProofSubmissionResponseDto>> {
  const request = buildRechargeProofSubmissionRequest(input);
  const requestId = options?.requestId;
  const submissionId = pickFirstString(request.submissionId, request.billNumber);

  if (typeof rechargeApiClient.submitRechargeProof === 'function' && submissionId) {
    return rechargeApiClient.submitRechargeProof(
      submissionId,
      {
        transferReferenceLast4: request.transferReferenceLast4,
        note: request.note,
      },
      requestId ? { requestId } : undefined,
    );
  }

  const legacyResponse = await rechargeApiClient.submitRecharge(
    {
      amount: request.amount,
      currencyCode: request.currencyCode,
      paymentChannel: request.paymentChannel,
      transferReferenceLast4: request.transferReferenceLast4,
      note: request.note,
    },
    requestId ? { requestId } : undefined,
  );

  if (!legacyResponse.success) {
    return legacyResponse as ApiResponse<RechargeProofSubmissionResponseDto>;
  }

  return {
    ...legacyResponse,
    data: {
      submission: legacyResponse.data.submission,
    },
  };
}

export async function listRechargePaymentChannels(
  options?: RechargeClientOptions,
): Promise<ApiResponse<RechargePaymentChannelConfigListDto>> {
  if (typeof rechargeApiClient.listRechargePaymentChannels === 'function') {
    return rechargeApiClient.listRechargePaymentChannels(
      options?.requestId ? { requestId: options.requestId } : undefined,
    );
  }

  const requestId = options?.requestId || `recharge-payment-channels-${Date.now()}`;
  return {
    success: true,
    data: {
      items: buildDefaultRechargePaymentChannelConfigs(),
    },
    meta: buildRequestMeta(requestId),
  };
}

export async function submitRechargeRequest(
  input: RechargeSubmissionDraft,
  options?: RechargeClientOptions,
): Promise<ApiResponse<SubmitRechargeResponseDto>> {
  return rechargeApiClient.submitRecharge(
    buildRechargeSubmissionRequest(input),
    options?.requestId ? { requestId: options.requestId } : undefined,
  );
}
