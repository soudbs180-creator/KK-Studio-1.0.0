import { AspectRatio, ImageSize } from '../../types.ts';

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

export { type RouteContext } from '../../core/routing/RouteContext';
export { type RouteDecision } from '../../core/routing/RouteDecision';

export interface GenerateIntent {
  provider: string;
  taskType: 'image' | 'text' | 'video' | 'batch' | 'audio';
  prompt: string;
  modelId: string;
  aspectRatio?: AspectRatio;
  imageSize?: ImageSize;
}
