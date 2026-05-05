import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import {
  extractGenericTaskId,
  extractTaskItemsFromPayload,
  mapGenericTaskStatus,
} from "../../src/services/llm/openAICompatibleTaskPayload.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

describe("OpenAI-compatible task payload helpers", () => {
  test("extracts generic task ids from nested payload shapes", () => {
    assert.equal(extractGenericTaskId({ taskId: "  task-1  " }), "task-1");
    assert.equal(extractGenericTaskId({ data: { task_id: "task-2" } }), "task-2");
    assert.equal(extractGenericTaskId({ result: { id: "task-3" } }), "task-3");
  });

  test("maps generic task status from mixed payload signals", () => {
    assert.equal(mapGenericTaskStatus({ data: [{ url: "https://cdn.example.com/result.png" }] }), "success");
    assert.equal(mapGenericTaskStatus({ status: "processing" }), "processing");
    assert.equal(mapGenericTaskStatus({ state: "failed" }), "failed");
    assert.equal(mapGenericTaskStatus({ taskStatus: "pending" }), "pending");
  });

  test("extracts task items from nested list payloads", () => {
    const items = extractTaskItemsFromPayload({
      data: [{ taskId: "task-1" }],
      result: { list: [{ taskId: "task-2" }] },
      items: [{ taskId: "task-3" }],
    });

    assert.deepEqual(
      items.map((item) => item.taskId),
      ["task-1", "task-3", "task-2"],
    );
  });

  test("adapter delegates task payload parsing to the helper module", () => {
    const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");
    const testConfigSource = readSource("tsconfig.tests.json");

    assert.match(adapterSource, /openAICompatibleTaskPayload/);
    assert.doesNotMatch(adapterSource, /private extractGenericTaskId/);
    assert.doesNotMatch(adapterSource, /private mapGenericTaskStatus/);
    assert.doesNotMatch(adapterSource, /private extractTaskItemsFromPayload/);
    assert.match(testConfigSource, /tests\/unit\/openai-compatible-task-payload-contract\.test\.ts/);
  });
});
