---
summary: "CLI onboarding: guided setup for terminal chat, workspace, memory, and skills"
read_when:
  - Running or configuring CLI onboarding
  - Setting up a new machine
title: "Onboarding (CLI)"
sidebarTitle: "Onboarding: CLI"
---

CLI onboarding is the **recommended** way to shape a new Kova instance on macOS,
Linux, or Windows (via WSL2; strongly recommended). The default path is direct:
choose a workspace, choose model/auth, configure a chat channel or skip it, then
start terminal chat. Kova keeps safe local Gateway defaults in the background
for channel and service features. Optional setup comes after that; when you
choose it, Kova walks through web recall, skills, plugins, and automation
directly. Full Gateway/service settings stay in the extras path.

```bash
kova onboard
```

Onboarding opens with a short setup screen and then goes straight into the base
prompts. It does not redirect returning users into Settings.

<Info>
Fastest first chat: run `kova`. It uses the embedded local agent runtime,
so no browser, Gateway, or chat channel is required.
</Info>

To reconfigure later:

```bash
kova settings
kova configure
kova agents add <name>
```

For routine edits after setup, use `kova settings`. Plain `kova onboard`
continues to run onboarding so you can re-walk the setup flow intentionally.

<Note>
`--json` does not imply non-interactive mode. For scripts, use `--non-interactive`.
</Note>

<Tip>
Setup Extras includes a web recall module where you can pick a provider such as
Brave, DuckDuckGo, Exa, Firecrawl, Gemini, Grok, Kimi, MiniMax Search, Ollama
Web Search, Perplexity, SearXNG, or Tavily. Some providers require an API key,
while others are key-free. You can also configure this later with `kova
configure --section web`. Docs: [Web tools](/tools/web).
</Tip>

## Base Flow vs Advanced

Onboarding starts with the same base flow for new and returning users:

<Tabs>
  <Tab title="Base flow">
    - Pick or keep the workspace.
    - Pick model/auth and then a default model.
    - Configure a chat app or skip for now.
    - Keep Gateway networking on safe local defaults in the background.
    - Open terminal chat or finish without launching.
  </Tab>
  <Tab title="Advanced setup">
    - Runs only after the base prompts unless you pass `--flow extras`.
    - Walks through web recall, skills, plugins, and automation in order.
    - `kova onboard --flow extras` remains the selective module picker for always-on Gateway/service, channels, and later focused edits.
  </Tab>
</Tabs>

## What onboarding configures

**Local mode (default)** walks you through these steps:

1. **Workspace** — Location for agent files (default `~/.kova/workspace`). Seeds bootstrap files.
2. **Model binding** — choose any supported provider/auth flow (API key, OAuth, or provider-specific manual auth), including Custom Provider
   (OpenAI-compatible, Anthropic-compatible, or Unknown auto-detect). Pick a default model.
   Security note: if this agent will run tools or process webhook/hooks content, prefer the strongest latest-generation model available and keep tool policy strict. Weaker/older tiers are easier to prompt-inject.
   For non-interactive runs, `--secret-input-mode ref` stores env-backed refs in auth profiles instead of plaintext API key values.
   In non-interactive `ref` mode, the provider env var must be set; passing inline key flags without that env var fails fast.
   In interactive runs, choosing secret reference mode lets you point at either an environment variable or a configured provider ref (`file` or `exec`), with a fast preflight validation before saving.
   For Anthropic, interactive onboarding/configure offers **Anthropic Claude CLI** as the preferred local path and **Anthropic API key** as the recommended production path. Anthropic setup-token also remains available as a supported token-auth path.
3. **Chat apps** — Configure one chat app now or skip and add channels later with `kova channels add`.
4. **Gateway defaults** — Kova keeps loopback Gateway defaults for channels, pairing, nodes, cron, and remote service features without asking for a port in the first-run flow.
5. **Optional setup** — Optional. If you choose it, Kova runs web recall, skill dependencies, plugin settings, and automation hooks directly.
6. **Gateway access** — In `kova onboard --flow extras`, configure bind address, port, auth mode, Tailscale access, and always-on service behavior.
   In interactive token mode, choose default plaintext token storage or opt into SecretRef.
   Non-interactive token SecretRef path: `--gateway-token-ref-env <ENV_VAR>`.
7. **Background service** — Extras can install a LaunchAgent (macOS), systemd user unit (Linux/WSL2), or native Windows Scheduled Task with per-user Startup-folder fallback when you select always-on Gateway.
   If token auth requires a token and `gateway.auth.token` is SecretRef-managed, daemon install validates it but does not persist the resolved token into supervisor service environment metadata.
   If token auth requires a token and the configured token SecretRef is unresolved, daemon install is blocked with actionable guidance.
   If both `gateway.auth.token` and `gateway.auth.password` are configured and `gateway.auth.mode` is unset, daemon install is blocked until mode is set explicitly.
8. **Health check** — Extras verify the Gateway only when always-on Gateway is selected or a service install is requested.
9. **Start** — Opens Terminal chat by default or finishes without launching.

<Note>
Re-running onboarding does **not** wipe anything unless you explicitly choose **Reset** (or pass `--reset`).
CLI `--reset` defaults to config, credentials, and sessions; use `--reset-scope full` to include workspace.
If the config is invalid or contains legacy keys, onboarding asks you to run `kova doctor` first.
</Note>

**Remote mode** only configures the local client to connect to a Gateway elsewhere.
It does **not** install or change anything on the remote host.

## Add another agent

Use `kova agents add <name>` to create a separate agent with its own workspace,
sessions, and auth profiles. Running without `--workspace` launches onboarding.

What it sets:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

Notes:

- Default workspaces follow `~/.kova/workspace-<agentId>`.
- Add `bindings` to route inbound messages (onboarding can do this).
- Non-interactive flags: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## Full reference

For detailed step-by-step breakdowns and config outputs, see
[CLI Setup Reference](/start/wizard-cli-reference).
For non-interactive examples, see [CLI Automation](/start/wizard-cli-automation).
For the deeper technical reference, including RPC details, see
[Onboarding Reference](/reference/wizard).

## Related docs

- CLI command reference: [`kova onboard`](/cli/onboard)
- Onboarding overview: [Onboarding Overview](/start/onboarding-overview)
- macOS app onboarding: [Onboarding](/start/onboarding)
- Agent first-run ritual: [Agent Bootstrapping](/start/bootstrapping)
