export interface ModelTelemetry {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
  version?: string;
}

export interface RouteTelemetry {
  routeMode: 'auto' | 'local' | 'cloud' | 'platform';
  sourceType: 'environment' | 'missing' | 'user';
  executionSide: 'local' | 'vps' | 'client';
  keySlotId?: string;
  providerRouteId?: string;
}

export interface UsageTelemetry {
  promptTokens?: number;
  completionTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  imageCount?: number;
  videoSeconds?: number;
  audioSeconds?: number;
  pageCount?: number;
  meteringUnit?: string;
}

export interface CostTelemetry {
  estimatedCredits?: number;
  chargedCredits?: number;
  refundedCredits?: number;
  estimatedAmount?: number;
  chargedAmount?: number;
  currency?: string;
  costSource?: string;
  billingTransactionId?: string;
}

export interface TimingTelemetry {
  queuedAt?: number;
  startedAt?: number;
  firstByteAt?: number;
  completedAt?: number;
  failedAt?: number;
  queueDurationMs?: number;
  generationDurationMs?: number;
  totalDurationMs?: number;
}

export interface ErrorTelemetry {
  code?: string;
  message?: string;
  retryable?: boolean;
  providerError?: any;
}

export interface RetryTelemetry {
  attempt: number;
  maxAttempts: number;
  previousJobIds?: string[];
}

export interface ResultTelemetry {
  outputType: 'image' | 'video' | 'audio' | 'ppt' | 'ecommerce' | 'browser';
  outputCount?: number;
  assetIds?: string[];
  canvasNodeIds?: string[];
  width?: number;
  height?: number;
  duration?: number;
  fileSize?: number;
  mimeType?: string;
}

export interface GenerationTelemetry {
  jobId: string;
  taskType: 'image' | 'video' | 'audio' | 'ppt' | 'ecommerce' | 'browser' | 'workflow';
  model?: ModelTelemetry;
  route?: RouteTelemetry;
  usage?: UsageTelemetry;
  cost?: CostTelemetry;
  timing?: TimingTelemetry;
  settings?: any;
  result?: ResultTelemetry;
  error?: ErrorTelemetry;
  retry?: RetryTelemetry;
}
