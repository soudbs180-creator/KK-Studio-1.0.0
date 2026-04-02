import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('admin console actions use the typed API path for role grants without Supabase fallback', () => {
  const adminConsoleSource = readSource('src/components/settings/AdminConsoleSettings.tsx');
  const fallbackSource = readSource('src/services/admin/supabaseAdminFallbackService.ts');

  assert.match(adminConsoleSource, /legacyWebApiClient\.setUserRole/);
  assert.doesNotMatch(adminConsoleSource, /setUserRoleViaSupabase/);
  assert.doesNotMatch(adminConsoleSource, /supabaseAdminFallbackService/);
  assert.doesNotMatch(fallbackSource, /supabase\.rpc\(/);
  assert.doesNotMatch(fallbackSource, /setUserRoleViaSupabase/);
});
