# API Client Boundary Convergence Design

**Status:** Approved by the 2026-07-13 architecture audit and the user's instruction to continue implementation.

## Goal

Remove two Web API boundary bypasses without changing the Wuyin catalog response or the active authentication session flow.

## Wuyin catalog contract

`KkApiClient` gains typed read and refresh methods for the existing runtime routes:

- `getWuyinCatalog()` -> `GET /api/v1/wuyin/catalog`
- `refreshWuyinCatalog()` -> `POST /api/v1/wuyin/catalog/refresh`

The server currently returns a legacy `{ success, data, source }` payload without standard response metadata. The client normalizes that payload into the standard `ApiResponse<WuyinCatalogResponseDto>` shape, where `data.items` is the catalog and `data.source` is `cache`, `remote`, or `fallback`. The component never parses HTTP responses directly.

The shared model-catalog DTO owns the Wuyin catalog item shape. The existing Web catalog module aliases this shared DTO so the default catalog and server results cannot drift structurally.

## Authentication cleanup

`apps/web/src/shims/authCreateReact.tsx` has no active alias or import path; imports of `@auth/create/react` are virtual-module imports and do not resolve to this file. Its only local caller, `apps/web/src/utils/useAuth.js`, is also unreferenced. Both files are deleted, eliminating the only active-source reference to the nonexistent `/api/auth/signin/:provider` endpoint.

The root virtual-module imports and `global.d.ts` declaration are unchanged. This phase therefore does not alter `SessionProvider`, `useSession`, `AuthContext`, login, logout, or OAuth runtime behavior.

## Verification

- Behavioral client tests assert URL, HTTP method, legacy-envelope normalization, and malformed-payload rejection.
- Boundary tests assert `ApiSettingsView` contains no Wuyin Catalog `fetch` call and active Web source contains no `/api/auth/signin` request.
- Typecheck, architecture, governance, build, full tests, and encoding checks must pass before synchronization.
