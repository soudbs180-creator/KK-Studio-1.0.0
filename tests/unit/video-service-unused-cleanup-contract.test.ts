import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('video services do not retain compiler-proven unused locals', () => {
  const openAiVideoSource = readSource('src/services/video/OpenAIVideoService.ts');
  const veoVideoSource = readSource('src/services/video/VeoVideoService.ts');
  const videoServiceSource = readSource('src/services/video/videoService.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/video-service-unused-cleanup-contract\.test\.ts/);
  assert.match(openAiVideoSource, /mapAspectRatioToSize = \(ratio: AspectRatio, _model: string\): string/);
  assert.doesNotMatch(openAiVideoSource, /mapAspectRatioToSize = \(ratio: AspectRatio, model: string\): string/);

  assert.doesNotMatch(veoVideoSource, /buildApiUrl/);
  assert.doesNotMatch(veoVideoSource, /buildHeaders/);

  assert.match(
    videoServiceSource,
    /executeVideoGeneration\(requestBody, apiKey, model, apiBase, onProgress, signal, startTime, mode\)/,
  );
  assert.doesNotMatch(videoServiceSource, /startTime, mode, modeLabel/);
  assert.doesNotMatch(videoServiceSource, /mode: VideoGenerationResult\['mode'\],\s*modeLabel: string/);
});
