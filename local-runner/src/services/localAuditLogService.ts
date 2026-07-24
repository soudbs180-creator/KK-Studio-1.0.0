import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REDACTED_VALUE = '[REDACTED]';
const SENSITIVE_KEY_PATTERN = /authorization|cookie|token|secret|password|api[-_]?key|prompt|content|input|output/i;
const BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi;
const MAX_AUDIT_DEPTH = 4;
const MAX_AUDIT_ITEMS = 50;

type AuditScalar = string | number | boolean | null;
type AuditValue = AuditScalar | AuditValue[] | { [key: string]: AuditValue };

export interface LocalAuditLogOptions {
  logPath?: string;
}

function redactString(value: string): string {
  return value.replace(BEARER_PATTERN, `Bearer ${REDACTED_VALUE}`).slice(0, 512);
}

function sanitizeAuditValue(value: unknown, depth: number, seen: WeakSet<object>): AuditValue {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (typeof value !== 'object' || depth >= MAX_AUDIT_DEPTH || seen.has(value)) {
    return '[OMITTED]';
  }

  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_AUDIT_ITEMS)
      .map((item) => sanitizeAuditValue(item, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value).slice(0, MAX_AUDIT_ITEMS).map(([key, item]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED_VALUE
        : sanitizeAuditValue(item, depth + 1, seen),
    ]),
  );
}

function sanitizeTargetUrl(targetUrl: string): string {
  try {
    const parsedUrl = new URL(targetUrl);
    parsedUrl.username = '';
    parsedUrl.password = '';
    parsedUrl.search = '';
    parsedUrl.hash = '';
    return parsedUrl.toString();
  } catch {
    return '[LOCAL_TARGET]';
  }
}

// 简体中文：本地物理日志审计层，绝不上传云端 (Local Audit Logger)
export class LocalAuditLogService {
  private readonly logPath: string;

  constructor(options: LocalAuditLogOptions = {}) {
    this.logPath = options.logPath
      ?? path.join(os.homedir(), '.kk-studio', 'local-runner', 'audit.log');
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  /** 审计记录只保留受限元数据，递归清除凭据、Prompt 和 URL query。 */
  public log(
    logId: string,
    action: string,
    risk: string,
    targetUrl: string,
    status: string,
    details?: unknown,
  ): void {
    const record = {
      timestamp: new Date().toISOString(),
      logId,
      action,
      risk,
      targetUrl: sanitizeTargetUrl(targetUrl),
      status,
      details: details ? sanitizeAuditValue(details, 0, new WeakSet()) : {},
    };

    try {
      fs.appendFileSync(this.logPath, `${JSON.stringify(record)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
      });
      fs.chmodSync(this.logPath, 0o600);
    } catch (cause) {
      console.error(
        '[LocalAuditLogService] Failed to write the local audit record.',
        cause instanceof Error ? cause.name : 'UnknownError',
      );
    }
  }
}

export const localAuditLogService = new LocalAuditLogService();
