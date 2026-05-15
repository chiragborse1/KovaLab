# KovaDock <!-- omit in toc -->

Stop typing `docker-compose` commands. Just type `kovadock-start`.

Inspired by Simon Willison's [Running Kova in Docker](https://til.simonwillison.net/llms/kova-docker).

- [Quickstart](#quickstart)
- [Available Commands](#available-commands)
  - [Basic Operations](#basic-operations)
  - [Container Access](#container-access)
  - [Web UI \& Devices](#web-ui--devices)
  - [Setup \& Configuration](#setup--configuration)
  - [Maintenance](#maintenance)
  - [Utilities](#utilities)
- [Configuration \& Secrets](#configuration--secrets)
  - [Docker Files](#docker-files)
  - [Config Files](#config-files)
  - [Initial Setup](#initial-setup)
  - [How It Works in Docker](#how-it-works-in-docker)
  - [Env Precedence](#env-precedence)
- [Common Workflows](#common-workflows)
  - [Check Status and Logs](#check-status-and-logs)
  - [Set Up WhatsApp Bot](#set-up-whatsapp-bot)
  - [Troubleshooting Device Pairing](#troubleshooting-device-pairing)
  - [Fix Token Mismatch Issues](#fix-token-mismatch-issues)
  - [Permission Denied](#permission-denied)
- [Requirements](#requirements)
- [Development](#development)

## Quickstart

**Install:**

```bash
mkdir -p ~/.kovadock && curl -sL https://raw.githubusercontent.com/chiragborse1/KovaLab/main/scripts/kovadock/kovadock-helpers.sh -o ~/.kovadock/kovadock-helpers.sh
```

```bash
echo 'source ~/.kovadock/kovadock-helpers.sh' >> ~/.zshrc && source ~/.zshrc
```

Canonical docs page: https://docs.neuralstudio.in/install/kovadock

If you previously installed KovaDock from `scripts/shell-helpers/kovadock-helpers.sh`, rerun the install command above. The old raw GitHub path has been removed.

**See what you get:**

```bash
kovadock-help
```

On first command, KovaDock auto-detects your Kova directory:

- Checks common paths (`~/kova`, `~/workspace/kova`, etc.)
- If found, asks you to confirm
- Saves to `~/.kovadock/config`

**First time setup:**

```bash
kovadock-start
```

```bash
kovadock-fix-token
```

```bash
kovadock-dashboard
```

If you see "pairing required":

```bash
kovadock-devices
```

And approve the request for the specific device:

```bash
kovadock-approve <request-id>
```

## Available Commands

### Basic Operations

| Command            | Description                     |
| ------------------ | ------------------------------- |
| `kovadock-start`   | Start the gateway               |
| `kovadock-stop`    | Stop the gateway                |
| `kovadock-restart` | Restart the gateway             |
| `kovadock-status`  | Check container status          |
| `kovadock-logs`    | View live logs (follows output) |

### Container Access

| Command                   | Description                                    |
| ------------------------- | ---------------------------------------------- |
| `kovadock-shell`          | Interactive shell inside the gateway container |
| `kovadock-cli <command>`  | Run Kova CLI commands                          |
| `kovadock-exec <command>` | Execute arbitrary commands in the container    |

### Web UI & Devices

| Command                 | Description                                |
| ----------------------- | ------------------------------------------ |
| `kovadock-dashboard`    | Open web UI in browser with authentication |
| `kovadock-devices`      | List device pairing requests               |
| `kovadock-approve <id>` | Approve a device pairing request           |

### Setup & Configuration

| Command              | Description                                       |
| -------------------- | ------------------------------------------------- |
| `kovadock-fix-token` | Configure gateway authentication token (run once) |

### Maintenance

| Command            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `kovadock-update`  | Pull latest, rebuild image, and restart (one command) |
| `kovadock-rebuild` | Rebuild the Docker image only                         |
| `kovadock-clean`   | Remove all containers and volumes (destructive!)      |

### Utilities

| Command                | Description                               |
| ---------------------- | ----------------------------------------- |
| `kovadock-health`      | Run gateway health check                  |
| `kovadock-token`       | Display the gateway authentication token  |
| `kovadock-cd`          | Jump to the Kova project directory        |
| `kovadock-config`      | Open the Kova config directory            |
| `kovadock-show-config` | Print config files with redacted values   |
| `kovadock-workspace`   | Open the workspace directory              |
| `kovadock-help`        | Show all available commands with examples |

## Configuration & Secrets

The Docker setup uses three config files on the host. The container never stores secrets — everything is bind-mounted from local files.

### Docker Files

| File                       | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `Dockerfile`               | Builds the `kova:local` image (Node 22, pnpm, non-root `node` user) |
| `docker-compose.yml`       | Defines `kova-gateway` and `kova-cli` services, bind-mounts, ports  |
| `docker-setup.sh`          | First-time setup — builds image, creates `.env` from `.env.example` |
| `.env.example`             | Template for `<project>/.env` with all supported vars and docs      |
| `docker-compose.extra.yml` | Optional overrides — auto-loaded by KovaDock helpers if present     |

### Config Files

| File                           | Purpose                                          | Examples                                                    |
| ------------------------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| `<project>/.env`               | **Docker infra** — image, ports, gateway token   | `KOVA_GATEWAY_TOKEN`, `KOVA_IMAGE`, `KOVA_GATEWAY_PORT`     |
| `~/.kova/.env`                 | **Secrets** — API keys and bot tokens            | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN` |
| `~/.chiragborse1/KovaLab.json` | **Behavior config** — models, channels, policies | Model selection, WhatsApp allowlists, agent settings        |

**Do NOT** put API keys or bot tokens in `kova.json`. Use `~/.kova/.env` for all secrets.

### Initial Setup

`./docker-setup.sh` (in the project root) handles first-time Docker configuration:

- Builds the `kova:local` image from `Dockerfile`
- Creates `<project>/.env` from `.env.example` with a generated gateway token
- Sets up `~/.kova` directories if they don't exist

```bash
./docker-setup.sh
```

After setup, add your API keys:

```bash
vim ~/.kova/.env
```

See `.env.example` for all supported keys.

The `Dockerfile` supports two optional build args:

- `KOVA_DOCKER_APT_PACKAGES` — extra apt packages to install (e.g. `ffmpeg`)
- `KOVA_INSTALL_BROWSER=1` — pre-install Chromium for browser automation (adds ~300MB, but skips the 60-90s Playwright install on each container start)

### How It Works in Docker

`docker-compose.yml` bind-mounts both config and workspace from the host:

```yaml
volumes:
  - ${KOVA_CONFIG_DIR}:/home/node/.kova
  - ${KOVA_WORKSPACE_DIR}:/home/node/.kova/workspace
```

This means:

- `~/.kova/.env` is available inside the container at `/home/node/.kova/.env` — Kova loads it automatically as the global env fallback
- `~/.chiragborse1/KovaLab.json` is available at `/home/node/.chiragborse1/KovaLab.json` — the gateway watches it and hot-reloads most changes
- No need to add API keys to `docker-compose.yml` or configure anything inside the container
- Keys survive `kovadock-update`, `kovadock-rebuild`, and `kovadock-clean` because they live on the host

The project `.env` feeds Docker Compose directly (gateway token, image name, ports). The `~/.kova/.env` feeds the Kova process inside the container.

### Example `~/.kova/.env`

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=123456:ABCDEF...
```

### Example `<project>/.env`

```bash
KOVA_CONFIG_DIR=/Users/you/.kova
KOVA_WORKSPACE_DIR=/Users/you/.kova/workspace
KOVA_GATEWAY_PORT=18789
KOVA_BRIDGE_PORT=18790
KOVA_GATEWAY_BIND=lan
KOVA_GATEWAY_TOKEN=<generated-by-docker-setup>
KOVA_IMAGE=kova:local
```

### Env Precedence

Kova loads env vars in this order (highest wins, never overrides existing):

1. **Process environment** — `docker-compose.yml` `environment:` block (gateway token, session keys)
2. **`.env` in CWD** — project root `.env` (Docker infra vars)
3. **`~/.kova/.env`** — global secrets (API keys, bot tokens)
4. **`kova.json` `env` block** — inline vars, applied only if still missing
5. **Shell env import** — optional login-shell scrape (`KOVA_LOAD_SHELL_ENV=1`)

## Common Workflows

### Update Kova

> **Important:** `kova update` does not work inside Docker.
> The container runs as a non-root user with a source-built image, so `npm i -g` fails with EACCES.
> Use `kovadock-update` instead — it pulls, rebuilds, and restarts from the host.

```bash
kovadock-update
```

This runs `git pull` → `docker compose build` → `docker compose down/up` in one step.

If you only want to rebuild without pulling:

```bash
kovadock-rebuild && kovadock-stop && kovadock-start
```

### Check Status and Logs

**Restart the gateway:**

```bash
kovadock-restart
```

**Check container status:**

```bash
kovadock-status
```

**View live logs:**

```bash
kovadock-logs
```

### Set Up WhatsApp Bot

**Shell into the container:**

```bash
kovadock-shell
```

**Inside the container, login to WhatsApp:**

```bash
kova channels login --channel whatsapp --verbose
```

Scan the QR code with WhatsApp on your phone.

**Verify connection:**

```bash
kova status
```

### Troubleshooting Device Pairing

**Check for pending pairing requests:**

```bash
kovadock-devices
```

**Copy the Request ID from the "Pending" table, then approve:**

```bash
kovadock-approve <request-id>
```

Then refresh your browser.

### Fix Token Mismatch Issues

If you see "gateway token mismatch" errors:

```bash
kovadock-fix-token
```

This will:

1. Read the token from your `.env` file
2. Configure it in the Kova config
3. Restart the gateway
4. Verify the configuration

### Permission Denied

**Ensure Docker is running and you have permission:**

```bash
docker ps
```

## Requirements

- Docker and Docker Compose installed
- Bash or Zsh shell
- Kova project (run `scripts/docker/setup.sh`)

## Development

**Test with fresh config (mimics first-time install):**

```bash
unset KOVADOCK_DIR && rm -f ~/.kovadock/config && source scripts/kovadock/kovadock-helpers.sh
```

Then run any command to trigger auto-detect:

```bash
kovadock-start
```
