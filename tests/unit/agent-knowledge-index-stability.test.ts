import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT_DIR = process.cwd();
const PROJECT_INDEX_PATH = path.join(
  ROOT_DIR,
  "docs",
  "ai-assistant",
  "generated",
  "project-index.json",
);

test("knowledge index generation preserves unchanged document timestamps", () => {
  execSync("node scripts/ai-assistant/build-knowledge-index.mjs", { stdio: "pipe" });
  const firstRun = fs.readFileSync(PROJECT_INDEX_PATH, "utf-8");

  execSync("node scripts/ai-assistant/build-knowledge-index.mjs", { stdio: "pipe" });
  const secondRun = fs.readFileSync(PROJECT_INDEX_PATH, "utf-8");

  assert.equal(secondRun, firstRun);
});
