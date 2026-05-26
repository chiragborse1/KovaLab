---
summary: "KovaDock shell helpers for Docker-based Kova installs"
read_when:
  - You run Kova with Docker often and want shorter day-to-day commands
  - You want a helper layer for logs, token setup, and pairing flows
title: "KovaDock"
---

KovaDock is a small shell-helper layer for Docker-based Kova installs.

It gives you short commands like `kovadock-start`, `kovadock-status`, and `kovadock-fix-token` instead of longer `docker compose ...` invocations.

If you have not set up Docker yet, start with [Docker](/install/docker).

## Install

Use the canonical helper path:

```bash
mkdir -p ~/.kovadock && curl -sL https://raw.githubusercontent.com/chiragborse1/KovaLab/main/scripts/kovadock/kovadock-helpers.sh -o ~/.kovadock/kovadock-helpers.sh
echo 'source ~/.kovadock/kovadock-helpers.sh' >> ~/.zshrc && source ~/.zshrc
```

If you previously installed KovaDock from `scripts/shell-helpers/kovadock-helpers.sh`, reinstall from the new `scripts/kovadock/kovadock-helpers.sh` path. The old raw GitHub path was removed.

## What you get

### Basic operations

| Command            | Description            |
| ------------------ | ---------------------- |
| `kovadock-start`   | Start the gateway      |
| `kovadock-stop`    | Stop the gateway       |
| `kovadock-restart` | Restart the gateway    |
| `kovadock-status`  | Check container status |
| `kovadock-logs`    | Follow gateway logs    |

### Container access

| Command                   | Description                                   |
| ------------------------- | --------------------------------------------- |
| `kovadock-shell`          | Open a shell inside the gateway container     |
| `kovadock-cli <command>`  | Run Kova CLI commands in Docker               |
| `kovadock-exec <command>` | Execute an arbitrary command in the container |

### Pairing

| Command                 | Description                  |
| ----------------------- | ---------------------------- |
| `kovadock-devices`      | List pending device pairings |
| `kovadock-approve <id>` | Approve a pairing request    |

### Setup and maintenance

| Command              | Description                                      |
| -------------------- | ------------------------------------------------ |
| `kovadock-fix-token` | Configure the gateway token inside the container |
| `kovadock-update`    | Pull, rebuild, and restart                       |
| `kovadock-rebuild`   | Rebuild the Docker image only                    |
| `kovadock-clean`     | Remove containers and volumes                    |

### Utilities

| Command                | Description                             |
| ---------------------- | --------------------------------------- |
| `kovadock-health`      | Run a gateway health check              |
| `kovadock-token`       | Print the gateway token                 |
| `kovadock-cd`          | Jump to the Kova project directory      |
| `kovadock-config`      | Open `~/.kova`                          |
| `kovadock-show-config` | Print config files with redacted values |
| `kovadock-workspace`   | Open the workspace directory            |

## First-time flow

```bash
kovadock-start
kovadock-fix-token
kovadock-status
```

If pairing is required:

```bash
kovadock-devices
kovadock-approve <request-id>
```

## Config and secrets

KovaDock works with the same Docker config split described in [Docker](/install/docker):

- `<project>/.env` for Docker-specific values like image name, ports, and the gateway token
- `~/.kova/.env` for env-backed provider keys and bot tokens
- `~/.kova/agents/<agentId>/agent/auth-profiles.json` for stored provider OAuth/API-key auth
- `~/.kova/kova.json` for behavior config

Use `kovadock-show-config` when you want to inspect the `.env` files and `kova.json` quickly. It redacts `.env` values in its printed output.

## Related pages

- [Docker](/install/docker)
- [Docker VM Runtime](/install/docker-vm-runtime)
- [Updating](/install/updating)
