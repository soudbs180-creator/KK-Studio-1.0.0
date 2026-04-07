import {
  type ApiResponse,
  type ApplyPaymentSettlementRequestDto,
  type ApplyPaymentSettlementResponseDto,
} from "../../../../../../packages/contracts/src/index.ts";

export interface SettlementWriterContext {
  requestId: string;
  clientVersion?: string;
}

export interface PaymentSettlementWriter {
  write(
    input: ApplyPaymentSettlementRequestDto,
    context: SettlementWriterContext,
  ): Promise<ApplyPaymentSettlementResponseDto>;
}

export interface HttpMainApiSettlementWriterOptions {
  baseUrl: string;
  internalToken?: string;
  settlementToken?: string;
  caller?: string;
  fetchImpl?: typeof fetch;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

async function parseEnvelope(
  response: Response,
): Promise<ApiResponse<ApplyPaymentSettlementResponseDto> | undefined> {
  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(text) as ApiResponse<ApplyPaymentSettlementResponseDto>;
  } catch {
    return undefined;
  }
}

export class HttpMainApiSettlementWriter implements PaymentSettlementWriter {
  private readonly baseUrl: string;
  private readonly internalToken?: string;
  private readonly settlementToken?: string;
  private readonly caller?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpMainApiSettlementWriterOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.internalToken = options.internalToken;
    this.settlementToken = options.settlementToken;
    this.caller = options.caller;
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
  }

  async write(
    input: ApplyPaymentSettlementRequestDto,
    context: SettlementWriterContext,
  ): Promise<ApplyPaymentSettlementResponseDto> {
    const response = await this.fetchImpl(new URL("internal/v1/payment-settlements", this.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-request-id": context.requestId,
        "x-client-version": context.clientVersion || "payment-sidecar",
        "x-internal-token": this.settlementToken || this.internalToken || "",
        "x-payment-settlement-token": this.settlementToken || "",
        "x-internal-service": this.caller || "",
        "x-internal-caller": this.caller || "",
      },
      body: JSON.stringify(input),
    });

    const payload = await parseEnvelope(response);
    if (!response.ok) {
      const message = !payload
        ? `Settlement write failed with status ${response.status}.`
        : payload.success
          ? `Settlement write failed with status ${response.status}.`
          : payload.error.message;
      throw new Error(message);
    }

    if (!payload || !payload.success) {
      throw new Error("Settlement writer did not receive a success envelope from the main API.");
    }

    return payload.data;
  }
}
