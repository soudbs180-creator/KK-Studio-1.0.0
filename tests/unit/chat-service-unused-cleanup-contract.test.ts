import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();



test('chat service does not retain compiler-proven unused API locals', () => {
  const chatServiceSource = readSource('src/services/chat/chatService.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/chat-service-unused-cleanup-contract\.test\.ts/);
  assert.match(chatServiceSource, /import \{ buildApiUrl, buildHeaders \} from '\.\.\/api\/apiConfig';/);
  assert.doesNotMatch(chatServiceSource, /GOOGLE_API_BASE/);
  assert.doesNotMatch(chatServiceSource, /const errorText = await response\.text\(\);/);
  assert.match(chatServiceSource, /await response\.text\(\);/);
  assert.match(chatServiceSource, /keyManager\.reportFailure\(keyData\.id, `HTTP \$\{response\.status\}`\);/);
  assert.match(chatServiceSource, /throw new Error\(`API 请求失败: \$\{response\.status\}`\);/);
});
