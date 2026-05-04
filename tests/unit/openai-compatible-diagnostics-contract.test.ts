import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  buildSafeFormDataPreview,
  buildSafeRequestBodyPreview,
} from "../../src/services/llm/openAICompatibleDiagnostics.ts";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("OpenAI-compatible diagnostics preview redacts nested secrets and large payloads", () => {
  const longUrl = `https://cdn.example.test/${"x".repeat(160)}`;
  const longBase64 = "a".repeat(240);
  const preview = JSON.parse(buildSafeRequestBodyPreview({
    model: "gpt-image-1",
    authorization: "Bearer sk-live-secret",
    nested: {
      apiKey: "sk-nested-secret",
      image: "data:image/png;base64,Zm9v",
      longUrl,
      longBase64,
    },
  }));

  assert.equal(preview.authorization, "<omitted:sensitive>");
  assert.equal(preview.nested.apiKey, "<omitted:sensitive>");
  assert.equal(preview.nested.image, "<omitted:data-uri>");
  assert.equal(preview.nested.longUrl, "<omitted:url>");
  assert.equal(preview.nested.longBase64, "<omitted:base64>");
  assert.equal(preview.model, "gpt-image-1");
});

test("OpenAI-compatible multipart diagnostics preview redacts secret fields and keeps file metadata", () => {
  const formData = new FormData();
  formData.append("apiKey", "sk-form-secret");
  formData.append("image", new Blob(["image-bytes"], { type: "image/png" }));
  formData.append("prompt", "render a product shot");
  formData.append("prompt", "second prompt");
  formData.append("reference", "data:image/jpeg;base64,Zm9v");

  const preview = JSON.parse(buildSafeFormDataPreview(formData));

  assert.equal(preview.apiKey, "<omitted:sensitive>");
  assert.equal(preview.image.kind, "blob");
  assert.equal(preview.image.type, "image/png");
  assert.equal(preview.image.size, 11);
  assert.deepEqual(preview.prompt, ["render a product shot", "second prompt"]);
  assert.equal(preview.reference, "<omitted:data-uri>");
});

test("OpenAICompatibleAdapter delegates diagnostics preview ownership to the helper module", () => {
  const adapterSource = readSource("src/services/llm/OpenAICompatibleAdapter.ts");

  assert.match(adapterSource, /buildSafeRequestBodyPreview/);
  assert.match(adapterSource, /buildSafeFormDataPreview/);
  assert.doesNotMatch(adapterSource, /private buildSafeRequestBodyPreview\(/);
  assert.doesNotMatch(adapterSource, /private buildSafeFormDataPreview\(/);
});
