import { readSource } from '../support/workspacePaths.js';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

type CredentialSanitizerModule = {
  sanitizeAsciiApiKey: (key: string) => string;
};



async function loadCredentialSanitizer(): Promise<CredentialSanitizerModule> {
  const fullPath = path.join(ROOT_DIR, 'apps/web/src/services/auth/keyManagerCredentialSanitizer.ts');
  assert.equal(existsSync(fullPath), true, 'apps/web/src/services/auth/keyManagerCredentialSanitizer.ts must exist');
  return await import('../../apps/web/src/services/auth/keyManagerCredentialSanitizer.ts') as CredentialSanitizerModule;
}

test('credential sanitizer lives outside the monolithic key manager', () => {
  const keyManagerSource = readSource('apps/web/src/services/auth/keyManager.ts');
  const helperSource = readSource('apps/web/src/services/auth/keyManagerCredentialSanitizer.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/key-manager-credential-sanitizer-contract\.test\.ts/);
  assert.match(helperSource, /export function sanitizeAsciiApiKey/);
  assert.match(keyManagerSource, /from '\.\/keyManagerCredentialSanitizer(?:\.ts)?';/);
  assert.doesNotMatch(keyManagerSource, /replace\(\s*\/\[\^\\x00-\\x7F\]\/g,\s*["']["']\s*\)\.trim\(\)/);
  assert.match(keyManagerSource, /const cleanKey = sanitizeAsciiApiKey\(key\);/);
  assert.match(keyManagerSource, /const trimmedKey = sanitizeAsciiApiKey\(key\);/);
});

test('credential sanitizer preserves existing ASCII trim behavior', async () => {
  const { sanitizeAsciiApiKey } = await loadCredentialSanitizer();

  assert.equal(sanitizeAsciiApiKey('  sk-test  '), 'sk-test');
  assert.equal(sanitizeAsciiApiKey('密sk-汉字test🔑'), 'sk-test');
  assert.equal(sanitizeAsciiApiKey('\tAIzaSy-test\n'), 'AIzaSy-test');
  assert.equal(sanitizeAsciiApiKey('密钥'), '');
});
