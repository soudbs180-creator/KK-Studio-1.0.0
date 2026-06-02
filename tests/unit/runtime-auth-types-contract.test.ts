import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("runtime auth UI/state surfaces use local runtime auth types instead of Supabase types", () => {
  const runtimeStateSource = readSource("apps/web/src/services/auth/runtimeAuthState.ts");
  const authContextSource = readSource("apps/web/src/context/AuthContext.tsx");
  const runtimeContextSource = readSource("apps/web/src/context/kkaiRuntimeContext.ts");
  const tempUserSource = readSource("apps/web/src/services/auth/tempUserService.ts");
  const sidebarSource = readSource("apps/web/src/components/layout/Sidebar.tsx");
  const profileModalSource = readSource("apps/web/src/components/modals/UserProfileModal.tsx");

  assert.doesNotMatch(runtimeStateSource, /@supabase\/supabase-js/);
  assert.match(runtimeStateSource, /RuntimeAuthUser/);

  assert.doesNotMatch(authContextSource, /@supabase\/supabase-js/);
  assert.match(authContextSource, /RuntimeAuthSession/);
  assert.match(authContextSource, /RuntimeAuthUser/);

  assert.doesNotMatch(runtimeContextSource, /@supabase\/supabase-js/);
  assert.match(runtimeContextSource, /RuntimeAuthSession/);
  assert.match(runtimeContextSource, /RuntimeAuthUser/);

  assert.doesNotMatch(tempUserSource, /@supabase\/supabase-js/);
  assert.match(tempUserSource, /RuntimeAuthUser/);

  assert.doesNotMatch(sidebarSource, /@supabase\/supabase-js/);
  assert.match(sidebarSource, /RuntimeAuthUser/);

  assert.doesNotMatch(profileModalSource, /@supabase\/supabase-js/);
  assert.match(profileModalSource, /RuntimeAuthUser/);
});
