import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolveKkApiBaseUrl,
  resolveKkApiModelProxyBaseUrl,
} from "../../apps/web/src/services/api/kkApiClient.ts";

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

test("hosted kkai.plus runtime routes temporary HTTPS VPS API origins through same-origin proxy", () => {
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

test("hosted model proxy calls temporary HTTPS VPS API origins directly to avoid serverless timeouts", () => {
  const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
  const locationLike = globalThis as { location?: { origin?: string } };
  const originalLocation = locationLike.location;

  process.env.VITE_KK_API_BASE_URL = "https://172-245-156-16.sslip.io";
  locationLike.location = { origin: "https://kkai.plus" };

  try {
    assert.equal(resolveKkApiBaseUrl(), "https://kkai.plus");
    assert.equal(resolveKkApiModelProxyBaseUrl(), "https://172-245-156-16.sslip.io");
  } finally {
    if (typeof originalBaseUrl === "string") {
      process.env.VITE_KK_API_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.VITE_KK_API_BASE_URL;
    }
    locationLike.location = originalLocation;
  }
});

test("hosted model proxy uses the direct VPS API default when the public runtime has no API base override", () => {
  const originalBaseUrl = process.env.VITE_KK_API_BASE_URL;
  const locationLike = globalThis as { location?: { origin?: string } };
  const originalLocation = locationLike.location;

  delete process.env.VITE_KK_API_BASE_URL;
  locationLike.location = { origin: "https://kkai.plus" };

  try {
    assert.equal(resolveKkApiBaseUrl(), "https://kkai.plus");
    assert.equal(resolveKkApiModelProxyBaseUrl(), "https://172-245-156-16.sslip.io");
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
