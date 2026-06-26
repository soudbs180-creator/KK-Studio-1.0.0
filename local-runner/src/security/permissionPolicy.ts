// 简体中文：本地后端执行动作的风险及授权评判 (Permission Policy)
export class PermissionPolicy {
  public evaluateRisk(kind: string): 'low' | 'medium' | 'high' {
    const mediumRiskActions = ['type', 'fill', 'upload', 'generate_external'];
    const highRiskActions = ['publish', 'delete', 'purchase', 'account-settings'];

    if (highRiskActions.includes(kind)) {
      return 'high';
    }
    if (mediumRiskActions.includes(kind)) {
      return 'medium';
    }
    return 'low';
  }

  public authorize(kind: string, headers: any): boolean {
    const risk = this.evaluateRisk(kind);
    // 高风险操作如果未带有特定的用户确认头 (如 x-user-approved-gesture)，后端强制拦截
    if (risk === 'high') {
      const userApproved = headers['x-user-approved-gesture'] === 'true';
      if (!userApproved) {
        console.error(`[PermissionPolicy] 拒绝了高风险动作 ${kind}: 缺失用户手势动作确认。`);
        return false;
      }
    }
    return true;
  }
}

export const permissionPolicy = new PermissionPolicy();
