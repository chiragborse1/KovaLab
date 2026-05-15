---
summary: "Install Kova declaratively with Nix"
read_when:
  - You want reproducible, rollback-able installs
  - You're already using Nix/NixOS/Home Manager
  - You want everything pinned and managed declaratively
title: "Nix"
---

Install Kova declaratively with **[nix-kova](https://github.com/kova/nix-kova)** — a batteries-included Home Manager module.

<Info>
The [nix-kova](https://github.com/kova/nix-kova) repo is the source of truth for Nix installation. This page is a quick overview.
</Info>

## What you get

- Gateway + macOS app + tools (whisper, spotify, cameras) -- all pinned
- Launchd service that survives reboots
- Plugin system with declarative config
- Instant rollback: `home-manager switch --rollback`

## Quick start

<Steps>
  <Step title="Install Determinate Nix">
    If Nix is not already installed, follow the [Determinate Nix installer](https://github.com/DeterminateSystems/nix-installer) instructions.
  </Step>
  <Step title="Create a local flake">
    Use the agent-first template from the nix-kova repo:
    ```bash
    mkdir -p ~/code/kova-local
    # Copy templates/agent-first/flake.nix from the nix-kova repo
    ```
  </Step>
  <Step title="Configure secrets">
    Set up your messaging bot token and model provider API key. Plain files at `~/.secrets/` work fine.
  </Step>
  <Step title="Fill in template placeholders and switch">
    ```bash
    home-manager switch
    ```
  </Step>
  <Step title="Verify">
    Confirm the launchd service is running and your bot responds to messages.
  </Step>
</Steps>

See the [nix-kova README](https://github.com/kova/nix-kova) for full module options and examples.

## Nix-mode runtime behavior

When `KOVA_NIX_MODE=1` is set (automatic with nix-kova), Kova enters a deterministic mode that disables auto-install flows.

You can also set it manually:

```bash
export KOVA_NIX_MODE=1
```

On macOS, the GUI app does not automatically inherit shell environment variables. Enable Nix mode via defaults instead:

```bash
defaults write ai.kova.mac kova.nixMode -bool true
```

### What changes in Nix mode

- Auto-install and self-mutation flows are disabled
- Missing dependencies surface Nix-specific remediation messages
- UI surfaces a read-only Nix mode banner

### Config and state paths

Kova reads JSON5 config from `KOVA_CONFIG_PATH` and stores mutable data in `KOVA_STATE_DIR`. When running under Nix, set these explicitly to Nix-managed locations so runtime state and config stay out of the immutable store.

| Variable           | Default                                 |
| ------------------ | --------------------------------------- |
| `KOVA_HOME`        | `HOME` / `USERPROFILE` / `os.homedir()` |
| `KOVA_STATE_DIR`   | `~/.kova`                               |
| `KOVA_CONFIG_PATH` | `$KOVA_STATE_DIR/kova.json`             |

### Service PATH discovery

The launchd/systemd gateway service auto-discovers Nix-profile binaries so
plugins and tools that shell out to `nix`-installed executables work without
manual PATH setup:

- When `NIX_PROFILES` is set, every entry is added to the service PATH in
  right-to-left precedence (matches Nix shell precedence — rightmost wins).
- When `NIX_PROFILES` is unset, `~/.nix-profile/bin` is added as a fallback.

This applies to both macOS launchd and Linux systemd service environments.

## Related

- [nix-kova](https://github.com/kova/nix-kova) -- full setup guide
- [Wizard](/start/wizard) -- non-Nix CLI setup
- [Docker](/install/docker) -- containerized setup
