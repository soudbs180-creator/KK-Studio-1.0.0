// 简体中文：拦截任何命令夹带注入 (Command Allowlist)
export const ALLOWED_CDP_ACTIONS = [
  'open',
  'click',
  'type',
  'fill',
  'select',
  'extract',
  'screenshot',
  'network',
  'state',
  'inspect_page',
  'extract_product',
  'generate_external'
];

export class CommandAllowlist {
  private dangerousPattern = /[;&|`$\\]/;

  public validateCommand(kind: string, target?: string, payload?: Record<string, any>): boolean {
    // 1. 动作名必须在白名单内
    if (!ALLOWED_CDP_ACTIONS.includes(kind)) {
      console.error(`[CommandAllowlist] 拦截了未知动作: ${kind}`);
      return false;
    }

    // 2. 防御 Shell 命令行注入
    if (target && this.dangerousPattern.test(target)) {
      console.error(`[CommandAllowlist] 拦截了存在注入风险的 Target 字段: ${target}`);
      return false;
    }

    if (payload) {
      const payloadString = JSON.stringify(payload);
      if (this.dangerousPattern.test(payloadString)) {
        console.error(`[CommandAllowlist] 拦截了存在注入风险的 Payload 字段.`);
        return false;
      }
    }

    return true;
  }
}

export const commandAllowlist = new CommandAllowlist();
