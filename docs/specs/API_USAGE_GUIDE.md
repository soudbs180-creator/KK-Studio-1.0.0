# Secure API Client Usage

Status: reference Browser and mobile features call KK Studio's authenticated API
through `@kk/api-client`; Provider credentials remain behind `services/api/`.

## Create the client

```ts
import { createKkApiClient } from "@kk/api-client";

const client = createKkApiClient({
  baseUrl: runtimeConfig.apiBaseUrl,
  getAccessToken: () => sessionStore.getAccessToken(),
  refreshAccessToken: () => sessionStore.refreshAccessToken(),
  onRefreshToken: (token) => sessionStore.setAccessToken(token),
  getClientVersion: () => runtimeConfig.clientVersion,
});
```

The configuration uses injected runtime values. Do not add Provider keys,
database credentials or payment secrets to default headers or browser storage.

## Read catalog and create durable work

```ts
const models = await client.listModels({ kind: "image" });

const job = await client.createGenerationJob({
  idempotencyKey,
  request: generationRequest,
});
```

Use the DTOs exported by `@kk/api-client`; do not copy response shapes into a
component. UI code presents the server cost quote and confirmation state, while
`DurableGenerationQueue` owns retries, recovery and output import.

## User-owned routes

User-owned Provider settings are written through the Profile/Key Manager API.
The UI may display masked configuration state and run a server-side
connectivity check. It must not reveal a secret into normal feature state or
issue a Provider request from the browser.

## Error handling

- Preserve `X-Request-Id` in user-facing support context and server logs.
- Treat `401` refresh as a single typed-client retry, not a component loop.
- Pass `AbortSignal` for cancellable operations.
- Keep retryable Provider failure, validation failure, partial success and
  cancellation distinct.
- Never log request headers, secret fields, signed URLs or arbitrary tool
  output.

See [TypeScript API Client](../api/typescript-client.md) for the current method
catalog and [API integration guide](API_INTEGRATION_GUIDE.md) for ownership
boundaries.
