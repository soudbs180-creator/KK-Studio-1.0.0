const { isImageProviderSliceEnabled } = require('../capability-graph/featureFlag');
const { generationV3Metrics } = require('./generationMetrics');

function createFeatureDisabledError() {
  const error = new Error('Connection-backed image generation is not available for this rollout.');
  error.code = 'FEATURE_DISABLED';
  error.statusCode = 404;
  return error;
}

/** Enforces server rollout before new Connection-backed generation side effects. */
function assertImageProviderSliceAdmission(userId, routeSnapshot, options = {}) {
  if (!routeSnapshot?.connectionId) return;
  const allowed = isImageProviderSliceEnabled(userId, options.env || process.env);
  generationV3Metrics.recordImageProviderSliceAdmission(allowed ? 'allowed' : 'blocked');
  if (!allowed) throw createFeatureDisabledError();
}

module.exports = { assertImageProviderSliceAdmission };
