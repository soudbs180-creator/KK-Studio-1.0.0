export type RouteMode =
  | 'local-runner'
  | 'browser-direct'
  | 'cloud-user-key'
  | 'cloud-platform-key'
  | 'account-bridge'
  | 'local-browser-session'
  | 'user-owned-web-provider'
  | 'official-oauth-web-provider'
  | 'browser-assistant-opencli';

export interface RouteContext {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  localRunnerAvailable: boolean;
  browserDirectAvailable: boolean;
  userVpnEnabled?: boolean;
  userPreferredMode: 'auto' | 'local' | 'cloud' | 'platform';
  provider: string;
  hasLocalUserKey: boolean;
  hasCloudUserKey: boolean;
  hasPlatformCredit: boolean;
  networkStatus: 'normal' | 'blocked' | 'unknown';
  taskType: 'image' | 'text' | 'video' | 'batch' | 'audio';
}
