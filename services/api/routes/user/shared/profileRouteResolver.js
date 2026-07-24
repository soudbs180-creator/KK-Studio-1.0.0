const localUserRouteStore = require('../../../lib/dispatcher/localUserRouteStore');
const providerConnectionLegacyRouteAdapter = require('../../../lib/capability-graph/providerConnectionLegacyRouteAdapter');

/** Keeps profile-owned execution routes on new-first dual-read without reloading legacy state. */
async function resolveProfileUserRoute(userId, profileState, routeId, overrides = {}) {
  const resolveProviderConnectionRoute = overrides.resolveProviderConnectionLegacyRoute
    || providerConnectionLegacyRouteAdapter.resolveProviderConnectionLegacyRoute;
  const resolveLegacyRoute = overrides.resolveRouteFromProfileState
    || localUserRouteStore.resolveRouteFromProfileState;
  const providerConnectionRoute = await resolveProviderConnectionRoute(userId, routeId);
  return providerConnectionRoute || resolveLegacyRoute(profileState, routeId);
}

module.exports = { resolveProfileUserRoute };
