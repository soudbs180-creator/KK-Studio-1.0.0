import type { KKIntent } from '../orchestration/taskIntent';
import { capabilityRegistry } from '../capability/capabilityRegistry';

export type RiskLevel = 'low' | 'medium' | 'high';

export class PermissionPolicy {
  private static instance: PermissionPolicy;

  private constructor() {}

  public static getInstance(): PermissionPolicy {
    if (!PermissionPolicy.instance) {
      PermissionPolicy.instance = new PermissionPolicy();
    }
    return PermissionPolicy.instance;
  }

  /**
   * Assess the risk level of a given intent
   */
  public async assessRisk(intent: KKIntent): Promise<RiskLevel> {
    if (intent.type === 'browser') {
      const action = intent.actionType as string;
      if (action === 'generate-image' || action === 'generate-video' || action === 'download') {
        return 'high';
      }
      if (action === 'extract' || action === 'read' || action === 'upload') {
        return 'medium';
      }
    }
    
    if (intent.type === 'generation' && intent.preferredKeyId?.startsWith('user-owned-')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Determine if the intent requires explicit user approval
   */
  public async requiresConfirmation(intent: KKIntent): Promise<boolean> {
    const risk = await this.assessRisk(intent);
    if (risk === 'high') return true;

    if (intent.type === 'browser') {
      const source = capabilityRegistry.getSource('local-opencli');
      if (source) {
        const profile = await source.getProfile();
        if (profile.requiresConfirmation) return true;
      }
    }
    
    return false;
  }
}

export const permissionPolicy = PermissionPolicy.getInstance();
