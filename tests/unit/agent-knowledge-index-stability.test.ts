import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
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

// 用 process.execPath 而非字面量 "node"：不依赖 node 是否在 PATH 上，
// 并保证子进程与测试运行在同一 Node 版本。
const BUILD_INDEX_ARGS = ["scripts/governance/ai-assistant/build-knowledge-index.mjs"];

function runBuildAsync() {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, BUILD_INDEX_ARGS, { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

test("knowledge index generation preserves unchanged document timestamps", () => {
  execFileSync(process.execPath, BUILD_INDEX_ARGS, { stdio: "pipe" });
  const firstRun = fs.readFileSync(PROJECT_INDEX_PATH, "utf-8");

  execFileSync(process.execPath, BUILD_INDEX_ARGS, { stdio: "pipe" });
  const secondRun = fs.readFileSync(PROJECT_INDEX_PATH, "utf-8");

  assert.equal(secondRun, firstRun);
});

test("knowledge index generation serializes concurrent writers", async () => {
  const exitCodes = await Promise.all([runBuildAsync(), runBuildAsync()]);
  assert.deepEqual(exitCodes, [0, 0]);
  assert.doesNotThrow(() => JSON.parse(fs.readFileSync(PROJECT_INDEX_PATH, "utf-8")));
});
