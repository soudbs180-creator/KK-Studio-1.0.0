# KK Studio Airtable-Inspired UI System

Last updated: 2026-04-29

## Canonical Direction

KK Studio now follows an Airtable-inspired interface system. The product should read as clear, operational, and dense: light-first canvas, deep navy text `#181d26`, Airtable Blue `#1b61c9` for primary interaction, subtle `#e0e2e6` borders, low blue-tinted shadows, and consistent control geometry.

This replaces the older Apple/dark-heavy UI guidance for new UI work. Dark mode remains supported, but it is a compatibility theme using the same layout, radius, focus, selected-state, and motion rules.

## Visual Hierarchy

| Layer | Treatment | Examples |
| --- | --- | --- |
| Canvas | near-white or app canvas, no decorative color blocks | main workspace background |
| Solid controls | white or near-white, 1px border, visible focus ring | inputs, selects, tables, dense lists |
| Controlled frosted glass | capped blur plus low shadow | app shell, search palette, important settings panels |
| Selected/high priority | Airtable Blue tint, blue border, low blue shadow | selected rows, active cards, primary actions |
| Modal/sheet | frosted shell only; inner modules stay solid | search, settings panels, mobile sheets |

## Color Rules

- Primary text: `#181d26`.
- Primary accent: `#1b61c9`.
- Border: `#e0e2e6` or `rgb(24 29 38 / 0.08-0.12)`.
- Canvas: `#f7f8fb`.
- Surface: `#ffffff`.
- Info/selected tint: `rgb(27 97 201 / 0.08-0.12)`.
- Semantic state colors are allowed only for success, warning, danger, and health states.
- Do not introduce local indigo/purple/blue variants when the state is simply selected or active; use semantic tokens.

## Radius Rules

- Inputs, buttons, toggles, segmented controls: 10-12px.
- Cards and repeated panels: 16px.
- Important cards and shells: 20-24px.
- Badges and tags: 6-8px.
- Circles only for true circular icons or avatars.
- Avoid arbitrary `rounded-[...]` values unless a responsive sheet requires a specific top radius.

## Shadow And Glass Rules

Controlled frosted glass is intentionally limited. It belongs on app/search shells, important settings panels, and selected/high-priority cards. Inputs, dense lists, low-weight modules, and nested information blocks stay solid or near-solid.

- Shell shadow cap: `0 16px 36px rgb(24 29 38 / 0.10)`.
- Card shadow cap: `0 10px 24px rgb(24 29 38 / 0.08)`.
- Nested module cap: `0 4px 12px rgb(24 29 38 / 0.06)`.
- Do not stack full card shadows inside full card shadows.
- Hover may lift by 1px, but opacity-only hover is not enough for controls that toggle or select.

## Controls

- Buttons use shared motion, fixed min-height, ellipsis-safe labels, and no container overflow.
- Primary buttons use Airtable Blue and 12px radius, not oversized 980px pills.
- Toggles use clear track/thumb movement and the same 180ms motion scale as segmented controls.
- Segmented controls use one active indicator and a visible blue selected state.
- Inputs use white or near-white backgrounds with a blue focus ring; no colored input blocks.
- Icon buttons should use Lucide icons and a tooltip/title when the action is not obvious.

## Search Palette

The global search palette is a key shell, so it may use controlled frosted glass. It must not use heavy Tailwind shadows, local indigo selected states, inline focus mutation, or floating actions that can escape the panel. Multi-select confirmation belongs in the footer/action area.

## Settings And API Pages

Settings pages are operational tools, not marketing pages. Action areas take visual priority. Reference cards, metrics, and explanatory modules should be compact, secondary, and hidden behind advanced disclosure when they repeat information.

API setup defaults to a simple action-first view:

- Add/edit/refresh actions are prominent.
- Provider cards stay compact.
- Diagnostics, route pool details, OCR, and platform tools stay behind advanced mode.
- Operation area uses the larger layout weight; info modules use the smaller weight.

## Typography

Use a restrained product scale:

- Page title: 24px.
- Section title: 17-20px.
- Body: 14-15px.
- Caption: 12px.
- Micro label: 11px.

Letter spacing remains 0 for normal text. All-caps labels may use slight positive tracking only when already established in the local UI.

## Motion

Global interactive motion uses:

- Fast hover: 120ms.
- Standard controls: 180ms.
- Panels/sheets: 240ms.
- Ease: `cubic-bezier(0.2, 0, 0, 1)`.

Selection, toggle, segmented control, drag, recycle/restore, and panel transitions must feel like the same system.
