import assert from "node:assert/strict";
import { test } from "node:test";

import { readSource } from "../support/workspacePaths.js";

test("server CORS keeps production exact while allowing private LAN phone browser development", () => {
  const source = readSource("server/index.js");

  assert.match(source, /hostname === 'localhost' \|\| hostname === '::1' \|\| hostname\.startsWith\('127\.'\)/);
  assert.match(source, /\^192\\\.168\\\./);
  assert.match(source, /\^10\\\./);
  assert.match(source, /process\.env\.NODE_ENV !== 'production' && isPrivateNetwork/);
  assert.doesNotMatch(source, /Access-Control-Allow-Origin', '\*'/);
});
