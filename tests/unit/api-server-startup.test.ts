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

async function withHostedRuntimeEnv<T>(callback: () => Promise<T>): Promise<T> {
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    return await callback();
  } finally {
    if (typeof previousVercel === "undefined") {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = previousVercel;
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

test("startApiServer handles browser CORS preflight for local web login", async () => {
  const server = await withMutedConsoleWarnAsync(() => startApiServer(0, {
    allowDegradedPersistence: true,
    authDataRepository: new InMemoryAuthDataRepository(),
    verifyTurnstileToken: async () => ({ success: true }),
  }));
  trackedServers.add(server);

  const response = await fetch(`${getBaseUrl(server)}/api/v1/auth/login`, {
    method: "OPTIONS",
    headers: {
      "access-control-request-headers": "content-type,x-client-version",
      "access-control-request-method": "POST",
      origin: "http://localhost:5173",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.match(response.headers.get("access-control-allow-methods") || "", /\bPOST\b/);
  assert.match(response.headers.get("access-control-allow-headers") || "", /\bcontent-type\b/);
  assert.match(response.headers.get("access-control-allow-headers") || "", /\bx-client-version\b/);
});

test("model proxy routes accept image payloads larger than the default JSON body limit", async () => {
  const server = await withMutedConsoleWarnAsync(() => startApiServer(0, {
    allowDegradedPersistence: true,
    authDataRepository: new InMemoryAuthDataRepository(),
    requestAuthenticator: {
      authenticate: async () => ({
        userId: "startup-model-proxy-user",
        email: "startup-model-proxy-user@example.com",
      }),
    },
    verifyTurnstileToken: async () => ({ success: true }),
  }));
  trackedServers.add(server);

  const baseUrl = getBaseUrl(server);
  const oversizedPrompt = "x".repeat(1_200_000);

  const systemResponse = await fetch(`${baseUrl}/api/v1/model-proxy/system`, {
    method: "POST",
    headers: {
      authorization: "Bearer startup-model-proxy-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mode: "image",
      prompt: oversizedPrompt,
    }),
  });
  const systemBody = await systemResponse.json() as {
    success: boolean;
    error?: { code?: string };
  };
  assert.notEqual(systemResponse.status, 413);
  assert.equal(systemBody.success, false);
  assert.equal(systemBody.error?.code, "INVALID_REQUEST");

  const userResponse = await fetch(`${baseUrl}/api/v1/model-proxy/user`, {
    method: "POST",
    headers: {
      authorization: "Bearer startup-model-proxy-token",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mode: "image",
      prompt: oversizedPrompt,
    }),
  });
  const userBody = await userResponse.json() as {
    success: boolean;
    error?: { code?: string };
  };
  assert.notEqual(userResponse.status, 413);
  assert.equal(userBody.success, false);
  assert.equal(userBody.error?.code, "INVALID_REQUEST");
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

test("hosted runtime can still start in degraded test mode without Supabase canonical persistence", async () => {
  await withHostedRuntimeEnv(async () => {
    const server = await withMutedConsoleWarnAsync(() => startApiServer(0, {
      allowDegradedPersistence: true,
      verifyTurnstileToken: async () => ({ success: true }),
    }));
    trackedServers.add(server);

    assert.equal(server.listening, true);
  });
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

test("local-only mode keeps guest sessions, workspace layout, and active credit models available without canonical persistence", async () => {
  await withLocalOnlyEnv(async () => {
    const server = await withMutedConsoleWarnAsync(() => startApiServer(0, {
      allowDegradedPersistence: false,
      requestAuthenticator: {
        authenticate: async (headers) => (
          headers.authorization
            ? {
              userId: "startup-user-local-runtime",
              email: "startup-user-local-runtime@example.com",
            }
            : undefined
        ),
      },
      verifyTurnstileToken: async () => ({ success: true }),
    }));
    trackedServers.add(server);

    const baseUrl = getBaseUrl(server);

    const healthResponse = await fetch(`${baseUrl}/healthz`);
    assert.equal(healthResponse.status, 200);
    const healthPayload = await healthResponse.json() as {
      success: boolean;
      data?: {
        selfHostedCoreReady?: boolean;
        persistence?: {
          authSessions?: boolean;
          tempUsers?: boolean;
          workspaceLayout?: boolean;
          creditProviders?: boolean;
          credits?: boolean;
        };
      };
    };
    assert.equal(healthPayload.success, true);
    assert.equal(healthPayload.data?.selfHostedCoreReady, true);
    assert.equal(healthPayload.data?.persistence?.authSessions, true);
    assert.equal(healthPayload.data?.persistence?.tempUsers, true);
    assert.equal(healthPayload.data?.persistence?.workspaceLayout, true);
    assert.equal(healthPayload.data?.persistence?.creditProviders, true);
    assert.equal(healthPayload.data?.persistence?.credits, true);

    const tempUserResponse = await fetch(`${baseUrl}/api/v1/auth/temp-users`, {
      method: "POST",
      headers: {
        "x-request-id": "req-local-only-temp-user",
      },
    });
    assert.equal(tempUserResponse.status, 201);
    const tempUserPayload = await tempUserResponse.json() as {
      success: boolean;
      data?: {
        userId?: string;
      };
    };
    assert.equal(tempUserPayload.success, true);
    assert.ok(tempUserPayload.data?.userId);

    const saveLayoutResponse = await fetch(`${baseUrl}/api/v1/workspaces/layout`, {
      method: "PUT",
      headers: {
        authorization: "Bearer startup-user-local-runtime-token",
        "content-type": "application/json",
        "x-request-id": "req-local-only-layout-save",
      },
      body: JSON.stringify({
        canvases: [
          {
            id: "canvas-local-only",
            name: "Local only workspace",
            promptNodes: [],
            imageNodes: [],
            groups: [],
            drawings: [],
            lastModified: Date.now(),
          },
        ],
      }),
    });
    assert.equal(saveLayoutResponse.status, 200);
    const saveLayoutPayload = await saveLayoutResponse.json() as {
      success: boolean;
    };
    assert.equal(saveLayoutPayload.success, true);

    const getLayoutResponse = await fetch(`${baseUrl}/api/v1/workspaces/layout`, {
      headers: {
        authorization: "Bearer startup-user-local-runtime-token",
        "x-request-id": "req-local-only-layout-get",
      },
    });
    assert.equal(getLayoutResponse.status, 200);
    const getLayoutPayload = await getLayoutResponse.json() as {
      success: boolean;
      data?: {
        canvases?: Array<{ id?: string }>;
      };
    };
    assert.equal(getLayoutPayload.success, true);
    assert.equal(getLayoutPayload.data?.canvases?.[0]?.id, "canvas-local-only");

    const activeModelsResponse = await fetch(`${baseUrl}/api/v1/model-catalog/active-credit-models`, {
      headers: {
        "x-request-id": "req-local-only-active-models",
      },
    });
    assert.equal(activeModelsResponse.status, 200);
    const activeModelsPayload = await activeModelsResponse.json() as {
      success: boolean;
      data?: {
        items?: unknown[];
      };
    };
    assert.equal(activeModelsPayload.success, true);
    assert.deepEqual(activeModelsPayload.data?.items, []);

    const exchangeRatesResponse = await fetch(`${baseUrl}/api/v1/billing/exchange-rates`, {
      headers: {
        "x-request-id": "req-local-only-exchange-rates",
      },
    });
    assert.equal(exchangeRatesResponse.status, 200);
    const exchangeRatesPayload = await exchangeRatesResponse.json() as {
      success: boolean;
      data?: {
        items?: Array<{ currencyCode?: string }>;
      };
    };
    assert.equal(exchangeRatesPayload.success, true);
    assert.ok((exchangeRatesPayload.data?.items?.length || 0) > 0);
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
    line.includes("WeChat auth service is disabled because the PostgreSQL WeChat repository is unavailable."),
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
