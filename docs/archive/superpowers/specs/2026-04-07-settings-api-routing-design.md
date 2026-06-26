# Settings API Routing Design

**Goal**

Make API management inside Settings behave like one coherent workflow: list pages stay focused on browsing, create/edit uses dedicated API child pages, and any back action returns to API management instead of jumping to the generic settings navigation.

**Scope**

- Keep API create/edit under `/settings/api-management/...`.
- Remove inline create/edit behavior from the API management list view.
- Make list-to-editor and editor-to-list transitions feel intentional.
- Make mobile top-bar back behavior route-aware so API editor pages return to API management first.

**Current Problems**

- `ApiSettingsView` mixes route-driven editor pages with local `editorMode/editorSource` state.
- The list view still exposes inline create/edit sections, so create/edit is not clearly separated from the API list.
- Returning from nested API routes can land in the settings navigation instead of the API list, especially on mobile.
- Save/delete/cancel all route back to the list, but the list loses view context and does not guide the user back to the item they were working on.

**Approved Design**

1. API management list pages only render list content.
2. Official endpoint create/edit and provider create/edit only render on their dedicated nested routes.
3. Returning from an API editor route always lands on `/settings/api-management`.
4. The return route carries lightweight list context:
   - active tab
   - optional highlighted item id
5. The API list restores the active tab and briefly highlights the related card so users can see where they came back to.
6. Mobile settings shell uses the current nested API route to decide whether the top-left back button should:
   - return to the API list
   - open the settings navigation
   - close settings
7. Add subtle route-aware enter animations:
   - list view: soft fade/raise
   - editor view: light horizontal slide/fade
   - restored card: short highlight pulse

**Implementation Notes**

- Introduce a small helper module for API-management route state parsing/building so `ApiSettingsView` and `SettingsPanel.localized.tsx` use the same rules.
- Prefer React Router location state for view-context handoff within the settings `MemoryRouter`.
- Keep the existing session-storage snapshot focused on data hydration; do not overload it with navigation responsibilities.

**Verification**

- Unit-test the route-state helper.
- Add a routing regression test that checks:
  - API editor/list flow is route-driven
  - mobile shell includes API-aware back handling
- Run `npm run typecheck`, `npm run governance:agent-docs`, and `npm run check:encoding`.
