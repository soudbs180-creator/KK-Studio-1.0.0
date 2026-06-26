export type CapabilitySourceType =
  | 'api-user-local'
  | 'api-user-cloud'
  | 'api-platform'
  | 'official-oauth-openai'
  | 'user-owned-web-provider'
  | 'local-opencli'
  | 'local-model'
  | 'cloud-vps';

export interface CapabilityProfile {
  type: CapabilitySourceType;
  name: string;
  isAvailable: boolean;
  requiresAuth: boolean;
  requiresConfirmation: boolean;
  supportedTasks: Array<'image' | 'text' | 'video' | 'batch' | 'audio' | 'browser-action'>;
  riskLevel: 'low' | 'medium' | 'high';
}

export abstract class CapabilitySource {
  public abstract getType(): CapabilitySourceType;
  public abstract getName(): string;
  
  /**
   * Check if this capability source is currently active/available in the system
   */
  public abstract isAvailable(): Promise<boolean>;

  /**
   * Get the capabilities metadata
   */
  public abstract getProfile(): Promise<CapabilityProfile>;
}
