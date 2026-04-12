# Login And Admin Access Design

**Goal**

Adjust the authentication surface and admin access model so that:

- the login screen clearly supports email/password, WeChat QR, and Google sign-in
- the admin entry becomes a smaller secondary action grouped with temporary sign-in
- the system defaults to one primary administrator identity
- additional administrators can still be granted explicitly by an existing administrator
- admin access remains protected by the current elevated admin password session

**Scope**

- Update the login screen layout and action hierarchy in [`src/components/auth/LoginScreen.tsx`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/auth/LoginScreen.tsx) and [`src/components/auth/LoginScreen.css`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/components/auth/LoginScreen.css).
- Add a real Google sign-in entry to the current auth surface.
- Preserve the current email/password and WeChat QR flows.
- Keep temporary sign-in available, but demote it to an auxiliary action.
- Tighten backend admin identity resolution in [`apps/api/src/modules/admin-console/application/admin-console-service.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/api/src/modules/admin-console/application/admin-console-service.ts) and [`apps/api/src/modules/admin-console/infrastructure/supabase-admin-console-repository.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/api/src/modules/admin-console/infrastructure/supabase-admin-console-repository.ts).
- Preserve the current admin password verification and elevated admin session flow.

**Non-Goals**

- Rebuilding the full admin console IA or settings shell.
- Replacing Supabase Auth with a custom auth provider.
- Changing temporary account lifetime or storage semantics.
- Removing delegated admin support.
- Designing a brand-new user-role system beyond the existing `profiles.role` field plus one primary admin identity.

**Current Problems**

- The login screen currently exposes email/password, WeChat QR, and temporary sign-in, but it does not expose a real Google sign-in entry even though the product requirement now includes Google login.
- Temporary sign-in is currently presented as a normal ghost button in the main social-action area, so it competes visually with real account sign-in instead of reading as an auxiliary fallback.
- There is no dedicated small admin entry grouped with temporary sign-in on the login surface.
- The backend currently resolves admin access primarily from `profiles.role === "admin"` in [`admin-console-service.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/api/src/modules/admin-console/application/admin-console-service.ts), which does not express the stronger product rule that there is one default administrator identity and all other administrators are explicitly granted.
- The current frontend admin state hook [`src/hooks/useAdminRole.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/hooks/useAdminRole.ts) trusts the admin access payload shape, but it does not distinguish between:
  - the primary owner administrator
  - delegated administrators
  - non-admin users who should never see the admin entry as a primary path

**Approved Product Decisions**

1. The primary login methods are:
   - email/password
   - WeChat QR
   - Google
2. Temporary sign-in remains available, but it is an auxiliary path, not a primary login method.
3. The admin entry is a compact secondary action placed in the same auxiliary action group as temporary sign-in.
4. The admin entry is not a separate identity system. It is a privileged path for accounts that already resolve as administrators.
5. The system has one primary administrator identity by default.
6. The primary administrator identity is bound to one canonical Supabase user ID, not to an email string.
7. Additional administrators may still be granted explicitly through the existing admin role assignment flow.
8. Elevated admin actions continue to require the current admin password verification and admin session token flow.
9. Temporary accounts never qualify for admin access.

**Why The Primary Admin Uses Supabase User ID**

- The product requires one real administrator who may log in through email, WeChat, or Google.
- Email is not a stable identity if the owner later changes email or uses a linked social provider.
- The repository already treats multi-provider login as a canonical-user problem, and the primary admin rule needs to follow that same identity boundary.
- A server-side primary admin user ID lets the same person keep admin access across linked providers without turning every matching email into an implicit admin.

**Chosen Identity Model**

The hosted backend will treat admin access as the union of:

1. `primary admin user id`
2. `profiles.role === "admin"` for delegated administrators

The primary admin user ID is the owner account and is configured server-side through a dedicated environment variable:

- `KK_PRIMARY_ADMIN_USER_ID=<supabase-user-id>`

Resolution rules:

- If `authenticatedUser.id === KK_PRIMARY_ADMIN_USER_ID`, the user is an admin.
- Otherwise, the user is an admin only when `profiles.role === "admin"`.
- If neither is true, the user is a normal user.
- Temporary users are always normal users.

This keeps the current `profiles.role` delegation path intact while enforcing the product rule that the system starts with one owner admin.

**Admin Role Rules**

**Primary admin**

- Always resolves as admin when the authenticated user ID matches `KK_PRIMARY_ADMIN_USER_ID`.
- May verify admin password, open elevated admin sessions, and grant or revoke delegated admin roles.
- Cannot be demoted through the normal `setUserRole(..., "user")` flow.

**Delegated admins**

- Are represented by `profiles.role = "admin"`.
- May access the same admin console features after passing the elevated admin password step.
- Can be granted or revoked by an elevated administrator.

**Normal users**

- Resolve as `user`.
- Can sign in with email, WeChat, or Google.
- Cannot access admin console features.

**Temporary users**

- Never resolve as admin.
- Never see an enabled admin entry.
- Continue to be blocked from cloud sync and admin-credit-model features.

**Frontend Login Design**

**Primary action stack**

The login form keeps the existing email/password form as the main path.

Below the submit button, the login screen shows a provider section with:

- `Continue with WeChat QR`
- `Continue with Google`

Both actions are first-class sign-in methods and should share the same visual weight.

**Auxiliary action row**

Below the primary provider section, add a compact horizontal auxiliary row with:

- `Temporary account`
- `Admin sign-in`

Behavior:

- Both actions use smaller button sizing than the main submit button and the two primary provider buttons.
- Both actions remain visually secondary.
- The row should read as "other ways to enter", not as the main account path.

**Admin button behavior**

- Logged-out state:
  - The button remains visible as a compact secondary action.
  - Clicking it shows a localized message that the user must first sign in with an admin account.
  - It should not open a fake parallel admin-auth flow on the login screen.
- Logged-in non-admin state:
  - The button may remain visible but disabled, or show the same "current account is not an admin" feedback.
  - It must not navigate to admin routes.
- Logged-in admin state:
  - The button opens the existing admin verification flow or navigates into the existing admin console entrypoint.

This keeps the UI aligned with the product rule that "admin login" is a privileged mode of an existing account, not a separate account namespace.

**Google Sign-In Design**

Add a real Google sign-in action on the login screen.

Implementation direction:

- Do not push Google login through `AuthContext` first. `AuthContext` currently exposes temporary sign-in and runtime session state, while email login already lives in a dedicated auth service.
- Follow the same pattern as password and WeChat flows by adding a dedicated Google auth service.
- The new service should initiate Supabase Google OAuth and reuse the existing auth callback handling path instead of inventing a parallel callback format.

Suggested frontend boundary:

- [`src/services/auth/googleAuth.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/services/auth/googleAuth.ts)

Responsibilities:

- start Google OAuth
- compute redirect target from the current auth redirect configuration
- localize configuration errors clearly

The login screen should only own button state, loading state, and user-facing feedback.

**Auth callback expectations**

- Google sign-in must land in the same canonical KK Studio auth flow as other real accounts.
- The resulting authenticated user must be able to resolve admin access through the same admin access API call as email and WeChat users.
- This design does not require a separate "Google admin login" path.

**Backend Admin Access Design**

**1. Access resolution**

Update [`AdminConsoleService.getAccess`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/apps/api/src/modules/admin-console/application/admin-console-service.ts) so that:

- it resolves the effective admin state from:
  - `KK_PRIMARY_ADMIN_USER_ID`
  - stored delegated role from `profiles.role`
- it returns a stable role envelope that still fits the current frontend contract
- it continues to report:
  - `role`
  - `isAdmin`
  - `requiresPasswordChange`
  - `adminSessionActive`
  - `adminSessionExpiresAt`

Behavior:

- Primary admin user ID returns `role = "admin"` even if the profile row is missing or still says `"user"`.
- Delegated admins continue to return `role = "admin"` from `profiles.role`.
- Non-admin users return `role = "user"`.

**2. Elevated admin guard**

Keep the existing elevated admin password model.

That means:

- admin identity alone is not enough for dangerous actions
- `verifyAdminPassword` still creates the elevated admin session token
- mutation routes still require the admin session token

This is important because the user asked to keep admin access narrow, not looser.

**3. Role mutation rules**

Update delegated role mutation behavior so that:

- only elevated admins can grant or revoke delegated admin roles
- attempting to demote `KK_PRIMARY_ADMIN_USER_ID` through `setUserRole(..., "user")` fails with a clear domain error
- delegated admins may be promoted and demoted normally

This avoids a broken state where the owner account gets locked out by an ordinary role update.

**4. Repository boundary**

The repository layer should stay responsible for:

- reading profile rows
- mutating delegated `profiles.role`
- reading and writing admin password and admin session data

The repository layer should not decide whether a user ID is the primary admin. That decision belongs in the application/service layer because it combines:

- authenticated runtime context
- server-only configuration
- profile data

**Frontend Admin State Design**

[`src/hooks/useAdminRole.ts`](C:/Users/Administrator/Downloads/KK-Studio-1.0.0/src/hooks/useAdminRole.ts) remains the single frontend authority for resolved admin access.

Expected behavior after the backend change:

- it calls `getAdminAccess`
- it trusts the backend-resolved `role` and `isAdmin`
- it continues to expose:
  - `accountRole`
  - `isAdmin`
  - `adminSessionActive`
  - `requiresAdminPasswordChange`

No frontend-only heuristics should be added for:

- matching email strings
- guessing whether a user "looks like" the owner
- inferring admin status from provider or avatar

Admin state must remain server-resolved.

**UI Copy And Layout Rules**

**Login provider copy**

- Email remains the main form label.
- WeChat button copy stays explicit that it is QR sign-in.
- Google button copy should read as a normal sign-in action, not a "bind" action.

**Auxiliary row copy**

- `Temporary account`
- `Admin sign-in`

Chinese copy should stay short and scan-friendly so both compact buttons fit on one row on desktop.

**Sizing**

- Main submit button keeps the current full-width prominent styling.
- WeChat and Google buttons remain full-width provider actions.
- Temporary account and admin sign-in become compact buttons with:
  - smaller height
  - reduced font size
  - lighter visual emphasis
  - shared row layout on desktop

**Interaction states**

- Admin button loading or verification state must not block the normal login form unless the user explicitly triggered the admin action.
- Temporary account confirmation modal remains intact.
- Google and WeChat loading states remain independent.

**Data Flow**

**Email**

1. User submits email/password.
2. Frontend continues using the existing password sign-in service.
3. Runtime session becomes authenticated.
4. `useAdminRole` fetches admin access.
5. If the resolved account is admin, the compact admin entry becomes actionable.

**WeChat**

1. User starts WeChat QR sign-in.
2. Existing WeChat auth start flow opens the QR modal.
3. Callback returns into the existing auth flow.
4. `useAdminRole` fetches admin access using the authenticated user.

**Google**

1. User clicks Google sign-in.
2. New Google auth service starts Supabase OAuth.
3. Callback returns into the existing auth callback handling path.
4. `useAdminRole` fetches admin access using the authenticated user.

**Admin**

1. User signs in with a real account.
2. Frontend resolves admin access through `getAdminAccess`.
3. If the account is admin, the user can trigger admin verification.
4. `verifyAdminPassword` creates the elevated admin session token.
5. Mutating admin routes continue to require that elevated token.

**Error Handling**

- If Google auth is not configured, clicking the Google button should show a localized configuration error instead of failing silently.
- If the admin button is clicked while logged out, show a localized "please sign in first" message.
- If the current signed-in account is not admin, show a localized "current account is not an admin" message.
- If the primary admin environment variable is missing in hosted API mode, backend startup and diagnostics should surface that clearly instead of silently treating every role-based admin as the only source of truth.
- If someone tries to demote the primary admin through role mutation, return a clear domain error instead of a generic 500.

**Testing**

**Frontend**

Add coverage for:

- login screen renders:
  - email/password form
  - WeChat button
  - Google button
  - compact temporary account button
  - compact admin sign-in button
- auxiliary row layout contract for temporary account + admin sign-in
- admin button feedback when:
  - logged out
  - logged in as non-admin
  - logged in as admin

**Backend**

Write failing tests first for:

- primary admin user ID resolves as admin even if profile role is not yet `admin`
- delegated admin profile role still resolves as admin
- non-admin user resolves as user
- primary admin cannot be demoted via delegated role mutation
- delegated admin can still be granted and revoked

**Verification**

Because this spec changes repository docs, require:

- `npm run governance:agent-docs`
- `npm run check:encoding`

When implementation begins, require at minimum:

- `npm run typecheck`
- targeted auth/admin tests for the modified login and admin-role surfaces

**Acceptance Criteria**

- The login screen presents email/password, WeChat QR, and Google as the primary sign-in methods.
- The login screen presents temporary account and admin sign-in together as smaller auxiliary actions.
- Admin sign-in no longer reads as a full separate login system.
- Admin access defaults to one primary Supabase user identity configured on the server.
- The primary admin can sign in through linked real-account providers and still resolve as admin.
- Additional users only become admins after an existing admin explicitly grants them admin role access.
- Temporary users never receive admin access.
- Elevated admin password and admin session token behavior remains intact.

