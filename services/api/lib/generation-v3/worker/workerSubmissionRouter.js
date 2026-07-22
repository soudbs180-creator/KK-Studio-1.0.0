const { isImageDurableWorkerEnabled } = require('./featureFlag');
const { imageWorkerMetrics } = require('./workerMetrics');

/** Selects durable image enqueue or the existing synchronous submit path without changing HTTP contracts. */
async function submitJobWithWorkerRollout(options) {
  const {
    env = process.env,
    generation,
    jobId,
    metrics = imageWorkerMetrics,
    userId,
  } = options;
  if (!isImageDurableWorkerEnabled(userId, env)) {
    metrics.recordSubmissionRoute('legacy');
    return generation.submitJob(userId, jobId);
  }
  const queuedJob = await generation.enqueueImageJob(jobId, userId);
  if (queuedJob) {
    metrics.recordSubmissionRoute('durable');
    return queuedJob;
  }
  metrics.recordSubmissionRoute('durableFallback');
  return generation.submitJob(userId, jobId);
}

module.exports = { submitJobWithWorkerRollout };
