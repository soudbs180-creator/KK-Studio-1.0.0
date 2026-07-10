import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldIgnoreWatchPath } from '../../apps/web/viteWatchPolicy.ts';

test('Vite keeps source folders named like workspace data under live watch', () => {
  assert.equal(
    shouldIgnoreWatchPath('D:/KKAI/nano-banana-KK-/apps/web/src/components/settings/views/GenerationModeView.tsx'),
    false
  );
  assert.equal(
    shouldIgnoreWatchPath('D:/KKAI/nano-banana-KK-/apps/web/src/assets/images/brand.ts'),
    false
  );
});

test('Vite still ignores generated workspace data and project snapshots', () => {
  assert.equal(
    shouldIgnoreWatchPath('D:/KKAI/nano-banana-KK-/apps/web/public/settings/providers.json'),
    true
  );
  assert.equal(
    shouldIgnoreWatchPath('D:/KKAI/nano-banana-KK-/picture/generated.png'),
    true
  );
  assert.equal(
    shouldIgnoreWatchPath('D:/KKAI/nano-banana-KK-/workspace/project.json'),
    true
  );
});
