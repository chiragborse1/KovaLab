# Kova Design System

Kova UI uses a flat split-pane system: a 40px topbar, 200px text sidebar, 320px list pane, and a flexible detail pane. The goal is a distinct Kova product surface while preserving the existing gateway data contracts.

## Color

Surfaces use layered dark values from `--kova-base` through `--kova-surface-4`. Borders use `--kova-border-1` through `--kova-border-3`. Text uses `--kova-text-1` through `--kova-text-4`.

The single product accent is `--kova-accent` (`#7c3aed`). Use it only for active nav/list borders, selected tabs, and primary buttons. Semantic colors are reserved for status: green success/live, amber pending/idle, red failed/error, blue running/info, purple scheduled/cron, and cyan channels.

## Typography

Display text uses `JetBrains Mono`, `Fira Code`, or `Cascadia Code`, uppercase with `0.08em` letter spacing. Use it for nav, headers, badges, status, buttons, labels, and tabs.

Body text uses `Inter` with normal case and normal tracking. Use it for content, descriptions, values, messages, output, and timestamps.

Allowed sizes are `10px`, `11px`, `12px`, `13px`, `14px`, `16px`, and `20px`. Body/value weights are `400`, primary titles use `500`, selected/page titles use `600`.

## Spacing

All spacing follows a 4px grid. Common values are 4px inline gaps, 8px compact padding, 12px standard item padding, 16px section padding, 20px section gaps, 24px detail padding, and 32px page-level spacing.

List items use `12px 16px`. Detail pane content uses `24px 32px`. Sidebar nav items use `8px 16px`.

## Forbidden Patterns

Do not use gradients, box shadows, blur/backdrop filters, large rounded corners, icon-only sidebar navigation, drawer animations, modal overlays for normal confirmations, or decorative colored surface blocks. Kova is flat, split-pane, and static by default.

Animations are limited to short color/background/border/opacity transitions. Loading states should use simple opacity pulsing, not shimmer gradients.

## Adding A Page

Every page gets a list pane and a detail pane. The list pane owns selection and filters. The detail pane owns the selected item, tabs, metadata rows, forms, and actions. If nothing is selected, render a Kova empty state rather than opening a drawer or modal.

Use the helpers in `ui/src/ui/kova/` and the variables in `ui/src/styles/kova-design-system.css`. Keep data fetching in the existing gateway controllers and pass the resulting data into the new Kova presentation helpers.
