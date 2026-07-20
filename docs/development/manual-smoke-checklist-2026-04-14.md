Status: historical

# 2026-04-14 Manual Smoke Checklist

## Goal
- Close the remaining human-only acceptance gaps after the automated verification chain is green.
- Keep the manual scope limited to startup feel, desktop settings product feel, touch feel, and external auth callback behavior that are still not trustworthy to automate.
- Record results in [manual-smoke-record-2026-04-14.md](/C:/Users/Administrator/Downloads/KK-Studio-1.0.0/docs/development/manual-smoke-record-2026-04-14.md).

## Preconditions
- `cmd /c npm run typecheck` has passed in the current workspace.
- `cmd /c npm run dev:status` reports frontend and API as healthy.
- Browser artifact baselines already exist in:
  - `.tmp-playwright/prompt-group-drag`
  - `.tmp-playwright/mobile-settings-smoke`
  - `.tmp-playwright/desktop-settings-smoke`

## Manual Checks
### 1. Startup entry feel
- Open the app from a fresh tab.
- Confirm the workspace shell becomes visible immediately, without a fullscreen “正在进入工作区” blocker covering the page.
- If background warm-up is still ongoing, confirm it appears only as a non-blocking top banner.

Pass criteria:
- No blocking fullscreen startup card, no frozen first screen, and the user can perceive that the real workspace has already loaded.

### 2. Desktop settings direct route
- Open `/settings` directly.
- Open `/settings/api-management` directly.
- Confirm both routes use the same gray control-console shell as the in-app settings overlay.
- Confirm close/back behavior is understandable and the page does not fall back to a blank workspace.

Pass criteria:
- Direct settings routes render consistently, remain readable, and do not feel visually detached from the in-app settings shell.

### 3. Mobile home touch feel
- Open the app in a real mobile viewport or on a phone.
- Confirm the home shell still presents the header/feed/composer three-zone layout.
- Tap one result card and confirm the transition feels immediate, without the header or composer jumping.
- Open the more menu and confirm the settings entry is easy to hit and not obscured by overlays.

Pass criteria:
- No visual overlap, no frozen scroll region, and no accidental double-trigger on taps.

### 4. Mobile detail actions
- Open a generated result detail page from the mobile feed.
- Confirm the continuation card, source/use-as-source, partial redraw, download, and delete actions all render in the expected order.
- Exercise the close action and confirm the user returns to the same feed context without losing the result tile.

Pass criteria:
- Detail actions stay reachable, labels are understandable, and close/back behavior returns to the same mobile flow.

### 5. Settings workbench product feel
- Open mobile settings home, then enter API workbench.
- Toggle diagnostics on and off.
- Trigger the diagnostics refresh action once.
- Confirm overview/current view/stage/platform sections stay readable and the page does not lose route context.

Pass criteria:
- Route context stays stable, diagnostics does not replace the underlying stage truth, and the page remains readable on mobile.

### 6. External auth callback flow
- Start one real external login flow that is still outside reliable local automation:
  - WeChat hosted login callback, or
  - hosted browser password login path verification if that is the active release risk.
- Complete the callback and confirm the browser lands back on the expected hosted/app origin.

Pass criteria:
- No callback loop, no wrong-origin redirect, and no silent fallback onto a legacy path.

## Evidence To Record
- Date/time of the manual run.
- Who performed the smoke.
- Device or viewport used.
- For any failure: one screenshot, one short repro note, and the exact module impacted.

## Exit Rule
- Only after this checklist is green should any module be upgraded from `已落地待回归` to a stronger completion claim.
