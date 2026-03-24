# apps/payment-sidecar

`apps/payment-sidecar` is the new payment sidecar for KK Studio.

Current responsibilities:

- `POST /payment/v1/orders`
  Creates a typed payment order and returns a unified envelope.
- `GET /payment/v1/orders/{merchantOrderNo}/status`
  Returns the typed status view used by the migrated frontend payment client.
- `POST /payment/v1/callbacks/alipay`
  Accepts the Alipay-style callback payload and writes settlement back to the main API.
- `GET /api/pay/qrcode`
  Legacy compatibility route used by the existing recharge modal.
- `GET /api/pay/status`
  Legacy compatibility route for polling payment status during migration.
- `GET /api/pay`
  Legacy redirect compatibility route.

Architecture notes:

- The sidecar owns payment order orchestration and callback normalization.
- The sidecar does not mutate credit balances directly.
- The sidecar resolves `creditAmount` on the server from `amount + currency` and does not trust client-supplied credit totals.
- Credit settlement is written back through the main API internal contract:
  `POST /internal/v1/payment-settlements`
- When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) are present, the sidecar stores orders and callbacks in Supabase.
- When those server-side credentials are missing, the sidecar falls back to the in-memory repository for local development and isolated tests.

Local verification:

- Set `RUN_PAYMENT_SIDECAR=true` to boot the sidecar directly from `apps/payment-sidecar/src/server.ts`.
- Set `KK_API_BASE_URL` to point at the main API when you want callbacks to settle credits.
- Set `PAYMENT_SIDECAR_INTERNAL_TOKEN` on both services to protect the internal settlement path.
- Set `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` to enable durable payment storage.
- Set `PAYMENT_SIDECAR_ALLOW_MANUAL_CHECKOUT=true` only for local/manual checkout verification.
