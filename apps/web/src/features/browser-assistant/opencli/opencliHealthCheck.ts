// 简体中文：探查本地 local-runner 服务的健康状态
export class OpencliHealthCheck {
  private localPort = 9099;

  public async check(): Promise<{ ok: boolean; latencyMs?: number; version?: string }> {
    const start = Date.now();
    try {
      const response = await fetch(`http://localhost:${this.localPort}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        return {
          ok: true,
          latencyMs: Date.now() - start,
          version: data.version || '1.0.0'
        };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }
}

export const opencliHealthCheck = new OpencliHealthCheck();
