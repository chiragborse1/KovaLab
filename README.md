# 🦄 Kova — Personal AI Assistant

<p align="center">
    <img src="https://raw.githubusercontent.com/chiragborse1/KovaLab/dev/docs/assets/kova-logo.png" alt="Kova" width="220">
</p>

<p align="center">
  <strong>Your personal AI assistant, across your devices and channels.</strong>
</p>

<p align="center">
  <a href="https://github.com/chiragborse1/KovaLab/actions/workflows/ci.yml?branch=dev"><img src="https://img.shields.io/github/actions/workflow/status/chiragborse1/KovaLab/ci.yml?branch=dev&style=for-the-badge" alt="CI status"></a>
  <a href="https://github.com/chiragborse1/KovaLab/releases"><img src="https://img.shields.io/github/v/release/chiragborse1/KovaLab?include_prereleases&style=for-the-badge" alt="GitHub release"></a>
  <a href="https://discord.gg/kova"><img src="https://img.shields.io/discord/1456350064065904867?label=Discord&logo=discord&logoColor=white&color=5865F2&style=for-the-badge" alt="Discord"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**Kova** is a _personal AI assistant_ you run on your own devices.
It answers you on the channels you already use. It can speak and listen on macOS/iOS/Android, and can render a live Canvas you control. The Gateway is just the control plane — the product is the assistant.

If you want a personal, single-user assistant that feels local, fast, and always-on, this is it.

Supported channels include: WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, BlueBubbles, IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, Zalo Personal, WeChat, QQ, WebChat.

[Website](https://www.neuralstudio.in/) · [Docs](https://docs.neuralstudio.in/) · [Vision](VISION.md) · [Getting Started](https://docs.neuralstudio.in/start/getting-started) · [Updating](https://docs.neuralstudio.in/install/updating) · [Showcase](https://docs.neuralstudio.in/start/showcase) · [FAQ](https://docs.neuralstudio.in/help/faq) · [Onboarding](https://docs.neuralstudio.in/start/wizard) · [Docker](https://docs.neuralstudio.in/install/docker) · [Discord](https://discord.gg/kova)

New install? Start here: [Getting started](https://docs.neuralstudio.in/start/getting-started)

Preferred setup: run `kova onboard` in your terminal.
Kova Onboard guides you step by step through setting up the gateway, workspace, channels, and skills. It is the recommended CLI setup path and works on **macOS, Linux, and Windows (via WSL2; strongly recommended)**.
Works with npm, pnpm, or bun.

Model note: while many providers and models are supported, prefer a current flagship model from the provider you trust and already use. See [Onboarding](https://docs.neuralstudio.in/start/onboarding).

## Install (recommended)

Runtime: **Node 24 (recommended) or Node 22.14+**.

```bash
npm install -g getkova@latest
# or: pnpm add -g getkova@latest

kova onboard --install-daemon
```

Kova Onboard installs the Gateway daemon (launchd/systemd user service) so it stays running.

## Quick start (TL;DR)

Runtime: **Node 24 (recommended) or Node 22.14+**.

Full beginner guide (auth, pairing, channels): [Getting started](https://docs.neuralstudio.in/start/getting-started)

```bash
kova onboard --install-daemon

kova gateway --port 18789 --verbose

# Send a message
kova message send --target +1234567890 --message "Hello from Kova"

# Talk to the assistant (optionally deliver back to any connected channel: WhatsApp/Telegram/Slack/Discord/Google Chat/Signal/iMessage/BlueBubbles/IRC/Microsoft Teams/Matrix/Feishu/LINE/Mattermost/Nextcloud Talk/Nostr/Synology Chat/Tlon/Twitch/Zalo/Zalo Personal/WeChat/QQ/WebChat)
kova agent --message "Ship checklist" --thinking high
```

Upgrading? [Updating guide](https://docs.neuralstudio.in/install/updating) (and run `kova doctor`).

Models config + CLI: [Models](https://docs.neuralstudio.in/concepts/models). Auth profile rotation + fallbacks: [Model failover](https://docs.neuralstudio.in/concepts/model-failover).

## Security defaults (DM access)

Kova connects to real messaging surfaces. Treat inbound DMs as **untrusted input**.

Full security guide: [Security](https://docs.neuralstudio.in/gateway/security)

Default behavior on Telegram/WhatsApp/Signal/iMessage/Microsoft Teams/Discord/Google Chat/Slack:

- **DM pairing** (`dmPolicy="pairing"` / `channels.discord.dmPolicy="pairing"` / `channels.slack.dmPolicy="pairing"`; legacy: `channels.discord.dm.policy`, `channels.slack.dm.policy`): unknown senders receive a short pairing code and the bot does not process their message.
- Approve with: `kova pairing approve <channel> <code>` (then the sender is added to a local allowlist store).
- Public inbound DMs require an explicit opt-in: set `dmPolicy="open"` and include `"*"` in the channel allowlist (`allowFrom` / `channels.discord.allowFrom` / `channels.slack.allowFrom`; legacy: `channels.discord.dm.allowFrom`, `channels.slack.dm.allowFrom`).

Run `kova doctor` to surface risky/misconfigured DM policies.

## Highlights

- **[Local-first Gateway](https://docs.neuralstudio.in/gateway)** — single control plane for sessions, channels, tools, and events.
- **[Multi-channel inbox](https://docs.neuralstudio.in/channels)** — WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, BlueBubbles (iMessage), iMessage (legacy), IRC, Microsoft Teams, Matrix, Feishu, LINE, Mattermost, Nextcloud Talk, Nostr, Synology Chat, Tlon, Twitch, Zalo, Zalo Personal, WeChat, QQ, WebChat, macOS, iOS/Android.
- **[Multi-agent routing](https://docs.neuralstudio.in/gateway/configuration)** — route inbound channels/accounts/peers to isolated agents (workspaces + per-agent sessions).
- **[Voice Wake](https://docs.neuralstudio.in/nodes/voicewake) + [Talk Mode](https://docs.neuralstudio.in/nodes/talk)** — wake words on macOS/iOS and continuous voice on Android (ElevenLabs + system TTS fallback).
- **[Live Canvas](https://docs.neuralstudio.in/platforms/mac/canvas)** — agent-driven visual workspace with [A2UI](https://docs.neuralstudio.in/platforms/mac/canvas#canvas-a2ui).
- **[First-class tools](https://docs.neuralstudio.in/tools)** — browser, canvas, nodes, cron, sessions, and Discord/Slack actions.
- **[Companion apps](https://docs.neuralstudio.in/platforms/macos)** — macOS menu bar app + iOS/Android [nodes](https://docs.neuralstudio.in/nodes).
- **[Onboarding](https://docs.neuralstudio.in/start/wizard) + [skills](https://docs.neuralstudio.in/tools/skills)** — onboarding-driven setup with bundled/managed/workspace skills.

## Security model (important)

- Default: tools run on the host for the `main` session, so the agent has full access when it is just you.
- Group/channel safety: set `agents.defaults.sandbox.mode: "non-main"` to run non-`main` sessions inside sandboxes. Docker is the default sandbox backend; SSH and OpenShell backends are also available.
- Typical sandbox default: allow `bash`, `process`, `read`, `write`, `edit`, `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`; deny `browser`, `canvas`, `nodes`, `cron`, `discord`, `gateway`.
- Before exposing anything remotely, read [Security](https://docs.neuralstudio.in/gateway/security), [Sandboxing](https://docs.neuralstudio.in/gateway/sandboxing), and [Configuration](https://docs.neuralstudio.in/gateway/configuration).

## Operator quick refs

- Chat commands: `/status`, `/new`, `/reset`, `/compact`, `/think <level>`, `/verbose on|off`, `/trace on|off`, `/usage off|tokens|full`, `/restart`, `/activation mention|always`
- Session tools: `sessions_list`, `sessions_history`, `sessions_send`
- Skills registry: [KovaHub](https://kovahub.ai)
- Architecture overview: [Architecture](https://docs.neuralstudio.in/concepts/architecture)

## Docs by goal

- New here: [Getting started](https://docs.neuralstudio.in/start/getting-started), [Onboarding](https://docs.neuralstudio.in/start/wizard), [Updating](https://docs.neuralstudio.in/install/updating)
- Channel setup: [Channels index](https://docs.neuralstudio.in/channels), [WhatsApp](https://docs.neuralstudio.in/channels/whatsapp), [Telegram](https://docs.neuralstudio.in/channels/telegram), [Discord](https://docs.neuralstudio.in/channels/discord), [Slack](https://docs.neuralstudio.in/channels/slack)
- Apps + nodes: [macOS](https://docs.neuralstudio.in/platforms/macos), [iOS](https://docs.neuralstudio.in/platforms/ios), [Android](https://docs.neuralstudio.in/platforms/android), [Nodes](https://docs.neuralstudio.in/nodes)
- Config + security: [Configuration](https://docs.neuralstudio.in/gateway/configuration), [Security](https://docs.neuralstudio.in/gateway/security), [Sandboxing](https://docs.neuralstudio.in/gateway/sandboxing)
- Remote + web: [Gateway](https://docs.neuralstudio.in/gateway), [Remote access](https://docs.neuralstudio.in/gateway/remote), [Tailscale](https://docs.neuralstudio.in/gateway/tailscale), [Web surfaces](https://docs.neuralstudio.in/web)
- Tools + automation: [Tools](https://docs.neuralstudio.in/tools), [Skills](https://docs.neuralstudio.in/tools/skills), [Cron jobs](https://docs.neuralstudio.in/automation/cron-jobs), [Webhooks](https://docs.neuralstudio.in/automation/webhook), [Gmail Pub/Sub](https://docs.neuralstudio.in/automation/gmail-pubsub)
- Internals: [Architecture](https://docs.neuralstudio.in/concepts/architecture), [Agent](https://docs.neuralstudio.in/concepts/agent), [Session model](https://docs.neuralstudio.in/concepts/session), [Gateway protocol](https://docs.neuralstudio.in/reference/rpc)
- Troubleshooting: [Channel troubleshooting](https://docs.neuralstudio.in/channels/troubleshooting), [Logging](https://docs.neuralstudio.in/logging), [Docs home](https://docs.neuralstudio.in/)

## Apps (optional)

The Gateway alone delivers a great experience. All apps are optional and add extra features.

If you plan to build/run companion apps, follow the platform runbooks below.

### macOS (Kova.app) (optional)

- Menu bar control for the Gateway and health.
- Voice Wake + push-to-talk overlay.
- WebChat + debug tools.
- Remote gateway control over SSH.

Note: signed builds required for macOS permissions to stick across rebuilds (see [macOS Permissions](https://docs.neuralstudio.in/platforms/mac/permissions)).

### iOS node (optional)

- Pairs as a node over the Gateway WebSocket (device pairing).
- Voice trigger forwarding + Canvas surface.
- Controlled via `kova nodes …`.

Runbook: [iOS connect](https://docs.neuralstudio.in/platforms/ios).

### Android node (optional)

- Pairs as a WS node via device pairing (`kova devices ...`).
- Exposes Connect/Chat/Voice tabs plus Canvas, Camera, Screen capture, and Android device command families.
- Runbook: [Android connect](https://docs.neuralstudio.in/platforms/android).

## From source (development)

Prefer `pnpm` for builds from source. Bun is optional for running TypeScript directly.

For the dev loop:

```bash
git clone https://github.com/chiragborse1/KovaLab.git
cd KovaLab

pnpm install

# First run only (or after resetting local Kova config/workspace)
pnpm kova setup

# Optional: prebuild Control UI before first startup
pnpm ui:build

# Dev loop (auto-reload on source/config changes)
pnpm gateway:watch
```

If you need a built `dist/` from the checkout (for Node, packaging, or release validation), run:

```bash
pnpm build
pnpm ui:build
```

`pnpm kova setup` writes the local config/workspace needed for `pnpm gateway:watch`. It is safe to re-run, but you normally only need it on first setup or after resetting local state. `pnpm gateway:watch` does not rebuild `dist/control-ui`, so rerun `pnpm ui:build` after `ui/` changes or use `pnpm ui:dev` when iterating on the Control UI. If you want this checkout to run onboarding directly, use `pnpm kova onboard --install-daemon`.

Note: `pnpm kova ...` runs TypeScript directly (via `tsx`). `pnpm build` produces `dist/` for running via Node / the packaged `kova` binary, while `pnpm gateway:watch` rebuilds the runtime on demand during the dev loop.

## Development channels

- **stable**: tagged releases (`vYYYY.M.D` or `vYYYY.M.D-<patch>`), npm dist-tag `latest`.
- **beta**: prerelease tags (`vYYYY.M.D-beta.N`), npm dist-tag `beta` (macOS app may be missing).
- **dev**: moving head of `main`, npm dist-tag `dev` (when published).

Switch channels (git + npm): `kova update --channel stable|beta|dev`.
Details: [Development channels](https://docs.neuralstudio.in/install/development-channels).

## Agent workspace + skills

- Workspace root: `~/.kova/workspace` (configurable via `agents.defaults.workspace`).
- Injected prompt files: `AGENTS.md`, `SOUL.md`, `TOOLS.md`.
- Skills: `~/.kova/workspace/skills/<skill>/SKILL.md`.

## Configuration

Minimal `~/.kova/kova.json` (model + defaults):

```json5
{
  agent: {
    model: "<provider>/<model-id>",
  },
}
```

[Full configuration reference (all keys + examples).](https://docs.neuralstudio.in/gateway/configuration)

## Community

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, maintainers, and how to submit PRs.
AI/vibe-coded PRs welcome! 🤖
