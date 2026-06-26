import type { OcliCommand } from './opencliCommandBuilder';

// 简体中文：与本地守护服务 local-runner 进行接口通信的 HTTP/WS 客户端
export class OpencliClient {
  private localUrl = 'http://localhost:9099';

  private getLocalToken(): string {
    // 优先从 localStorage 读取临时的 local-runner-token，如果没有则默认为空
    return localStorage.getItem('kk_local_runner_token') || 'local_handshake_token_default';
  }

  public async execute(command: {
    kind: string;
    target: string;
    payload?: Record<string, any>;
  }): Promise<any> {
    const token = this.getLocalToken();
    try {
      const response = await fetch(`${this.localUrl}/api/opencli/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(command)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Local Runner 响应错误: ${errText}`);
      }

      return await response.json();
    } catch (e: any) {
      console.error('[OpencliClient] Failed to execute command', e);
      throw e;
    }
  }

  public async getSessions(): Promise<any[]> {
    const token = this.getLocalToken();
    try {
      const response = await fetch(`${this.localUrl}/api/browser/sessions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch {
      return [];
    }
  }
}

export const opencliClient = new OpencliClient();
