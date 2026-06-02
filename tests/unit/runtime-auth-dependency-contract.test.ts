import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();



test("browser-side auth persistence helpers no longer read Supabase auth sessions directly", () => {
  const userApiSource = readSource("apps/web/src/services/api/userApiCloudRecordStorage.ts");
  const taskPersistenceSource = readSource("apps/web/src/services/persistence/taskPersistence.ts");
  const fileSystemSource = readSource("apps/web/src/services/storage/fileSystemService.ts");
  const runtimeProfileSource = readSource("apps/web/src/services/auth/runtimeSessionProfile.ts");

  assert.match(userApiSource, /resolveRuntimeAuthenticatedProfileContext/);
  assert.doesNotMatch(userApiSource, /supabase\.auth\./);
  assert.doesNotMatch(userApiSource, /from '..\/..\/lib\/supabase/);

  assert.match(taskPersistenceSource, /resolveRuntimeAuthenticatedProfileContext/);
  assert.doesNotMatch(taskPersistenceSource, /supabase\.auth\./);
  assert.doesNotMatch(taskPersistenceSource, /from '..\/..\/lib\/supabase/);

  assert.match(fileSystemSource, /getRuntimeOwnerId/);
  assert.doesNotMatch(fileSystemSource, /supabase\.auth\./);
  assert.doesNotMatch(fileSystemSource, /from '..\/..\/lib\/supabase/);

  assert.match(runtimeProfileSource, /getStoredKkApiAccessToken/);
  assert.match(runtimeProfileSource, /getLatestRuntimeAuthState/);
});
