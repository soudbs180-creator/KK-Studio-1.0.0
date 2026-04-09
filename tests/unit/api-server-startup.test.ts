import assert from "node:assert/strict";
import { InMemoryAdminConsoleRepository } from "../../apps/api/src/modules/admin-console/index.ts";
import { InMemoryAuthDataRepository } from "../../apps/api/src/modules/auth/index.ts";
import { after, test } from "node:test";

import { startApiServer } from "../../apps/api/src/server.ts";

const trackedServers = new Set<Awaited<ReturnType<typeof startApiServer>>>();

async function closeServer(server: Awaited<ReturnType<typeof startApiServer>>) {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getBaseUrl(server: Awaited<ReturnType<typeof startApiServer>>): string {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

after(async () => {
  for (const server of trackedServers) {
    await closeServer(server);
  }
  trackedServers.clear();
});

test("startApiServer resolves a listening server", async () => {
  const server = await startApiServer(0, {
    allowDegradedPersistence: true,
    verifyTurnstileToken: async () => ({ success: true }),
  });
  trackedServers.add(server);

  assert.equal(server.listening, true);
});

test("startApiServer rejects cleanly when the port is already in use", async () => {
  const primaryServer = await startApiServer(0, {
    allowDegradedPersistence: true,
    verifyTurnstileToken: async () => ({ success: true }),
  });
  trackedServers.add(primaryServer);

  const address = primaryServer.address();
  assert.ok(address && typeof address !== "string");

  await assert.rejects(
    () => startApiServer(address.port, {
      allowDegradedPersistence: true,
      verifyTurnstileToken: async () => ({ success: true }),
    }),
    /EADDRINUSE|address already in use/,
  );
});

test("startApiServer local-only mode injects the fixed local user for auth-data routes", async () => {
  const server = await startApiServer(0, {
    adminConsoleRepository: new InMemoryAdminConsoleRepository(),
    allowDegradedPersistence: true,
    authDataRepository: new InMemoryAuthDataRepository(),
    localOnlyUser: {
      userId: "local-user",
    },
    verifyTurnstileToken: async () => ({ success: true }),
  });
  trackedServers.add(server);

  const response = await fetch(`${getBaseUrl(server)}/api/v1/profile/key-manager-state`, {
    headers: {
      "x-request-id": "req-local-only-auth-data",
    },
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  if (!payload.success) {
    return;
  }

  assert.equal(payload.data.version, 2);
  assert.deepEqual(payload.data.slots, []);
  assert.deepEqual(payload.data.providers, []);
  assert.deepEqual(payload.data.entries, []);
});
