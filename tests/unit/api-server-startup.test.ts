import assert from "node:assert/strict";
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
