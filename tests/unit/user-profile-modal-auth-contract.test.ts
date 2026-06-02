import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("UserProfileModal routes profile and password changes through KK API instead of direct Supabase auth calls", () => {
  const source = readSource("apps/web/src/components/modals/UserProfileModal.tsx");

  assert.match(source, /kkWebApiClient\.updateProfile\(/);
  assert.match(source, /kkWebApiClient\.sendPasswordChangeCode\(/);
  assert.match(source, /kkWebApiClient\.updatePassword\(/);
  assert.match(source, /newPassword\.length < 8/);
  assert.match(source, /新密码至少需要 8 位。/);
  assert.doesNotMatch(source, /supabase\.auth\.getSession\(/);
  assert.doesNotMatch(source, /supabase\.auth\.updateUser\(/);
});
