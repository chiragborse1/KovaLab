---
title: "Filesystem Checkpoint And Rollback"
summary: "Decision and implementation plan for file-mutation checkpoints and restore"
read_when:
  - You are comparing Kova rollback behavior with another agent platform
  - You are adding file mutation tools or restore flows
  - You are deciding whether session rollback is enough for a workflow
---

## Decision

Kova should not silently claim whole-workspace filesystem rollback.

Today, `/rollback` is a **session rollback** surface for compaction checkpoints.
It can list, preview, branch, or restore a conversation snapshot. It is not a
file restore mechanism.

For filesystem changes, Kova's default safety contract remains:

- prefer Git-tracked workspaces for code changes
- show tool approvals before risky writes
- never hide mutations behind automatic restore claims
- rely on explicit user commits, branches, and diffs for durable project
  history

Kova should add filesystem checkpoints only as an explicit, bounded layer around
Kova-owned file mutation paths.

## Why

Automatic whole-workspace snapshots are expensive, surprising, and risky in
large local repos. They can copy secrets, generated assets, `node_modules`,
large media, caches, and private files the agent did not need to touch.

The useful safety feature is narrower: when Kova writes or edits a file, it can
record enough before-state to preview and restore that specific mutation.

## Proposed Contract

Future checkpoints should be:

- **explicit**: shown as file checkpoints, not confused with session rollback
- **bounded**: only files touched by Kova-owned write/edit/apply-patch paths
- **diff-first**: store before hash, after hash, and a restore patch or before
  content when size limits allow
- **secret-aware**: skip known credential/state paths and redact metadata where
  possible
- **size-capped**: do not snapshot large binaries or generated dependency
  trees
- **workspace-scoped**: do not cross workspace roots or follow unsafe symlinks
- **reviewable**: list/show/restore commands must preview before mutation

## Terminal Shape

Do not overload `/rollback` without a clear qualifier. Keep session rollback as:

```text
/rollback list
/rollback show <id>
/rollback branch <id>
/rollback restore <id> confirm
```

Use a separate filesystem surface when implemented:

```bash
kova checkpoints list
kova checkpoints show <id>
kova checkpoints restore <id> --preview
kova checkpoints restore <id> --yes
```

TUI aliases can come later as `/checkpoints ...` or `/rollback files ...`.

## Implementation Plan

1. Add a checkpoint store under Kova state, keyed by workspace and session/run.
2. Wrap Kova-owned file mutation helpers with before/after checkpoint capture.
3. Record metadata: workspace root, relative path, operation, size, mtime,
   before hash, after hash, session key, run id, and timestamp.
4. Store restore data only when the file is text or under the configured size
   limit.
5. Add `kova checkpoints list/show/restore` with preview-first behavior.
6. Add TUI discovery after the CLI contract is stable.
7. Add CI-heavy restore tests outside low-RAM local workflows.

## Non Goals

- No automatic full-repo tarballs.
- No snapshots of `node_modules`, build output, caches, credentials, or channel
  state.
- No restore without preview or explicit confirmation.
- No promise to undo mutations made by arbitrary shell commands outside Kova's
  file mutation helpers.

## Related

- [TUI](/web/tui)
- [Sandboxing](/gateway/sandboxing)
- [Product Spine Cleanup](/plan/kova-product-spine-cleanup)
