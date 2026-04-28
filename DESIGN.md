# KK Studio Airtable-Inspired UI Manual

Last updated: 2026-04-29

## Direction

KK Studio uses a light-first Airtable-inspired system: white and near-white surfaces, deep navy text `#181d26`, Airtable Blue `#1b61c9` as the single primary interactive accent, subtle `#e0e2e6` borders, and low blue-tinted shadows.

Controlled frosted glass is reserved for key containers and cards: app shells, search shells, important settings panels, selected or high-priority cards. Inputs, dense lists, tables, low-weight modules, and nested utility surfaces stay solid or near-solid to avoid stacked blur and heavy shadows.

## Tokens

- Text: `#181d26` for primary copy, softened navy alpha for secondary copy.
- Accent: `#1b61c9` for primary buttons, selected states, focus rings, links, and active controls.
- Borders: `#e0e2e6` or `rgb(24 29 38 / 0.08-0.12)`.
- Canvas: `#f7f8fb`; surface: `#ffffff`.
- Focus ring: `rgb(27 97 201 / 0.16)` with a visible border color.
- Motion: 180ms standard duration, `cubic-bezier(0.2, 0, 0, 1)`.

## Radius, Shadow, Glass

- Buttons and inputs: 10-12px radius.
- Cards: 16px radius by default; important cards can use 20-24px.
- Shells: 20-24px.
- Avoid arbitrary oversized radius and pill buttons unless the control is icon-only or truly circular.
- Shell shadow cap: `0 16px 36px rgb(24 29 38 / 0.10)`.
- Card shadow cap: `0 10px 24px rgb(24 29 38 / 0.08)`.
- Nested modules: border plus `0 4px 12px rgb(24 29 38 / 0.06)` at most.

## Component Rules

- Buttons must stay inside their parent with `min-width: 0`, ellipsis-safe labels, and shared motion.
- Toggles, segmented controls, drag handles, recycle/restore controls, and selected states use the same 180ms motion scale.
- Inputs use solid or near-solid backgrounds; no colored input blocks.
- Selected rows/cards use Airtable Blue tint, blue border, and a small low shadow, not local indigo/purple classes.
- Cards may contain compact modules, but nested modules must not add another full card shadow.
- Settings default views allocate more visual weight to action areas than explanatory/status modules.

## Typography

Use a restrained product scale: 24px page title, 17-20px section title, 14-15px body, 12px caption, 11px micro. Letter spacing is 0 unless a local all-caps label already requires slight positive tracking. Do not scale fonts with viewport width.

## Dark Mode

Dark mode keeps the same geometry, radius, motion, focus, and selected-state rules. It swaps to deep navy surfaces and brighter blue accents, while preserving the same capped shadow and controlled frosted glass hierarchy.
