const localUserRouteStore = require('../../../lib/dispatcher/localUserRouteStore');
const providerConnectionLegacyRouteAdapter = require('../../../lib/capability-graph/providerConnectionLegacyRouteAdapter');
const { hasUnsafeBaseUrl } = require('./outboundUrlGuard');

// 守卫放在这个唯一解析出口而不是逐个调用点：profile.js 有 8 处 resolveProfileUserRoute 调用，
// 逐点加守卫极易漏掉其中之一，且新增调用点时不会自动获得保护。

/** Keeps profile-owned execution routes on new-first dual-read without reloading legacy state. */
async function resolveProfileUserRoute(userId, profileState, routeId, overrides = {}) {
  const resolveProviderConnectionRoute = overrides.resolveProviderConnectionLegacyRoute
    || providerConnectionLegacyRouteAdapter.resolveProviderConnectionLegacyRoute;
  const resolveLegacyRoute = overrides.resolveRouteFromProfileState
    || localUserRouteStore.resolveRouteFromProfileState;
  const providerConnectionRoute = await resolveProviderConnectionRoute(userId, routeId);
  const route = providerConnectionRoute || resolveLegacyRoute(profileState, routeId);

  // 不安全的出站目标一律视为「路由不存在」，避免把内部网络拓扑透给调用方。
  if (route && hasUnsafeBaseUrl(route)) {
    console.warn('[SECURITY] 拒绝解析指向私有/非法主机的用户路由', { userId, routeId });
    return null;
  }

  return route;
}

module.exports = { resolveProfileUserRoute, hasUnsafeBaseUrl };
