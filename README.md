# Kova

<p align="center">
  <img src="https://raw.githubusercontent.com/chiragborse1/KovaLab/dev/docs/assets/kova-logo.png" alt="Kova" width="220">
</p>

<p align="center">
  <strong>A terminal-first AI agent for your memory, tools, skills, and chat channels.</strong>
</p>

<p align="center">
  <a href="https://github.com/chiragborse1/KovaLab/actions/workflows/ci.yml?branch=dev"><img src="https://img.shields.io/github/actions/workflow/status/chiragborse1/KovaLab/ci.yml?branch=dev&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/chiragborse1/KovaLab/releases"><img src="https://img.shields.io/github/v/release/chiragborse1/KovaLab?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/uT9ETzpaHT"><img src="https://img.shields.io/badge/Discord-Join-5865F2?logo=discord&logoColor=white&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

Kova is a local-first agent that starts in the terminal and grows with your workflow.
Run `kova`, talk to your agent, connect tools when you need them, and keep the browser UI as an optional operator surface instead of the main experience.

[Website](https://www.neuralstudio.in/) · [Docs](https://docs.neuralstudio.in/) · [Getting Started](https://docs.neuralstudio.in/start/getting-started) · [Security](https://docs.neuralstudio.in/gateway/security) · [Discord](https://discord.gg/uT9ETzpaHT)

## Install

Runtime: **Node 24 recommended**, or **Node 22.14+**.

Linux and macOS:

```bash
curl -fsSL https://www.neuralstudio.in/install.sh | bash
```

Windows PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://www.neuralstudio.in/install.ps1 | iex"
```

Manual npm install:

```bash
npm install -g getkova@latest
```

## First run

```bash
kova onboard
kova
```

`kova onboard` sets up the workspace, provider/model, Gateway basics, and optional channels.
`kova` opens the terminal chat directly with the embedded local agent.

For scripts:

```bash
kova agent --local --message "Summarize today's plan"
```

## What Kova does

- **Terminal agent**: fast local TUI, sessions, status, slash commands, tool activity, and model controls.
- **Memory**: durable Markdown memory, semantic search, memory promotion, and long-running recall.
- **Skills**: reusable procedures stored as `SKILL.md`, with readiness checks and workspace skills.
- **Tools**: filesystem, shell, browser, web search, media, cron, nodes, messaging, and automation surfaces.
- **Channels**: Telegram, WhatsApp, Discord, Slack, Signal, Matrix, Google Chat, and more through plugins.
- **Gateway**: optional headless control plane for always-on access, channel delivery, cron, nodes, and remote operation.
- **Apps and nodes**: optional macOS, iOS, Android, browser, canvas, and voice surfaces.

## Default shape

Kova is terminal first:

```text
install -> onboard -> kova
```

The Gateway is infrastructure. Use it when you want always-on delivery, chat channels, cron, or remote nodes.
The browser Control UI is an advanced operator surface, not the primary chat surface.

## Security

Kova can read files, call tools, run commands, and message real people when you enable those surfaces.
Treat every external message, website, and file as untrusted input.

Recommended baseline:

- Keep the Gateway loopback-only until you need remote access.
- Use token auth or password auth for the Gateway.
- Keep DM pairing or allowlists enabled for chat channels.
- Require mentions in groups.
- Use `session.dmScope: "per-channel-peer"` for shared inboxes.
- Keep filesystem access workspace-limited when possible.
- Use sandboxing for non-main or shared sessions.
- Load only plugins and skills you trust.
- Run `kova security audit --deep` after setup changes.

Read the full guide: [Security](https://docs.neuralstudio.in/gateway/security).

## Common commands

```bash
kova                         # open terminal chat
kova onboard                 # guided setup
kova status                  # local readiness snapshot
kova doctor                  # repair common config issues
kova security audit --deep   # security checks
kova update                  # update this install
kova skills list             # inspect skills
kova plugins list            # inspect plugins
```

## Docker image

Kova also publishes a container image for server and VPS deployments:

```bash
docker pull ghcr.io/chiragborse1/kova:dev
```

For normal laptop/terminal use, prefer the regular installer. Use Docker when
you want a containerized Gateway, repeatable server deploys, or a disposable
runtime.

Inside the terminal chat, useful slash commands include:

```text
/status
/new
/reset
/compact
/tools
/skills
/memory
/permissions
/limits
/model
/usage
/verbose
```

## Docs by goal

- Start: [Getting Started](https://docs.neuralstudio.in/start/getting-started), [Onboarding](https://docs.neuralstudio.in/start/wizard), [TUI](https://docs.neuralstudio.in/web/tui)
- Configure: [Configuration](https://docs.neuralstudio.in/gateway/configuration), [Models](https://docs.neuralstudio.in/concepts/models), [Model failover](https://docs.neuralstudio.in/concepts/model-failover)
- Secure: [Security](https://docs.neuralstudio.in/gateway/security), [Sandboxing](https://docs.neuralstudio.in/gateway/sandboxing), [Secrets](https://docs.neuralstudio.in/gateway/secrets)
- Extend: [Skills](https://docs.neuralstudio.in/tools/skills), [Plugins](https://docs.neuralstudio.in/tools/plugin), [Tools](https://docs.neuralstudio.in/tools)
- Connect: [Channels](https://docs.neuralstudio.in/channels), [Telegram](https://docs.neuralstudio.in/channels/telegram), [Discord](https://docs.neuralstudio.in/channels/discord), [Slack](https://docs.neuralstudio.in/channels/slack)
- Run always-on: [Gateway](https://docs.neuralstudio.in/gateway), [Remote access](https://docs.neuralstudio.in/gateway/remote), [Tailscale](https://docs.neuralstudio.in/gateway/tailscale), [Docker](https://docs.neuralstudio.in/install/docker)

## From source

```bash
git clone https://github.com/chiragborse1/KovaLab.git
cd KovaLab
pnpm install
pnpm kova onboard
pnpm kova
```

Development loop:

```bash
pnpm gateway:watch
```

Build artifacts:

```bash
pnpm build
pnpm ui:build
```

`pnpm kova ...` runs from the source checkout. `pnpm build` creates `dist/` for packaged Node execution and release validation.

## State locations

- Config: `~/.kova/kova.json`
- Workspace: `~/.kova/workspace`
- Sessions: `~/.kova/agents/<agent>/sessions`
- Model auth profiles: `~/.kova/agents/<agent>/agent/auth-profiles.json`
- Channel credentials: `~/.kova/credentials`

## License

MIT. See [LICENSE](LICENSE).
