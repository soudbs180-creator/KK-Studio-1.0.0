import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

test("task persistence keeps an in-memory per-user cache for repeated reads", () => {
  const source = readSource("src/services/persistence/taskPersistence.ts");

  assert.match(source, /let cachedUserTasks: \{ userId: string; tasks: PersistedTask\[\] \} \| null = null;/);
  assert.match(source, /if \(cachedUserTasks\?\.userId === userId\) \{\s*return cloneTasks\(cachedUserTasks\.tasks\);/);
  assert.match(source, /function setCachedTasks\(userId: string, tasks: PersistedTask\[\]\): void/);
  assert.match(source, /setCachedTasks\(userId, normalizedTasks\);/);
});
