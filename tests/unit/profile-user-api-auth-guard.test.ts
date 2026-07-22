import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

test("profile API key storage routes require authenticated user context and keep local payloads user-scoped", () => {
  const source = readFileSync(path.join(process.cwd(), "services/api/routes/user/profile.js"), "utf8");
  const requestContextSource = readFileSync(
    path.join(process.cwd(), "services/api/routes/user/shared/requestContext.js"),
    "utf8",
  );
  const routeStoreSource = readFileSync(
    path.join(process.cwd(), "services/api/lib/dispatcher/localUserRouteStore.js"),
    "utf8",
  );

  assert.match(source, /function requireProfileAuth/);
  assert.match(source, /require\('\.\/shared\/requestContext'\)/);
  assert.match(requestContextSource, /verifyJWT\(req\.headers\.authorization\)/);
  assert.match(source, /Authentication is required for profile user API storage/);
  assert.match(source, /router\.use\(\[[\s\S]*'\/v1\/profile\/key-manager-state'[\s\S]*'\/v1\/profile\/user-apis'[\s\S]*\], requireProfileAuth\)/);
  assert.match(source, /router\.post\('\/v1\/profile\/user-apis\/reveal-secret'/);
  assert.match(source, /function revealProfileApiSecret/);
  assert.match(source, /isSendableUserApiSecret/);
  assert.match(source, /normalizeUserApiSecretForTransport/);
  assert.match(source, /function getLocalRouteApiKeyForTransport\(route\)/);
  assert.match(source, /return normalizeUserApiSecretForTransport\(route && route\.apiKey\);/);
  assert.match(source, /USER_API_SECRET_NOT_AVAILABLE/);
  assert.match(source, /const apiKey = getLocalRouteApiKeyForTransport\(route\);/);
  assert.match(source, /appendWuyinApiKeyToTargetUrl\(targetUrl, apiKey\)/);
  assert.match(source, /readOwnerProfileState\(req\.profileUserId\)/);
  assert.match(source, /writeOwnerProfileState\(req\.profileUserId, nextData\)/);
  assert.doesNotMatch(source, /readLocalStorage\(\)/);
  assert.match(routeStoreSource, /profiles: \{ \[ownerId\]: normalizedProfile \}/);
  assert.match(routeStoreSource, /const data = await readLocalStorage\(ownerId\)/);
  assert.match(routeStoreSource, /delete data\.slots/);
  assert.match(source, /router\.put\(\['\/v1\/profile\/user-apis', '\/v1\/profile\/user-apis\/payload'\]/);
});
