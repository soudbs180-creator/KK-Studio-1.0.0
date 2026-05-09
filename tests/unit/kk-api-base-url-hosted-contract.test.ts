import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveKkApiBaseUrl } from "../../src/services/api/kkApiClient.ts";

test("hosted HTTPS runtimes use same-origin API rewrites when build env points at an HTTP VPS", () => {
  const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
  const locationLike = globalThis as { location?: { origin?: string } };
  const originalLocation = locationLike.location;

  process.env.VITE_KK_API_BASE_URL = "http://172.245.156.16";
  locationLike.location = { origin: "https://kkai.plus" };

  try {
    assert.equal(resolveKkApiBaseUrl(), "https://kkai.plus");
  } finally {
    if (typeof originalBaseUrl === "string") {
      process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.VITE_KK_API_BASE_URL;
    }
    locationLike.location = originalLocation;
  }
});

test("hosted kkai.plus runtime keeps sslip VPS upstream behind the same-origin proxy", () => {
  const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
  const locationLike = globalThis as { location?: { origin?: string } };
  const originalLocation = locationLike.location;

  process.env.VITE_KK_API_BASE_URL = "https://172-245-156-16.sslip.io";
  locationLike.location = { origin: "https://kkai.plus" };

  try {
    assert.equal(resolveKkApiBaseUrl(), "https://kkai.plus");
  } finally {
    if (typeof originalBaseUrl === "string") {
      process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.VITE_KK_API_BASE_URL;
    }
    locationLike.location = originalLocation;
  }
});

test("hosted API base URL strips accidental /api path prefixes before client path joining", () => {
  const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
  const locationLike = globalThis as { location?: { origin?: string } };
  const originalLocation = locationLike.location;

  process.env.VITE_KK_API_BASE_URL = "https://kkai.plus/api/v1";
  locationLike.location = { origin: "https://kkai.plus" };

  try {
    assert.equal(resolveKkApiBaseUrl(), "https://kkai.plus");
  } finally {
    if (typeof originalBaseUrl === "string") {
      process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.VITE_KK_API_BASE_URL;
    }
    locationLike.location = originalLocation;
  }
});
