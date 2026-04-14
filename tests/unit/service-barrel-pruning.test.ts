import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("service barrel stops re-exporting the legacy ai12ApiService entrypoint once routing goes through modelCaller and llm services", () => {
  const servicesIndexSource = readSource("src/services/index.ts");
  const modelCallerSource = readSource("src/services/model/modelCaller.ts");

  assert.doesNotMatch(servicesIndexSource, /ai12ApiService/);
  assert.doesNotMatch(modelCallerSource, /AI12APIService/);
  assert.match(modelCallerSource, /from '\.\.\/llm\/LLMAdapter'/);
});
