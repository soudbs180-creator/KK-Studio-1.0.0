import type { BrowserTaskIntent } from '../browserAssistantTypes';

// 简体中文：前端侧 OpenCLI 安全动作策略检验
export class OpencliPermissionPolicy {
  // 禁止在提取或参数输入的字符串里夹带 shell 执行标识
  private dangerousShellRegex = /[;&|`$\\]/;

  public validateIntent(intent: BrowserTaskIntent): boolean {
    // 1. 检验 URL 的协议是否合规（仅允许 http: 或 https:）
    if (intent.targetUrl) {
      try {
        const url = new URL(intent.targetUrl);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return false;
        }
        // 禁止访问 localhost 或内网，限制安全边界
        const hostname = url.hostname.toLowerCase();
        if (
          hostname === 'localhost' ||
          hostname === '127.0.0.1' ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.endsWith('.local')
        ) {
          return false;
        }
      } catch {
        return false;
      }
    }

    // 2. 检验文本或输入参数是否存在 Shell 注入风险
    if (this.dangerousShellRegex.test(intent.userText)) {
      return false;
    }

    // 3. 禁止移动端运行
    const isMobile = typeof window !== 'undefined' && /mobile|android|iphone/i.test(navigator.userAgent);
    if (isMobile) {
      return false;
    }

    return true;
  }
}

export const opencliPermissionPolicy = new OpencliPermissionPolicy();
