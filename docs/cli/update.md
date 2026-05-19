---
summary: "CLI reference for `kova update` (safe-ish source update + gateway auto-restart)"
read_when:
  - You want to update a source checkout safely
  - You need to understand `--update` shorthand behavior
title: "Update"
---

# `kova update`

Safely update Kova and switch between stable/beta/dev channels.

If you installed via **npm/pnpm/bun** (global install, no git metadata),
updates happen via the package-manager flow in [Updating](/install/updating).

## Usage

```bash
kova update
kova update status
kova update wizard
kova update --channel beta
kova update --channel dev
kova update --tag beta
kova update --tag main
kova update --dry-run
kova update --no-restart
kova update --yes
kova update --json
kova --update
```

## Options

- `--no-restart`: skip restarting the Gateway service after a successful update. Package-manager updates that do restart the Gateway verify the restarted service reports the expected updated version before the command succeeds.
- `--channel <stable|beta|dev>`: set the update channel (git + npm; persisted in config).
- `--tag <dist-tag|version|spec>`: override the package target for this update only. For package installs, `main` maps to `github:chiragborse1/KovaLab#main`.
- `--dry-run`: preview planned update actions (channel/tag/target/restart flow) without writing config, installing, syncing plugins, or restarting.
- `--json`: print machine-readable `UpdateRunResult` JSON, including
  `postUpdate.plugins.integrityDrifts` when npm plugin artifact drift is
  detected during post-update plugin sync.
- `--timeout <seconds>`: per-step timeout (default is 1800s).
- `--yes`: skip confirmation prompts (for example downgrade confirmation).

<Warning>
Downgrades require confirmation because older versions can break configuration.
</Warning>

## `update status`

Show the active update channel + git tag/branch/SHA (for source checkouts), plus update availability.

```bash
kova update status
kova update status --json
kova update status --timeout 10
```

Options:

- `--json`: print machine-readable status JSON.
- `--timeout <seconds>`: timeout for checks (default is 3s).

## `update wizard`

Interactive flow to pick an update channel and confirm whether to restart the Gateway
after updating (default is to restart). If you select `dev` without a git checkout, it
offers to create one.

Options:

- `--timeout <seconds>`: timeout for each update step (default `1800`)

## What it does

When you switch channels explicitly (`--channel ...`), Kova also keeps the
install method aligned:

- `dev` → ensures a git checkout (default: `~/kova`, override with `KOVA_GIT_DIR`),
  updates it, and installs the global CLI from that checkout.
- `stable` → installs from npm using `latest`.
- `beta` → prefers npm dist-tag `beta`, but falls back to `latest` when beta is
  missing or older than the current stable release.

The Gateway core auto-updater (when enabled via config) reuses this same update path.

For package-manager installs, `kova update` resolves the target package
version before invoking the package manager. Even when the installed version
already matches the target, the command refreshes the global package install,
then runs plugin sync, a core-command completion refresh, and restart work. This
keeps packaged sidecars and channel-owned plugin records aligned with the
installed Kova build while leaving full plugin-command completion rebuilds to
explicit `kova completion --write-state` runs.

When a managed Gateway service exists, package updates use the package root and
Node binary from that service command. If the interactive shell points at a
different global Kova install, the updater prints the mismatch and updates the
service-owned package root so the restarted Gateway uses the same runtime that
was validated before install.

## Git checkout flow

### Channel selection

- `stable`: checkout the latest non-beta tag, then build and doctor.
- `beta`: prefer the latest `-beta` tag, but fall back to the latest stable tag when beta is missing or older.
- `dev`: checkout `main`, then fetch and rebase.

### Update steps

<Steps>
  <Step title="Verify clean worktree">
    Requires no uncommitted changes.
  </Step>
  <Step title="Switch channel">
    Switches to the selected channel (tag or branch).
  </Step>
  <Step title="Fetch upstream">
    Dev only.
  </Step>
  <Step title="Preflight build (dev only)">
    Runs lint and TypeScript build in a temp worktree. If the tip fails, walks back up to 10 commits to find the newest clean build.
  </Step>
  <Step title="Rebase">
    Rebases onto the selected commit (dev only).
  </Step>
  <Step title="Install dependencies">
    Uses the repo package manager. For pnpm checkouts, the updater bootstraps `pnpm` on demand (via `corepack` first, then a temporary `npm install pnpm@10` fallback) instead of running `npm run build` inside a pnpm workspace.
  </Step>
  <Step title="Build Control UI">
    Builds the gateway and the Control UI.
  </Step>
  <Step title="Run doctor">
    `kova doctor` runs as the final safe-update check.
  </Step>
  <Step title="Sync plugins">
    Syncs plugins to the active channel. Dev uses bundled plugins; stable and beta use npm. Updates npm-installed plugins.
  </Step>
</Steps>

<Warning>
If an exact pinned npm plugin update resolves to an artifact whose integrity differs from the stored install record, `kova update` aborts that plugin artifact update instead of installing it. Reinstall or update the plugin explicitly only after verifying that you trust the new artifact.
</Warning>

<Note>
Post-update plugin sync failures fail the update result and stop restart follow-up work. Fix the plugin install or update error, then rerun `kova update`.

When the updated Gateway starts, enabled bundled plugin runtime dependencies are staged before plugin activation. Update-triggered restarts drain any active runtime-dependency staging before closing the Gateway, so service-manager restarts do not interrupt an in-flight npm install.

If pnpm bootstrap still fails, the updater stops early with a package-manager-specific error instead of trying `npm run build` inside the checkout.
</Note>

## `--update` shorthand

`kova --update` rewrites to `kova update` (useful for shells and launcher scripts).

## Related

- `kova doctor` (offers to run update first on git checkouts)
- [Development channels](/install/development-channels)
- [Updating](/install/updating)
- [CLI reference](/cli)
