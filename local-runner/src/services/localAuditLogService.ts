import * as fs from 'fs';
import * as path from 'path';

// 简体中文：本地物理日志审计层，绝不上传云端 (Local Audit Logger)
export class LocalAuditLogService {
  private logPath = path.join(__dirname, '../../../.kk-local/browser-assistant-audit.log');

  constructor() {
    this.ensureLogDir();
  }

  private ensureLogDir() {
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public log(logId: string, action: string, risk: string, targetUrl: string, status: string, details?: any) {
    const record = {
      timestamp: new Date().toISOString(),
      logId,
      action,
      risk,
      targetUrl,
      status,
      details: details ? JSON.parse(JSON.stringify(details)) : {}
    };

    // 严防敏感 Cookie 写入审计日志
    if (record.details.cookies || record.details.headers?.cookie) {
      record.details.cookies = '[Redacted for safety]';
      if (record.details.headers) {
        record.details.headers.cookie = '[Redacted for safety]';
      }
    }

    try {
      fs.appendFileSync(this.logPath, JSON.stringify(record) + '\n', { encoding: 'utf8' });
      console.log(`[AuditLog] [${record.status}] Action: ${action}, Target: ${targetUrl}, Risk: ${risk}`);
    } catch (e) {
      console.error('[LocalAuditLogService] Failed to write audit log', e);
    }
  }
}

export const localAuditLogService = new LocalAuditLogService();
