---
summary: "Security model, hardening checklist, and operational safety guide for Kova"
read_when:
  - Adding features that widen access or automation
  - Exposing the Gateway beyond localhost
  - Connecting chat channels, tools, plugins, nodes, or browser control
title: "Security"
---

<Warning>
  Kova is a personal assistant runtime, not a hostile multi-tenant security
  boundary. Run one trust boundary per Gateway. If users do not fully trust each
  other, split them across separate gateways, credentials, OS users, hosts, or
  containers.
</Warning>

## Security model

Kova connects an AI agent to real tools:

- local files and shell commands
- browser and web access
- chat channels and group messages
- scheduled jobs and background tasks
- plugins, skills, nodes, and external services

The safe default is simple: **one owner, one trust boundary, local access first**.
Add remote access, channels, groups, and broad tools only after the basic terminal
agent works.

Kova security is built from layers:

| Layer           | What it protects                    | Main controls                                                   |
| --------------- | ----------------------------------- | --------------------------------------------------------------- |
| Gateway auth    | Who can reach the control plane     | `gateway.auth`, token/password, trusted proxy, device pairing   |
| Channel access  | Who can trigger the agent from chat | `dmPolicy`, allowlists, group mention gates                     |
| Session routing | Which context receives a message    | `session.dmScope`, session keys, thread bindings                |
| Tool policy     | What the agent can call             | `tools.profile`, `tools.allow`, `tools.deny`, plugin allowlists |
| Exec policy     | Whether shell commands may run      | `tools.exec.security`, approvals, elevated mode                 |
| Sandbox         | Where risky work runs               | Docker, SSH, OpenShell, per-agent sandbox mode                  |
| Secrets         | Where credentials live              | SecretRefs, env, credential files, state permissions            |

No single layer is magic. Use several small controls instead of one giant trust
assumption.

## Fast hardening path

Run these after install and after major config changes:

```bash
kova doctor
kova security audit
kova security audit --deep
```

If the audit finds common footguns, apply the narrow auto-fixes:

```bash
kova security audit --fix
```

The fix mode is intentionally conservative. It tightens common open policies,
restores sensitive-log redaction, and repairs local state/config permissions
where the platform supports it.

## Recommended baseline

Use this posture until you know you need more:

- Keep the Gateway on loopback: `gateway.mode: "local"` and `gateway.bind: "loopback"`.
- Use token or password auth for the Gateway.
- Keep DM pairing enabled on chat channels.
- Require mentions in groups.
- Use `session.dmScope: "per-channel-peer"` for shared inboxes.
- Keep filesystem access workspace-limited where possible.
- Keep shell execution denied or approval-gated for shared sessions.
- Run non-main and group-triggered sessions in a sandbox.
- Load only plugins and skills you intentionally use.
- Prefer modern strong models for tool-enabled agents.

Example baseline:

```json5
{
  gateway: {
    mode: "local",
    bind: "loopback",
    auth: {
      mode: "token",
      token: "replace-with-long-random-token",
    },
  },
  session: {
    dmScope: "per-channel-peer",
  },
  tools: {
    profile: "messaging",
    fs: {
      workspaceOnly: true,
    },
    exec: {
      security: "deny",
      ask: "always",
    },
    elevated: {
      enabled: false,
    },
  },
}
```

## Inbound messages

Every inbound message is untrusted input, even from people you know. A message
can include instructions, copied website text, quoted replies, forwarded
metadata, or malicious content.

Use these rules:

- DMs: keep `dmPolicy: "pairing"` or use explicit allowlists.
- Groups: require mentions and restrict allowed rooms/channels.
- Public channels: do not expose tool-enabled agents to everyone.
- Shared inboxes: use per-sender sessions with `session.dmScope`.
- Unknown senders: approve deliberately with `kova pairing approve`.

Allowlists decide who can trigger the agent. Context visibility decides what
extra thread or quoted content is injected into the model:

- `contextVisibility: "all"` keeps supplemental context as received.
- `contextVisibility: "allowlist"` keeps supplemental context only from allowed senders.
- `contextVisibility: "allowlist_quote"` also keeps one explicit quoted reply.

See [Group Chats](/channels/groups#context-visibility-and-allowlists).

## Tools and permissions

Tool access is the main blast-radius control. A harmless chat bot becomes a
powerful agent when it can use files, shell, browser, nodes, messaging, or cron.

Inspect the current runtime from the terminal:

```bash
kova permissions
kova config get tools
kova exec-policy show
```

Inside the TUI:

```text
/permissions
/tools
/plugins
```

Safer defaults for shared or channel-triggered agents:

- use a smaller tool profile
- deny runtime, filesystem, automation, and node groups until needed
- keep `tools.fs.workspaceOnly: true`
- keep elevated exec off
- ask before shell commands
- run risky agents in a sandbox

## Exec and elevated mode

Shell execution is operator-level power. Treat it like access to the host.

Recommended posture:

- Personal local terminal: broad exec can be acceptable if you understand the risk.
- Chat channels: ask before exec or deny exec.
- Groups: deny exec unless the group is fully trusted.
- Automation: keep allowlists narrow.
- Remote nodes: treat node exec like shell access on that device.

Useful commands:

```bash
kova exec-policy show
kova exec-policy preset cautious
kova approvals get
kova sandbox explain
```

Elevated mode is not a general permission system. It only changes whether the
agent may request host-level exec outside the normal sandbox or approval path.

## Sandbox

Use sandboxes when one agent should not receive the same host access as your main
local session.

Common setup:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        backend: "docker",
      },
    },
  },
}
```

Sandboxing helps reduce damage from prompt injection or accidental tool use. It
does not replace Gateway auth, channel allowlists, or careful secret handling.

See [Sandboxing](/gateway/sandboxing).

## Gateway exposure

Loopback is the safest mode. Before binding to LAN or public interfaces, make
sure you understand the control-plane risk.

Safe remote patterns:

- Tailscale Serve over HTTPS
- private VPN
- SSH tunnel
- reverse proxy with trusted headers configured correctly
- strong token/password auth

Avoid:

- public unauthenticated Gateway access
- weak or short tokens
- exposing browser control ports
- trusting arbitrary proxy headers
- using Tailscale Funnel unless you intentionally want public access

Useful pages:

- [Remote access](/gateway/remote)
- [Tailscale](/gateway/tailscale)
- [Trusted proxy auth](/gateway/trusted-proxy-auth)

## Browser and nodes

Browser control and nodes are powerful because they touch signed-in sessions,
screens, cameras, devices, and local apps.

Use a dedicated browser profile for Kova when possible. Do not connect a shared
or public agent to your personal browser profile.

For nodes:

- pair only devices you trust
- review node command policy
- avoid auto-approval outside trusted private networks
- revoke stale devices

```bash
kova devices list
kova devices revoke <id>
kova nodes status
```

## Secrets

Prefer environment-backed or SecretRef-backed credentials over plaintext config
when possible.

Important local paths:

- Config: `~/.kova/kova.json`
- Channel credentials: `~/.kova/credentials`
- Model auth profiles: `~/.kova/agents/<agentId>/agent/auth-profiles.json`
- Optional secret store: `~/.kova/secrets.json`
- Workspace: `~/.kova/workspace`

Run:

```bash
kova secrets audit
kova security audit --deep
```

See [Secrets](/gateway/secrets) and [SecretRef credential surface](/reference/secretref-credential-surface).

## Plugins and skills

Plugins and skills extend what Kova can do. Treat them like code and procedures
you are delegating to your agent.

Use these habits:

- keep plugin allowlists explicit
- install plugins from trusted sources
- inspect skill requirements before enabling them
- avoid giving unknown skills broad shell or filesystem access
- keep KovaHub or external marketplace installs reviewable

Commands:

```bash
kova plugins list
kova plugins doctor
kova skills list
kova skills check
```

## Shared and team setups

Kova can serve a team when the team is one trust boundary and the runtime is
business-scoped.

Safer team pattern:

- dedicated host or VM
- dedicated OS user
- dedicated browser profile
- dedicated channel accounts
- strict channel allowlists
- sandbox non-main sessions
- minimal tool set

Avoid mixing personal accounts and company/shared agents on the same runtime.

If users are mutually untrusted, do not share one Gateway. Split the deployment.

## Not vulnerabilities by themselves

These usually need an actual boundary bypass before they are treated as security
bugs:

- prompt-injection-only reports with no policy, auth, sandbox, or approval bypass
- claims that assume one Gateway is a hostile multi-tenant boundary
- localhost-only hardening gaps on loopback-only deployments
- reports that treat `sessionKey` as an authorization token
- normal operator read access such as session lists or chat history
- configured debug or dangerous flags when explicitly enabled by the operator
- disabled-by-default auto-approval settings that require explicit allowlists

Still report issues when you can demonstrate a real bypass of documented auth,
policy, sandbox, approval, or secret boundaries.

## Dangerous flags

`kova security audit` warns when known dangerous switches are enabled. Keep these
off unless you are actively debugging and can revert quickly.

Examples:

- `gateway.controlUi.allowInsecureAuth`
- `gateway.controlUi.dangerouslyDisableDeviceAuth`
- `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback`
- `browser.ssrfPolicy.dangerouslyAllowPrivateNetwork`
- `tools.exec.applyPatch.workspaceOnly=false`
- `plugins.entries.acpx.config.permissionMode=approve-all`
- channel `dangerouslyAllowNameMatching` flags
- sandbox Docker `dangerouslyAllow*` flags

For the full check catalog, see [Security audit checks](/gateway/security/audit-checks).

## Triage checklist

When something feels risky, handle it in this order:

1. Lock down who can trigger the agent.
2. Remove tools the agent does not need.
3. Sandbox non-main or shared sessions.
4. Fix public Gateway exposure.
5. Rotate weak or exposed tokens.
6. Review plugins and skills.
7. Run `kova security audit --deep`.

Small, boring controls beat one big heroic setting.
