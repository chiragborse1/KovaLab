---
summary: "Overview of Kova onboarding options and flows"
read_when:
  - Choosing an onboarding path
  - Setting up a new environment
title: "Onboarding overview"
sidebarTitle: "Onboarding Overview"
---

Kova has two onboarding paths. Both configure auth, workspace identity, and the
local agent. CLI onboarding is terminal-first; Gateway, channels, apps, and the
Control UI are optional follow-up surfaces.

## Which path should I use?

|                | CLI onboarding                              | macOS app onboarding      |
| -------------- | ------------------------------------------- | ------------------------- |
| **Platforms**  | macOS, Linux, Windows (native or WSL2)      | macOS only                |
| **Interface**  | Terminal wizard                             | Guided UI in the app      |
| **Best for**   | Terminal-first setup, servers, full control | Desktop Mac, visual setup |
| **Automation** | `--non-interactive` for scripts             | Manual only               |
| **Command**    | `kova onboard`                              | Launch the app            |

Most users should start with **CLI onboarding**. It works everywhere and gets to
`kova chat` before any browser or channel setup.

## What onboarding configures

Regardless of which path you choose, onboarding sets up:

1. **Model provider and auth** — API key, OAuth, or setup token for your chosen provider
2. **Workspace** — directory for agent files, bootstrap templates, and memory
3. **Terminal chat** — first local conversation through `kova chat`
4. **Gateway** (optional) — port, bind address, auth mode for always-on and remote access
5. **Channels** (optional) — built-in and bundled chat channels such as
   BlueBubbles, Discord, Feishu, Google Chat, Mattermost, Microsoft Teams,
   Telegram, WhatsApp, and more
6. **Daemon** (optional) — background service so the Gateway starts automatically

## CLI onboarding

Run in any terminal:

```bash
kova onboard
```

Add `--install-daemon` to also install the background service in one step.

Full reference: [Onboarding (CLI)](/start/wizard)
CLI command docs: [`kova onboard`](/cli/onboard)

## macOS app onboarding

Open the Kova app. The first-run wizard walks you through the same steps
with a visual interface.

Full reference: [Onboarding (macOS App)](/start/onboarding)

## Custom or unlisted providers

If your provider is not listed in onboarding, choose **Custom Provider** and
enter:

- API compatibility mode (OpenAI-compatible, Anthropic-compatible, or auto-detect)
- Base URL and API key
- Model ID and optional alias

Multiple custom endpoints can coexist — each gets its own endpoint ID.

## Related

- [Getting started](/start/getting-started)
- [CLI setup reference](/start/wizard-cli-reference)
