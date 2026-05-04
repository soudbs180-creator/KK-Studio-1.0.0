import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('NewApiManagementService keeps balance refresh behavior without compiler-proven unused locals', () => {
  const serviceSource = readSource('src/services/billing/newApiManagementService.ts');
  const testConfigSource = readSource('tsconfig.tests.json');

  assert.match(testConfigSource, /tests\/unit\/billing-service-unused-cleanup-contract\.test\.ts/);
  assert.doesNotMatch(serviceSource, /import \{ notify \} from '\.\.\/system\/notificationService';/);
  assert.doesNotMatch(serviceSource, /const channels = await this\.getAllChannels\(\);/);
  assert.match(
    serviceSource,
    /await this\.getAllChannels\(\);[\s\S]*const updatedChannels = await this\.request<Channel\[\]>\(\s*'\/api\/channel\/balance',\s*\{ method: 'GET' \}\s*\);/
  );
  assert.match(
    serviceSource,
    /this\.cache\.set\('channels', \{\s*data: updatedChannels,\s*timestamp: Date\.now\(\)\s*\}\);[\s\S]*return updatedChannels;/
  );
});
