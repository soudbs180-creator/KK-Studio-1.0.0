export interface PaginationMeta {
  nextCursor?: string;
  limit: number;
  hasMore: boolean;
}

export interface RequestMeta {
  requestId: string;
  timestamp: string;
  clientVersion?: string;
  pagination?: PaginationMeta;
}

export interface ApiErrorDetail {
  field?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: RequestMeta;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
  meta: RequestMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PageQuery {
  cursor?: string;
  limit?: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  limit: number;
}

export function buildRequestMeta(
  requestId: string,
  clientVersion?: string,
  pagination?: PaginationMeta,
): RequestMeta {
  return {
    requestId,
    clientVersion,
    pagination,
    timestamp: new Date().toISOString(),
  };
}
