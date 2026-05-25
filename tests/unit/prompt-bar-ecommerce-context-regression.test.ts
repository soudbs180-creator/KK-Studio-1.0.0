import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('prompt bar ecommerce ratio guards follow the active task or sheet context before correcting config aspect ratio', () => {
  const promptBarSource = readSource('src/components/layout/PromptBar.tsx');

  assert.match(
    promptBarSource,
    /resolveEcommercePromptBarAspectContext/,
  );
  assert.match(
    promptBarSource,
    /const ecommerceAspectContext = useMemo\(\(\) => resolveEcommercePromptBarAspectContext\(\{/,
  );
  assert.match(
    promptBarSource,
    /activeTask: ecommerceActiveTaskState/,
  );
  assert.match(
    promptBarSource,
    /activeSheet: ecommerceActiveGroupSheet,/,
  );
  assert.match(
    promptBarSource,
    /ratioOverride: ecommerceRatioOverride,/,
  );
  assert.match(
    promptBarSource,
    /return ecommerceAspectContext\.defaultAspectRatio;/,
  );
  assert.match(
    promptBarSource,
    /return ecommerceAspectContext\.allowedAspectRatios;/,
  );
});
