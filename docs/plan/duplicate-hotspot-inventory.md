---
title: "Duplicate And Hotspot Inventory"
summary: "Static inventory of repo areas most likely to hide duplicate behavior, unclear ownership, or oversized modules"
read_when:
  - You are planning Kova cleanup work before adding major features
  - You are looking for duplicate concepts or oversized files to split
  - You are comparing Kova architecture against another agent platform
---

## Status

Static inventory complete. A repeatable lightweight audit helper now exists at
`scripts/audit-kova-spine.mjs` so future reviews can refresh the same repo
signals without hand-counting.

## Scope

This inventory uses lightweight static evidence only: tracked file counts,
line-count hotspots, and docs/code search results. Large files are not bugs by
themselves, but they are where ownership drift and duplicate behavior are most
likely to hide.

Refresh the snapshot with:

```sh
node scripts/audit-kova-spine.mjs
```

For automation or diffing, use:

```sh
node scripts/audit-kova-spine.mjs --json
```

## Snapshot

- Bundled plugin manifest files: 118
- Top-level extension directories: 130
- Tracked docs pages under `docs/`: 480
- Largest source areas by file count:
  - `src/agents`: 1501
  - `src/infra`: 683
  - `src/gateway`: 633
  - `src/commands`: 594
  - `src/plugins`: 511
  - `src/auto-reply`: 492
  - `src/plugin-sdk`: 469
  - `src/cli`: 399
  - `src/config`: 326
  - `src/channels`: 284
- Largest extension areas by file count:
  - `extensions/codex`: 592
  - `extensions/discord`: 357
  - `extensions/matrix`: 329
  - `extensions/telegram`: 321
  - `extensions/browser`: 299
  - `extensions/slack`: 251
  - `extensions/whatsapp`: 234
  - `extensions/feishu`: 194
  - `extensions/msteams`: 180
  - `extensions/qa-lab`: 180
- Control UI drift signals:
  - card/elevated tokens: 148 occurrences in 9 files
  - shadow declarations: 116 occurrences in 11 files
  - gradient declarations: 42 occurrences in 7 files
  - radius token declarations: 289 occurrences in 11 files

## File Hotspots

Generated files should stay generated, but they still affect review and build
weight:

- `src/config/schema.base.generated.ts`
- `src/config/bundled-channel-config-metadata.generated.ts`
- `src/canvas-host/a2ui/a2ui.bundle.js`
- `packages/plugin-sdk/dist/src/config/*.d.ts`

Large hand-maintained or test files worth targeted review:

- `ui/src/styles/components.css`
- `src/plugins/loader.test.ts`
- `extensions/qa-matrix/src/runners/contract/scenarios.test.ts`
- `src/agents/openai-transport-stream.test.ts`
- `extensions/memory-core/src/memory/qmd-manager.test.ts`
- `extensions/telegram/src/bot-message-dispatch.test.ts`
- `src/auto-reply/reply/dispatch-from-config.test.ts`
- `src/agents/openai-ws-stream.test.ts`
- `src/agents/pi-embedded-runner-extraparams.test.ts`
- `src/gateway/server.sessions.gateway-server-sessions-a.test.ts`
- `src/auto-reply/reply/session.test.ts`
- `extensions/telegram/src/bot.create-telegram-bot.test.ts`
- `extensions/qa-lab/web/src/ui-render.ts`
- `extensions/matrix/src/matrix/monitor/handler.test.ts`
- `src/agents/subagent-announce.format.e2e.test.ts`
- `extensions/qa-matrix/src/runners/contract/scenario-runtime-e2ee.ts`
- `src/plugins/loader.ts`

## Concept Hotspots

### Agent Runtime

`src/agents` is the largest source area. It spans embedded runs, transport
streams, harness selection, subagents, tool surfaces, status, and context
handling. Cleanup should not start by splitting files randomly. Start with
contracts:

- default agent runtime
- harness selection
- context-engine lifecycle
- tool policy and tool exposure
- subagent lifecycle and announcement behavior

### Plugin Loader And Compatibility

`src/plugins/loader.ts` and its large test file are a central complexity point.
The loader also intersects with the compatibility registry and manifest-first
direction. This area needs owner-aware cleanup:

- preserve external plugin compatibility
- keep manifest/config validation metadata-only where possible
- shrink broad runtime loading paths toward targeted activation plans
- keep generated metadata in sync with plugin-owned contracts

### Automation

Automation concepts now have a documented stack, but implementation still spans
cron, tasks, Task Flow, hooks, heartbeat, sessions, and subagents. The duplicate
risk is not that these features exist; it is that new automation work may bypass
the stack. Future cleanup should map every automation entrypoint to one of:

- trigger
- authority
- workflow orchestration
- execution record
- delivery state

### Memory And Context

Memory has several valid layers: Markdown files, builtin index, QMD, active
memory, Memory Wiki, dreaming, transcript search, and context-engine assembly.
The duplicate risk is user-facing confusion and cross-layer ownership. Future
cleanup should label each feature as:

- durable storage
- retrieval
- proactive recall
- context assembly
- compaction
- review or knowledge curation

### Legacy Browser UI

The legacy browser UI has structural and visual hotspots:

- `ui/src/styles/components.css`
- `ui/src/styles/config-quick.css`
- `ui/src/styles/layout.css`
- `ui/src/styles/layout.mobile.css`
- `ui/src/styles/control-panel.css`
- `ui/src/ui/app-render.ts`

Do not broaden this surface while Kova is terminal-first. Edit these files only
for compatibility, security, release safety, or direct bug fixes.

## Cleanup Order

1. Keep product-spine docs current before code cleanup.
2. For each hotspot, write down the owner boundary before editing.
3. Split large tests only when the tested contract is clear.
4. Prefer moving owner-specific behavior into the owner module over adding core
   branches.
5. Add or update focused tests for the specific contract being split.
6. Use heavy validation only in CI or on stronger hardware when local runs are
   not safe.

## Started Cleanup

- Config/Gateway defaults: aligned the default Gateway port and canonical config
  path references across runtime, tests, scripts, and docs.
- Legacy browser UI: previous visual cleanup work remains documented, but new
  operator UX should land in CLI/TUI first.
- Repo audit repeatability: added `scripts/audit-kova-spine.mjs` to refresh the
  same tracked-file counts, largest-file signals, and Control UI drift counts.
- Plugin loader: moved bundled runtime dependency Jiti alias collection into
  `src/plugins/bundled-runtime-jiti-aliases.ts` so loader orchestration no
  longer owns dependency export-map scanning.

## Next Implementation Slices

- Split or relocate plugin-loader tests by contract only after the related
  compatibility reporting work is in place.
- Promote capability matrices into user-facing docs and terminal status/settings
  surfaces instead of adding another disconnected capability page.
- Add filesystem checkpoints only when the implementation wraps real Kova-owned
  write/edit/apply-patch paths and can prove preview-first restore semantics.

## Non Goals

- Do not delete compatibility or migration paths just because they are old.
- Do not split generated files by hand.
- Do not rename public config, SDK, or plugin surfaces without a migration path.
- Do not treat line count alone as proof of bad architecture.
