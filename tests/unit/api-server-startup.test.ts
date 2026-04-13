import assert from "node:assert/strict";
import { after, afterEach, beforeEach, test } from "node:test";
import { InMemoryAdminConsoleRepository } from "../../apps/api/src/modules/admin-console/index.ts";
import { InMemoryAuthDataRepository } from "../../apps/api/src/modules/auth/index.ts";

import { resetStartupModeLogDedupForTests, startApiServer } from "../../apps/api/src/server.ts";

const trackedServers = new Set<Awaited<ReturnType<typeof startApiServer>>>();
const originalConsoleWarn = console.warn;

async function withMutedConsoleWarnAsync<T>(callback: () => Promise<T>): Promise<T> {
  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    return await callback();
  } finally {
    console.warn = originalWarn;
  }
}

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

async function withLocalOnlyEnv<T>(callback: () => Promise<T>): Promise<T> {
  const previousValue = process.env.KKAI_LOCAL_ONLY;
  process.env.KKAI_LOCAL_ONLY = "true";
  try {
    return await callback();
  } finally {
    if (typeof previousValue === "undefined") {
      delete process.env.KKAI_LOCAL_ONLY;
    } else {
      process.env.KKAI_LOCAL_ONLY = previousValue;
    }
  }
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

beforeEach(() => {
  console.warn = () => undefined;
});

afterEach(() => {
  console.warn = originalConsoleWarn;
});

test("startApiServer resolves a listening server", async () => {
  const server = await withMutedConsoleWarnAsync(() => startApiServer(0, {
    allowDegradedPersistence: true,
    verifyTurnstileToken: async () => ({ success: true }),
  }));
  trackedServers.add(server);

  assert.equal(server.listening, true);
});

test("startApiServer rejects cleanly when the port is already in use", async () => {
  const primaryServer = await withMutedConsoleWarnAsync(() => startApiServer(0, {
    allowDegradedPersistence: true,
    verifyTurnstileToken: async () => ({ success: true }),
  }));
  trackedServers.add(primaryServer);

  const address = primaryServer.address();
  assert.ok(address && typeof address !== "string");

  await assert.rejects(
    () => withMutedConsoleWarnAsync(() => startApiServer(address.port, {
      allowDegradedPersistence: true,
      verifyTurnstileToken: async () => ({ success: true }),
    })),
    /EADDRINUSE|address already in use/,
  );
});

test("profile auth-data routes stay guarded without KKAI_LOCAL_ONLY when canonical persistence is unavailable", async () => {
  const server = await withMutedConsoleWarnAsync(() => startApiServer(0, {
    allowDegradedPersistence: false,
    authDataRepository: new InMemoryAuthDataRepository(),
    requestAuthenticator: {
      authenticate: async () => ({
        userId: "startup-user-default",
        email: "startup-user-default@example.com",
      }),
    },
    verifyTurnstileToken: async () => ({ success: true }),
  }));
  trackedServers.add(server);

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/profile/user-apis`, {
    headers: {
      authorization: "Bearer startup-user-default-token",
    },
  });
  const body = await response.json() as {
    success: boolean;
    error?: { code?: string };
  };

  assert.equal(response.status, 503);
  assert.equal(body.success, false);
  assert.equal(body.error?.code, "SERVER_PERSISTENCE_REQUIRED");
});

test("profile auth-data routes stay available in KKAI local-only mode without canonical persistence", async () => {
  await withLocalOnlyEnv(async () => {
    const server = await withMutedConsoleWarnAsync(() => startApiServer(0, {
      allowDegradedPersistence: false,
      authDataRepository: new InMemoryAuthDataRepository(),
      requestAuthenticator: {
        authenticate: async () => ({
          userId: "startup-user-local-only",
          email: "startup-user-local-only@example.com",
        }),
      },
      verifyTurnstileToken: async () => ({ success: true }),
    }));
    trackedServers.add(server);

    const address = server.address();
    assert.ok(address && typeof address !== "string");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/profile/user-apis`, {
      headers: {
        authorization: "Bearer startup-user-local-only-token",
      },
    });
    const body = await response.json() as {
      success: boolean;
      data?: { entries?: unknown[] };
    };

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.data?.entries, []);
  });
});

test("repeated degraded startup warnings are emitted once per unique startup context", async () => {
  const originalWarn = console.warn;
  const warnings: string[] = [];

  resetStartupModeLogDedupForTests();
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const firstServer = await startApiServer(0, {
      allowDegradedPersistence: true,
      verifyTurnstileToken: async () => ({ success: true }),
    });
    trackedServers.add(firstServer);

    const secondServer = await startApiServer(0, {
      allowDegradedPersistence: true,
      verifyTurnstileToken: async () => ({ success: true }),
    });
    trackedServers.add(secondServer);
  } finally {
    console.warn = originalWarn;
  }

  const fileBackedAuthFallbackCount = warnings.filter((line) =>
    line.includes("Falling back to file-backed local auth data repository"),
  ).length;
  const wechatDisabledCount = warnings.filter((line) =>
    line.includes("WeChat auth service is disabled because Supabase admin config is unavailable."),
  ).length;

  assert.equal(fileBackedAuthFallbackCount, 1);
  assert.equal(wechatDisabledCount, 1);
});

test("startApiServer local-only mode injects the fixed local user for auth-data routes", async () => {
  const server = await withMutedConsoleWarnAsync(() => startApiServer(0, {
    adminConsoleRepository: new InMemoryAdminConsoleRepository(),
    allowDegradedPersistence: true,
    authDataRepository: new InMemoryAuthDataRepository(),
    localOnlyUser: {
      userId: "local-user",
    },
    verifyTurnstileToken: async () => ({ success: true }),
  }));
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

test("startApiServer warns once when the owner admin id is missing", async () => {
  const originalPrimaryAdminUserId = process.env.KK_PRIMARY_ADMIN_USER_ID;
  delete process.env.KK_PRIMARY_ADMIN_USER_ID;
  resetStartupModeLogDedupForTests();

  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map((value) => String(value)).join(' '));
  };

  try {
    const server = await startApiServer(0, {
      allowDegradedPersistence: true,
      verifyTurnstileToken: async () => ({ success: true }),
    });
    trackedServers.add(server);
  } finally {
    console.warn = originalWarn;
    if (typeof originalPrimaryAdminUserId === "string") {
      process.env.KK_PRIMARY_ADMIN_USER_ID = originalPrimaryAdminUserId;
    }
  }

  assert.match(warnings.join("\n"), /KK_PRIMARY_ADMIN_USER_ID/);
});
