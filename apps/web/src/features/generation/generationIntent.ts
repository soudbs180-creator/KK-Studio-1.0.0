import { AspectRatio, ImageSize } from '../../types.ts';

export type RouteMode =
  | 'local-runner'
  | 'browser-direct'
  | 'cloud-user-key'
  | 'cloud-platform-key'
  | 'account-bridge';

export type RouteContext = {
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
};

export type RouteDecision = {
  mode: RouteMode;
  reason: string;
  fallback?: RouteDecision;
};

export interface GenerateIntent {
  provider: string;
  taskType: 'image' | 'text' | 'video' | 'batch' | 'audio';
  prompt: string;
  modelId: string;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
}
