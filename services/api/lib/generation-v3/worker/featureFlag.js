const ROLLOUT_SCOPES = new Set(['off', 'internal', 'invited', 'full']);

function readImageDurableWorkerScope(env) {
  const rawScope = String(env.GENERATION_IMAGE_DURABLE_WORKER_ENABLED || 'off').trim().toLowerCase();
  if (rawScope === 'true') return 'full';
  if (rawScope === 'false') return 'off';
  return ROLLOUT_SCOPES.has(rawScope) ? rawScope : 'off';
}

function readUserIds(value = '') {
  return new Set(String(value).split(',').map((userId) => userId.trim()).filter(Boolean));
}

function hasImageDurableWorkerRollout(env = process.env) {
  return readImageDurableWorkerScope(env) !== 'off';
}

/** Reports whether migration-ready Worker execution may process existing leases. */
function isImageWorkerExecutionEnabled(env = process.env) {
  return String(env.GENERATION_IMAGE_WORKER_EXECUTION_ENABLED || '').trim().toLowerCase() === 'true';
}

function isImageDurableWorkerEnabled(userId, env = process.env) {
  const scope = readImageDurableWorkerScope(env);
  if (!userId || scope === 'off') return false;
  if (scope === 'full') return true;
  const internalUsers = readUserIds(env.GENERATION_IMAGE_WORKER_INTERNAL_USER_IDS);
  if (internalUsers.has(userId)) return true;
  if (scope === 'internal') return false;
  return readUserIds(env.GENERATION_IMAGE_WORKER_INVITED_USER_IDS).has(userId);
}

module.exports = {
  hasImageDurableWorkerRollout,
  isImageDurableWorkerEnabled,
  isImageWorkerExecutionEnabled,
  readImageDurableWorkerScope,
};
