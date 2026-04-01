import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), 'utf-8');
}

test('admin console actions include a Supabase fallback for role grants', () => {
  const adminConsoleSource = readSource('src/components/settings/AdminConsoleSettings.tsx');
  const fallbackSource = readSource('src/services/admin/supabaseAdminFallbackService.ts');

  assert.match(fallbackSource, /export async function setUserRoleViaSupabase\(/);
  assert.match(fallbackSource, /supabase\.rpc\('admin_set_user_role_by_identity'/);
  assert.match(adminConsoleSource, /setUserRoleViaSupabase/);
  assert.match(adminConsoleSource, /await setUserRoleViaSupabase\(normalizedIdentity, 'admin'\);/);
  assert.doesNotMatch(
    adminConsoleSource,
    /The grant-admin action still depends on the local API service-role configuration\./,
  );
});
