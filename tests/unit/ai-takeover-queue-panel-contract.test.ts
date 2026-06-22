import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readSource } from '../support/workspacePaths.js';

test('chat sidebar surfaces DurableGenerationQueue jobs in the real AI takeover panel', () => {
  const source = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(source, /durableGenerationQueue,\s*type GenerationBatchJob/);
  assert.match(source, /useState<GenerationBatchJob\[\]>\(\(\) => durableGenerationQueue\.getJobs\(\)\)/);
  assert.match(source, /durableGenerationQueue\.subscribe\(setDurableQueueJobs\)/);
  assert.match(source, /activeDurableJobs = useMemo/);
  assert.match(source, /ai-takeover-durable-queue-panel/);
  assert.match(source, /ai-takeover-durable-queue__job/);
});

test('chat sidebar durable queue panel exposes pause resume cancel and locate actions', () => {
  const source = readSource('apps/web/src/components/layout/ChatSidebar.tsx');

  assert.match(source, /data-action="pause-durable-job"[\s\S]{0,400}durableGenerationQueue\.pauseJob\(job\.id\)/);
  assert.match(source, /data-action="resume-durable-job"[\s\S]{0,400}durableGenerationQueue\.resumeJob\(job\.id\)/);
  assert.match(source, /data-action="retry-durable-job"[\s\S]{0,400}durableGenerationQueue\.retryFailedPrompts\(job\.id\)/);
  assert.match(source, /data-action="cancel-durable-job"[\s\S]{0,400}durableGenerationQueue\.cancelJob\(job\.id\)/);
  assert.match(source, /data-action="locate-durable-job"[\s\S]{0,360}handleLocateDurableJob\(job\)/);
  assert.match(source, /durableGenerationQueue\.archiveFinishedJobs\(\)/);
  assert.match(source, /new CustomEvent\('canvas-center-on-node'/);
});
