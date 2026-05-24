---
title: "Plugin Compatibility Cleanup"
summary: "Owner-aware plan for reducing Kova plugin compatibility and doctor migration debt without breaking external plugins"
read_when:
  - You are changing plugin SDK, manifest, loader, setup, provider, or channel compatibility
  - You are planning removal of deprecated plugin or doctor migration paths
  - You are reviewing Kova plugin compatibility before a release
---

## Status

Static audit complete. No compatibility paths removed. A lightweight reporting
helper now exists at `scripts/plugin-compat-report.mjs` so release planning can
see owner/status counts and upcoming removal-review dates before any breaking
cleanup.

Refresh the report with:

```sh
node scripts/plugin-compat-report.mjs --as-of=2026-05-22
```

Or through the package script:

```sh
pnpm plugins:compat:report -- --as-of=2026-05-22
```

For automation or release-note prep, use:

```sh
node scripts/plugin-compat-report.mjs --json --as-of=2026-05-22
```

For owner-specific sweeps, filter the same report instead of hand-counting:

```sh
node scripts/plugin-compat-report.mjs --as-of=2026-05-22 --owner=provider --status=deprecated --due-days=90 --limit=10
```

## Snapshot

Runtime/plugin compatibility registry:

- File: `src/plugins/compat/registry.ts`
- Records: 50
- Deprecated records: 37
- Active compatibility records: 13
- Owner distribution:
  - `sdk`: 14
  - `provider`: 9
  - `channel`: 7
  - `config`: 7
  - `plugin-execution`: 7
  - `agent-runtime`: 4
  - `setup`: 2

Doctor repair and migration compatibility:

- File: `src/commands/doctor/shared/deprecation-compat.ts`
- Records: 19
- Current default removal window: `2026-07-26`
- Owners include agent runtime, config, channel, provider, plugin, TTS, tools,
  gateway, and audio.

Combined report as of `2026-05-22`:

- Total records: 69
- Runtime/plugin records: 50
- Doctor repair records: 19
- Deprecated or removal-pending records: 56
- Active records: 13
- Highest owner counts:
  - `sdk`: 14
  - `provider`: 12
  - `channel`: 10
  - `config`: 10
  - `agent-runtime`: 7
  - `plugin-execution`: 7
- Removal-review queue: 56 deprecated records fall within the next 90 days.
  The earliest current dates are `2026-07-24`, `2026-07-25`, and
  `2026-07-26`.

## Current Risk

The compatibility layer is useful and intentional. The risk is that deprecated
paths keep accumulating without a release-owned sweep that proves:

- the replacement still matches current architecture
- bundled plugins no longer depend on the old path
- external plugin guidance is clear
- doctor repair still covers supported upgrade paths
- release notes warn before removal

Do not remove compatibility just because the `removeAfter` date is near. A
removal needs current shipped-behavior proof and explicit breaking-release
approval.

## Cleanup Groups

### SDK Surface

Largest owner group. Includes root SDK imports, command auth helpers, channel
runtime aliases, type aliases, test-utils aliases, memory split registration,
runtime aliases, and legacy extension API imports.

Cleanup direction:

- prefer focused `getkova/plugin-sdk/<subpath>` imports
- keep shims until external plugin guidance and tests prove migration
- group release notes by SDK import family instead of listing every alias
  separately

### Provider Surfaces

Includes web search/fetch/x_search config migrations, discovery aliases,
static capability bags, thinking hooks, external OAuth hooks, and provider web
search wrappers.

Cleanup direction:

- verify current provider plugin ownership before removal
- keep doctor repair for old config even if runtime aliases are removed
- ensure provider docs point to explicit catalog, auth, thinking, replay, and
  transport hooks

### Channel Surfaces

Includes channel env vars, exposure aliases, native message schema helpers,
mention gating helpers, inbound envelope helpers, and approval capability
aliases.

Cleanup direction:

- preserve generic message presentation and delivery contracts
- remove native-message escape hatches only after bundled channel renderers no
  longer need them
- keep channel setup and group-policy docs aligned

### Config And Plugin Registry

Includes bundled plugin allowlist/default behavior, persisted registry env
flags, plugin install ledger migration, and bundled load-path aliases.

Cleanup direction:

- keep user repair paths in `kova doctor --fix`
- prefer state-managed plugin install ledgers over authored config
- do not delete install migration flags until package install and update docs
  no longer need them

### Agent Runtime

Includes embedded harness config aliases, agent harness SDK aliases, harness id
aliases, and tool-result middleware harness aliases.

Cleanup direction:

- keep `agentRuntime` naming as the canonical public concept
- verify Codex harness docs and ACP/subagent runtime docs before removal
- keep runtime-tool middleware behavior covered by owner tests

## Release Sweep Checklist

For each deprecated record:

1. Confirm `replacement`, `docsPath`, `diagnostics`, and `tests` still point to
   real current behavior.
2. Search bundled plugins and docs for the deprecated surface.
3. Check doctor migration coverage separately from runtime compatibility.
4. Decide one of:
   - keep as `deprecated`
   - move to `removal-pending`
   - mark `active` permanent compatibility
   - remove in a breaking release
5. Add release notes before `removal-pending` or removal.
6. Keep removal grouped by owner so users can understand migration impact.

## Non Goals

- Do not remove compatibility in this cleanup plan.
- Do not collapse doctor repair records into runtime plugin records.
- Do not make Kova core publish the future plugin inspector binary.
- Do not change external plugin contracts without a migration window.

## Next Implementation Slice

The reporting helper now supports package-script access plus owner, source,
status, review-window, and queue-limit filters. The next safe slice is a release
sweep that marks specific records `removal-pending` only after bundled-plugin
and external-plugin guidance has been verified.
