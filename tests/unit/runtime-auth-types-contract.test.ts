import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("runtime auth UI/state surfaces use local runtime auth types instead of Supabase types", () => {
  const runtimeStateSource = readSource("src/services/auth/runtimeAuthState.ts");
  const authContextSource = readSource("src/context/AuthContext.tsx");
  const runtimeContextSource = readSource("src/context/kkaiRuntimeContext.ts");
  const tempUserSource = readSource("src/services/auth/tempUserService.ts");
  const sidebarSource = readSource("src/components/layout/Sidebar.tsx");
  const profileModalSource = readSource("src/components/modals/UserProfileModal.tsx");

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
