import {
  ALLOWED_CDP_ACTIONS,
  type OpencliCommandKind,
} from '../contracts/opencli';

export { ALLOWED_CDP_ACTIONS };

/** OpenCLI 只允许协议契约声明的动作，绝不接受任意命令名称。 */
export class CommandAllowlist {
  public validateCommand(kind: OpencliCommandKind): boolean {
    return ALLOWED_CDP_ACTIONS.some((allowedAction) => allowedAction === kind);
  }
}

export const commandAllowlist = new CommandAllowlist();
