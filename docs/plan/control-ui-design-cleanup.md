---
title: "Control UI Design Cleanup"
summary: "Plan for bringing the Control UI back in line with KOVA_DESIGN.md"
read_when:
  - You are changing Control UI layout, theme tokens, cards, panels, or mobile navigation
  - You are removing UI design drift from Kova
  - You are deciding whether a Control UI component should use cards, shadows, gradients, or rounded surfaces
---

## Status

Static audit complete. Phase 1 guardrails are in place. Quick Settings and
Control Panel now have first visual cleanup passes that keep existing behavior
and class hooks stable while removing the loudest card, shadow, gradient,
elevated-background, negative-tracking, and rounded-surface styling.

## Goal

Bring Control UI surfaces back to the documented Kova design language:

- one application background
- hierarchy through type, rules, and spacing
- square controls and square badges
- no card-first layout system
- no decorative shadows, gradients, blur, or tinted panels
- no slide-in drawer model unless the design guide is explicitly updated

## Current Drift

### Theme Tokens

`ui/src/styles/base.css` still defines broad surface tokens that encourage the
old design language:

- `--card`
- `--panel`
- `--bg-elevated`
- `--shadow-*`
- `--radius-*`

These tokens are used across the UI, so removing them must be staged. First
stop new usage, then replace old usage by surface.

### Quick Settings

`ui/src/styles/config-quick.css` is the largest visible mismatch. It uses:

- `.qs-card` and card modifiers
- card headers and card bodies
- rounded identity cards and profile panels
- `var(--card)` and `var(--bg-elevated)` backgrounds
- shadows, gradients, and glow/focus effects beyond rule-based hierarchy

This should become a ruled settings surface: section title, full-width rule,
compact controls, and simple list/grid rhythm.

### Mobile Layout

`ui/src/styles/layout.mobile.css` still uses the slide-over drawer model:

- `shell--nav-drawer-open`
- drawer/backdrop behavior
- shadowed nav surface
- rounded collapsed navigation elements

This conflicts with the design guide's "no slide-in drawers" rule. Mobile
navigation needs an explicit design decision before code cleanup: either update
the guide to permit a constrained mobile drawer, or replace it with a simpler
stacked/hidden text nav pattern.

### Control Panel

`ui/src/styles/control-panel.css` uses cards, rounded sections, elevated
backgrounds, chips, and toggle pills. This should move toward the same ruled
operator layout used by the rest of the product spine.

### Layout And Chat Chrome

`ui/src/styles/layout.css` and chat-adjacent styles contain radius, shadow,
gradient, and elevated-background usage. Some of these are functional focus or
status affordances, so they need review before deletion. The cleanup should
separate semantic state from decorative surface styling.

## Cleanup Order

### Phase 1: Freeze New Drift

- Done: add a short Control UI style rule near `ui/AGENTS.md` pointing contributors to
  `KOVA_DESIGN.md`.
- Done: add `scripts/check-control-ui-design.mjs` and wire it into `test:ui` for
  migrated Control UI style files.
- Done: keep exceptions explicit for status dots and accessibility focus rings.

### Phase 2: Quick Settings

- Remaining: rename CSS concepts away from `card` where possible.
- In progress: replace `.qs-card` sections with ruled sections.
- In progress: remove card backgrounds, hover shadows, rounded containers, and gradients.
- Keep the same controls and data wiring; this should be visual cleanup, not a
  settings behavior rewrite.

### Phase 3: Control Panel

- Done: convert hero and section cards into ruled sections.
- Done: replace chips/pill toggles with square segmented controls and bordered tags.
- Done: remove elevated panel backgrounds from the main Control Panel stylesheet.
- Done: surface manifest-derived plugin capability totals for tools, runtime APIs, and services.
- Remaining: review rendered desktop/mobile screenshots when the dev server is available.

### Phase 4: Mobile Navigation

- Done: remove drawer shadow, tinted backdrop, rounded mobile nav controls,
  elevated mobile control backgrounds, and rounded mobile content overrides.
- Done: add `ui/src/styles/layout.mobile.css` to the migrated-style guard.
- Remaining: decide whether the design guide allows a constrained mobile drawer.
- If not, replace the drawer model with a simpler mobile navigation layout.
- Remaining: browser-check desktop/tablet/mobile navigation once a dev server is available.

### Phase 5: Token Cleanup

- Make `--k-bg`, `--k-rule`, `--k-rule-strong`, `--k-text-*`, and `--k-accent`
  the preferred app-level tokens.
- Keep compatibility aliases only while old surfaces are being migrated.
- Remove broad `card`, `panel`, `shadow`, and radius token reliance once usage
  drops enough.

## Non Goals

- Do not change Gateway or settings behavior during visual cleanup.
- Do not redesign every page at once.
- Do not remove accessibility focus indicators; replace decorative glow with a
  plain visible focus rule where needed.
- Do not hand-edit generated locale bundles as part of visual cleanup.

## Remaining Proof

The implementation phase should use lightweight static checks first. Browser
screenshots are useful after CSS changes, but broad build/test gates remain
separate from this plan and should only run when the machine or CI can handle
them.
