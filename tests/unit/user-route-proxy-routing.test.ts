import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const ROOT_DIR = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

test("user-owned API traffic defaults to the local KK API user-route endpoint", () => {
  const proxySource = readSource("src/services/model/secureModelProxy.ts");
  const callerSource = readSource("src/services/model/modelCaller.ts");

  assert.match(proxySource, /function shouldUseLocalSystemProxy\(\): boolean \{\s*return true;\s*\}/);
  assert.match(proxySource, /function shouldUseLocalUserRouteApi\(\): boolean \{\s*return true;\s*\}/);
  assert.match(proxySource, /\/api\/v1\/model-proxy\/user/);
  assert.doesNotMatch(proxySource, /function getSecureProxyEndpoint\(/);
  assert.doesNotMatch(proxySource, /async function invokeSecureProxy\(/);
  assert.doesNotMatch(proxySource, /supabaseAnonKey/);
  assert.doesNotMatch(proxySource, /functions\/v1\/user-route-proxy/);
  assert.doesNotMatch(proxySource, /function getLocalUserRouteProxyEndpoint\(/);
  assert.doesNotMatch(proxySource, /function resolveLocalUserRouteTransportTarget\(/);
  assert.doesNotMatch(proxySource, /async function invokeLocalUserRouteProxyHttp\(/);
  assert.doesNotMatch(proxySource, /routeTarget\./);
  assert.doesNotMatch(proxySource, /shouldUseLegacyWebApiFallback/);
  assert.doesNotMatch(proxySource, /VITE_ENABLE_LOCAL_USER_ROUTE_API/);
  assert.doesNotMatch(proxySource, /apikey: supabaseAnonKey/);
  assert.match(proxySource, /startsWith\('local_proxy:'\)/);
  assert.match(callerSource, /callLocalUserRouteProxyChat/);
  assert.match(callerSource, /routeId: config\.route\.id/);
  assert.doesNotMatch(callerSource, /callSecureSystemProxyChat\(\{[\s\S]*userRoute:/);
});

test("LLM service no longer retries user-owned API calls through the credit-model proxy", () => {
  const source = readSource("src/services/llm/LLMService.ts");

  assert.match(
    source,
    /private shouldFallbackToCloudUserRouteAfterLocalProxy\(\s*error: unknown,\s*\): boolean \{[\s\S]*return !message\.includes\('browser direct provider calls are disabled'\);[\s\S]*\}/,
  );
  assert.doesNotMatch(source, /return isLocalUserRouteProxyFallbackError\(error\);/);
});

test("user-route proxy auth failures keep their specific diagnostic message and do not retry with stale cached tokens", () => {
  const proxySource = readSource("src/services/model/secureModelProxy.ts");
  const llmSource = readSource("src/services/llm/LLMService.ts");
  const authContextSource = readSource("src/context/AuthContext.tsx");
  const authEventsSource = readSource("src/services/auth/authSessionEvents.ts");
  const localProxySource = readSource("apps/api/src/modules/model-proxy/application/local-user-route-proxy-service.ts");

  assert.match(proxySource, /function getSecureProxyUserRouteAuthRejectedMessage\(responseBody = ''\): string \{/);
  assert.match(proxySource, /function getSecureProxyUserRouteInvalidJwtDiagnosticMessage\(/);
  assert.match(proxySource, /KK API user-route/);
  assert.doesNotMatch(proxySource, /Supabase Edge Function user-route-proxy/);
  assert.match(proxySource, /function getLocalUserRouteApiEndpoint\(\): string \{/);
  assert.match(proxySource, /\/api\/v1\/model-proxy\/user/);
  assert.match(proxySource, /type InvalidJwtLocalSessionState = 'no-session' \| 'invalid' \| 'valid' \| 'unknown';/);
  assert.match(proxySource, /async function inspectLocalSessionForInvalidJwt\(\): Promise<InvalidJwtLocalSessionState> \{/);
  assert.match(proxySource, /const profileResponse = await kkWebApiClient\.getProfile\(\{ accessToken \}\);/);
  assert.match(proxySource, /Local KK session state after Invalid JWT/);
  assert.doesNotMatch(proxySource, /supabase\.auth\./);
  assert.doesNotMatch(proxySource, /async function tryLocalUserRouteApiFallback\(/);
  assert.doesNotMatch(proxySource, /async function resolveLatestLocalFallbackAccessToken\(/);
  assert.doesNotMatch(proxySource, /Switching local user-route fallback to the freshest browser Supabase access token/);
  assert.doesNotMatch(proxySource, /const fallbackResult = await tryLocalUserRouteApiFallback\(/);
  assert.match(proxySource, /requestAuthSessionInvalidation\(`\$\{feature\}: local-user-route-api returned Invalid JWT`\);/);
  assert.match(proxySource, /if \(!shouldForceRefresh\) \{\s*const storedAccessToken = await resolveStoredCloudAccessToken\(false\);/);
  assert.match(proxySource, /throw buildSessionReauthError\(feature, result\.responseBody, 'user-route', localSessionState\);/);
  assert.match(llmSource, /const existingMessage = error instanceof Error \? error\.message : '';/);
  assert.match(llmSource, /new Error\(existingMessage \|\| getSecureProxySessionReauthMessage\('user-route'\)\)/);
  assert.match(authEventsSource, /export const AUTH_SESSION_INVALIDATION_REQUEST_EVENT = 'kk-auth-session-invalidation-request';/);
  assert.match(authEventsSource, /export function requestAuthSessionInvalidation\(reason: string\): void \{/);
  assert.match(authContextSource, /subscribeAuthSessionInvalidationRequest\(\(\) => \{/);
  assert.match(authContextSource, /tempUserService\.clearCachedTempUser\(\);/);
  assert.match(authContextSource, /setStoredKkApiAccessToken\(undefined\);/);
  assert.match(
    localProxySource,
    /function isHostedSecureProxyTransportFailure\(error: unknown\): boolean \{[\s\S]*if \(error instanceof LocalUserRouteProxyError\) \{[\s\S]*return error\.statusCode === 401 \|\| error\.statusCode >= 500;[\s\S]*\}/,
  );
  assert.match(localProxySource, /retrying image generation directly against the user route/);
  assert.match(localProxySource, /retrying chat generation directly against the user route/);
  assert.match(localProxySource, /retrying video generation directly against the user route/);
  assert.match(localProxySource, /retrying audio generation directly against the user route/);
  assert.match(localProxySource, /private async invokeDirectChatRoute\(/);
  assert.match(localProxySource, /private async invokeDirectVideoRoute\(/);
  assert.match(localProxySource, /private async invokeDirectAudioRoute\(/);
  assert.match(localProxySource, /private async invokeDirectImageRoute\(/);
  assert.match(localProxySource, /const auth = buildGeminiAuth\(`\$\{baseUrl\}\/v1beta\/models\/\$\{modelId\}:generateContent`, routeConfig\);/);
});

test("hosted release workflow deploys the dedicated user-route proxy before the credit-model proxy", () => {
  const source = readSource("scripts/release-hosted.mjs");

  assert.match(source, /runStep\("Deploy user-route-proxy", "npm run supabase:functions:deploy:user-route-proxy"\);/);
});
