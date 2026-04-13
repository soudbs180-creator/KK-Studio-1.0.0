import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { createApiServer } from "../../apps/api/src/server.ts";
import { InMemoryAuthDataRepository } from "../../apps/api/src/modules/auth/infrastructure/in-memory-auth-data-repository.ts";

function getBaseUrl(server: ReturnType<typeof createApiServer>): string {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Server did not expose a TCP port.");
  }

  return `http://127.0.0.1:${address.port}`;
}

function withMutedConsoleWarn<T>(callback: () => T): T {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    return callback();
  } finally {
    console.warn = originalWarn;
  }
}

describe("temp user rate limiting", () => {
  const server = withMutedConsoleWarn(() => createApiServer(0, {
    authDataRepository: new InMemoryAuthDataRepository(),
    verifyTurnstileToken: async () => ({ success: true }),
  }));
  let baseUrl = "";

  before(async () => {
    if (server.listening) {
      baseUrl = getBaseUrl(server);
      return;
    }

    await new Promise<void>((resolve) => {
      server.once("listening", () => {
        baseUrl = getBaseUrl(server);
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  test("temp-user creation is rate limited per IP", async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/v1/auth/temp-users`, {
        method: "POST",
        headers: {
          "x-request-id": `req-temp-user-${attempt}`,
        },
      });

      assert.equal(response.status, 201);
    }

    const limitedResponse = await fetch(`${baseUrl}/api/v1/auth/temp-users`, {
      method: "POST",
      headers: {
        "x-request-id": "req-temp-user-limited",
      },
    });

    assert.equal(limitedResponse.status, 429);
    const payload = await limitedResponse.json();
    assert.equal(payload.success, false);
    assert.equal(payload.error.code, "RATE_LIMITED");
  });
});
