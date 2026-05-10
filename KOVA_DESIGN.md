# Kova Design

## Core Principle

Kova uses rules and type, not containers. The UI has one background color. Hierarchy comes from full-width ruled lines, typography size/weight, and whitespace.

Do not create cards. Do not add tinted panels. Do not rely on elevation. If content needs grouping, use a horizontal rule and a clear uppercase section title.

## Color System

The only application background is `--k-bg` (`#0a0a0a`). It is used for the app, sidebar, list pane, detail pane, controls, editors, and empty areas.

Rules use `--k-rule` and `--k-rule-strong`. Text uses `--k-text-1`, `--k-text-2`, and `--k-text-3`.

The only product accent is `--k-accent` (`#c8a96e`). Use it for active navigation, selected list item borders, active filter/tab underlines, and primary action buttons.

Semantic colors are only for state: `--k-green`, `--k-amber`, `--k-red`, `--k-blue`, `--k-purple`, and `--k-cyan`.

## Typography

Display chrome uses `JetBrains Mono`, `Fira Code`, or `Cascadia Code`, always uppercase with `0.1em` letter spacing. Use display chrome for navigation, labels, section titles, badges, buttons, tabs, timestamps, and metadata keys.

Content uses `Inter` with normal casing and normal tracking. Use body text for descriptions, values, conversations, file content, logs, and agent output.

Allowed sizes are `10px`, `11px`, `12px`, `13px`, `14px`, `16px`, `20px`, and `28px`.

## Spacing

Spacing follows a 4px grid. Major detail sections use `24px 32px 12px` titles, a full-width rule, then `20px 32px` content. List items use `12px 16px`. Sidebar nav items use `7px 16px`.

## Forbidden Patterns

No gradients, shadows, blur, backdrop filters, cards, modals, slide-in drawers, icon-only sidebar items, filled badge backgrounds, rounded badges, shimmer skeletons, or surface background changes.

`border-radius` is zero everywhere except status dots, which are circular. Badges are square CLI tags with a current-color border.

## Adding A Page

Every page follows the shell: topbar, text sidebar, list pane, and detail pane. The list pane shows selectable records. The detail pane shows the selected record with section title, rule, content.

When there is no selection, show text only: a small uppercase title and one body line. Do not show illustrations or card wrappers.
