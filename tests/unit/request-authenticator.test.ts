import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createRequestAuthenticator,
  type AuthenticatedRequestContext,
} from "../../apps/api/src/lib/request-authenticator.ts";

test("request authenticator caches successful Supabase token lookups", async () => {
  let resolveCallCount = 0;
  const expectedContext: AuthenticatedRequestContext = {
    userId: "auth-user-1",
    email: "auth@example.com",
  };

  const authenticator = createRequestAuthenticator({
    resolveSupabaseAccessToken: async () => {
      resolveCallCount += 1;
      return expectedContext;
    },
  });

  const headers = {
    authorization: "Bearer test.header.signature",
  };

  const firstResult = await authenticator.authenticate(headers);
  const secondResult = await authenticator.authenticate(headers);

  assert.deepEqual(firstResult, expectedContext);
  assert.deepEqual(secondResult, expectedContext);
  assert.equal(resolveCallCount, 1);
});

test("request authenticator collapses concurrent Supabase token lookups", async () => {
  let resolveCallCount = 0;
  const expectedContext: AuthenticatedRequestContext = {
    userId: "auth-user-2",
  };

  const authenticator = createRequestAuthenticator({
    resolveSupabaseAccessToken: async () => {
      resolveCallCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return expectedContext;
    },
  });

  const headers = {
    authorization: "Bearer concurrent.header.signature",
  };

  const [firstResult, secondResult] = await Promise.all([
    authenticator.authenticate(headers),
    authenticator.authenticate(headers),
  ]);

  assert.deepEqual(firstResult, expectedContext);
  assert.deepEqual(secondResult, expectedContext);
  assert.equal(resolveCallCount, 1);
});

test("request authenticator suppresses transient Supabase lookup failures", async () => {
  const authenticator = createRequestAuthenticator({
    resolveSupabaseAccessToken: async () => {
      throw new Error("fetch failed");
    },
  });

  const result = await authenticator.authenticate({
    authorization: "Bearer broken.header.signature",
  });

  assert.equal(result, undefined);
});
