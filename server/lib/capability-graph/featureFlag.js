const ROLLOUT_SCOPES = new Set(['off', 'internal', 'invited', 'full']);

function parseUserIds(rawValue = '') {
  return new Set(rawValue.split(',').map((value) => value.trim()).filter(Boolean));
}

/**
 * The rollout is evaluated on the server so clients cannot enable a gated capability.
 */
function isImageProviderSliceEnabled(userId, env = process.env) {
  const scope = String(env.CAPABILITY_GRAPH_IMAGE_PROVIDER_SLICE || 'off').trim().toLowerCase();
  if (!userId || !ROLLOUT_SCOPES.has(scope) || scope === 'off') return false;
  if (scope === 'full') return true;

  const internalUsers = parseUserIds(env.CAPABILITY_GRAPH_INTERNAL_USER_IDS);
  if (internalUsers.has(userId)) return true;
  if (scope === 'internal') return false;

  return parseUserIds(env.CAPABILITY_GRAPH_INVITED_USER_IDS).has(userId);
}

module.exports = { isImageProviderSliceEnabled };
