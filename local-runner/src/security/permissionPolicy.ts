import type { IncomingHttpHeaders } from 'node:http';
import type { OpencliCommandKind } from '../contracts/opencli';

export type LocalActionRisk = 'low' | 'medium' | 'high';

// 简体中文：本地后端执行动作的风险及授权评判 (Permission Policy)
export class PermissionPolicy {
  public evaluateRisk(kind: OpencliCommandKind): LocalActionRisk {
    const mediumRiskActions: readonly OpencliCommandKind[] = [
      'type',
      'fill',
      'generate_external',
    ];

    if (mediumRiskActions.includes(kind)) {
      return 'medium';
    }
    return 'low';
  }

  public authorize(kind: OpencliCommandKind, headers: IncomingHttpHeaders): boolean {
    const risk = this.evaluateRisk(kind);
    if (risk === 'high') {
      const userApproved = headers['x-user-approved-gesture'] === 'true';
      if (!userApproved) {
        return false;
      }
    }
    return true;
  }
}

export const permissionPolicy = new PermissionPolicy();
