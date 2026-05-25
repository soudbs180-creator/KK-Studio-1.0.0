import { readSource } from '../support/workspacePaths.js';
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  isChatEndpointCompatibilityError,
  isImageEndpointCompatibilityError,
  isQuotaLikeImageError,
} from "../../apps/web/src/services/llm/openAICompatibleImageRoutingErrors.ts";

const ROOT_DIR = process.cwd();



test("OpenAI-compatible image routing error classifiers preserve quota fail-closed behavior", () => {
  const quotaErrors: unknown[] = [
    new Error("Chat-to-image error (400): no accounts available with quota"),
    new Error("OpenAI Image Error: 400 insufficient_quota"),
    { message: "upstream quota exhausted on /images/generations" },
  ];

  for (const quotaError of quotaErrors) {
    assert.equal(isQuotaLikeImageError(quotaError), true);
    assert.equal(isChatEndpointCompatibilityError(quotaError), false);
    assert.equal(isImageEndpointCompatibilityError(quotaError), false);
  }
});

test("OpenAI-compatible image routing error classifiers preserve chat and images compatibility signals", () => {
  const chatCompatibilityMessages = [
    "Chat-to-image error (400): bad request",
    "Chat-to-image error (404): endpoint not found",
    "Chat-to-image error (405): method not allowed",
    "Chat-to-image error (422): invalid schema",
    "500 unsupported endpoint",
    "model not supported for chat image",
    "unsupported media endpoint",
    "invalid request: endpoint is not available",
    "provider endpoint unavailable",
  ];

  for (const message of chatCompatibilityMessages) {
    assert.equal(isChatEndpointCompatibilityError(new Error(message)), true, message);
  }

  assert.equal(isChatEndpointCompatibilityError(new Error("temporary network failure")), false);

  const imageCompatibilityMessages = [
    "OpenAI Image Error: 400 bad request",
    "OpenAI Image Error: 404 missing route",
    "OpenAI Image Error: 405 method not allowed",
    "OpenAI Image Error: 415 unsupported media type",
    "OpenAI Image Error: 422 invalid schema",
    "POST /images/generations is unavailable",
    "invalid request: missing prompt",
    "invalid parameter: size",
    "unrecognized request argument: response_format",
    "unknown field imageSize",
    "model not supported for images",
  ];

  for (const message of imageCompatibilityMessages) {
    assert.equal(isImageEndpointCompatibilityError(new Error(message)), true, message);
  }

  assert.equal(isImageEndpointCompatibilityError(new Error("upstream timeout")), false);
});

test("OpenAI-compatible image routing error classifiers preserve historical message-only input handling", () => {
  assert.equal(isChatEndpointCompatibilityError({ message: "Chat-to-image error (404): endpoint not found" }), true);
  assert.equal(isImageEndpointCompatibilityError({ message: "OpenAI Image Error: 400 invalid request" }), true);
  assert.equal(isQuotaLikeImageError({ message: "insufficient_quota" }), true);

  assert.equal(isChatEndpointCompatibilityError("Chat-to-image error (404): endpoint not found"), false);
  assert.equal(isImageEndpointCompatibilityError(null), false);
  assert.equal(isQuotaLikeImageError(undefined), false);
});

test("OpenAICompatibleAdapter delegates image routing error classification to helper module", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(adapterSource, /isChatEndpointCompatibilityError/);
  assert.match(adapterSource, /isImageEndpointCompatibilityError/);
  assert.doesNotMatch(adapterSource, /const isQuotaLikeError = \(/);
  assert.doesNotMatch(adapterSource, /const isChatEndpointCompatibilityError = \(/);
  assert.doesNotMatch(adapterSource, /const isImageEndpointCompatibilityError = \(/);
});
