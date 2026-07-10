import type { RouteMode } from '../routing/RouteContext.ts';

export interface BrowserMembershipSetupError extends Error {
  code: 'SETUP_REQUIRED';
  setupAction: 'browser-assistant';
  routeMode: RouteMode;
}

export const isBrowserMembershipRoute = (mode: RouteMode): boolean =>
  mode === 'user-owned-web-provider' || mode === 'browser-assistant-opencli';

export const createBrowserMembershipSetupError = (
  routeMode: RouteMode
): BrowserMembershipSetupError => {
  const error = new Error(
    '网页会员生成需要通过 Browser Assistant 发起，并在连接本地守护进程和 Chrome Bridge 后由您确认执行。'
  ) as BrowserMembershipSetupError;

  error.name = 'BrowserMembershipSetupError';
  error.code = 'SETUP_REQUIRED';
  error.setupAction = 'browser-assistant';
  error.routeMode = routeMode;
  return error;
};
