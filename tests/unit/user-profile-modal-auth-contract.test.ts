import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("UserProfileModal routes profile and password changes through KK API instead of direct Supabase auth calls", () => {
  const source = readSource("src/components/modals/UserProfileModal.tsx");

  assert.match(source, /kkWebApiClient\.updateProfile\(/);
  assert.match(source, /kkWebApiClient\.sendPasswordChangeCode\(/);
  assert.match(source, /kkWebApiClient\.updatePassword\(/);
  assert.doesNotMatch(source, /supabase\.auth\.getSession\(/);
  assert.doesNotMatch(source, /supabase\.auth\.updateUser\(/);
});
