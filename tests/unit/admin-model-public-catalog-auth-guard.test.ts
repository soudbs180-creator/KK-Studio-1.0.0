import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT_DIR = process.cwd();



test("admin model catalog fetch opts out of bearer auth for the public credit-model route", () => {
  const source = readSource("src/services/model/adminModelService.ts");

  assert.match(
    source,
    /kkWebApiClient\.listActiveCreditModels\(\{\s*accessToken:\s*''\s*\}\)/,
  );
});
