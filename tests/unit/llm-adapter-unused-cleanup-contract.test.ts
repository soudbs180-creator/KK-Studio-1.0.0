import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('small LLM adapters do not retain compiler-proven unused locals', () => {
  const audioAdapterSource = readSource('src/services/llm/AudioCompatibleAdapter.ts');
  const volcengineAdapterSource = readSource('src/services/llm/VolcengineAdapter.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/llm-adapter-unused-cleanup-contract\.test\.ts/);
  assert.doesNotMatch(audioAdapterSource, /getAudioCapability/);
  assert.doesNotMatch(audioAdapterSource, /isAudioModel/);
  assert.doesNotMatch(audioAdapterSource, /const audioCaps =/);
  assert.match(audioAdapterSource, /const maxDuration = getMaxAudioDuration\(options\.modelId\);/);

  assert.match(volcengineAdapterSource, /supports\(_modelId: string\): boolean/);
  assert.doesNotMatch(volcengineAdapterSource, /supports\(modelId: string\): boolean/);
});
