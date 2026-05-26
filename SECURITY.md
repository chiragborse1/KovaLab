# Security Policy

If you believe you found a security issue in Kova, report it privately first.

Kova is local-first agent software. It can read files, call tools, run commands,
connect chat channels, and act through accounts you configure. That power is the
point of the product, so security reports are triaged against Kova's actual
trust boundaries, not against the idea that every model output is trusted.

## Report a Security Issue

Use a private GitHub Security Advisory for this repository:

https://github.com/chiragborse1/KovaLab/security/advisories/new

If GitHub advisories do not fit the report, contact:

security@neuralstudio.in

Do not open a public issue, pull request, discussion, or Discord thread that
contains an unpatched vulnerability, exploit path, secret, or security-sensitive
proof of concept.

## Supported Versions

Kova is currently in beta. Security fixes target:

- the latest published npm `beta` release,
- the latest promoted npm `latest` release,
- the current `main` branch when the issue is not yet released.

Old dev snapshots and local source checkouts are not supported as separate
security release lines, but reports against them are useful when they reproduce
on current `main` or the latest published package.

## What to Include

A useful report includes:

- A short title and severity assessment.
- Affected component, file path, and line range when known.
- Kova version, commit SHA, install method, OS, Node version, and relevant config.
- Reproduction steps against current `main` or the latest published release.
- Demonstrated impact.
- The trust boundary crossed.
- Why the report is not covered by the out-of-scope section below.
- Suggested fix or mitigation, if you have one.

For dependency CVEs, include evidence that Kova ships the affected version and
that the issue is reachable through Kova with real impact. Scanner output alone
is not enough.

## Trust Model

Kova is a personal agent by default: one trusted operator, one local Kova home,
and one Gateway for that operator.

Kova does not treat one Gateway as a hostile multi-tenant boundary between
adversarial users. If multiple people can message the same tool-enabled agent,
they share the delegated authority granted to that agent unless you isolate
them with separate hosts, OS users, gateways, agents, credentials, and tool
policies.

Security boundaries come from:

- OS user and host isolation.
- Gateway authentication.
- Channel pairing and allowlists.
- Tool allow/deny policy.
- Exec approvals.
- Sandbox runtimes.
- Plugin install and load policy.
- Secret storage and credential routing.

Security boundaries do not come from:

- The model behaving honestly.
- Prompt wording.
- Session names or session IDs.
- In-process string heuristics.
- A trusted plugin promising to be harmless.
- A shared Gateway pretending to separate mutually hostile users.

## Operator Boundary

Authenticated Gateway callers are trusted operators for that Gateway instance.

Shared-secret Gateway auth, including token and password auth, grants operator
access to the Gateway HTTP and WebSocket surfaces. The OpenAI-compatible HTTP
endpoints and direct tool invocation endpoint are operator surfaces, not
fine-grained per-user authorization layers.

Session identifiers are routing handles. They are not authorization boundaries.

If you need isolation between people, run separate Kova instances by trust
boundary. Prefer separate hosts, VPS instances, containers, or OS users, with
separate credentials.

## Agent and Prompt-Injection Assumptions

The model is not a trusted principal. Treat messages, websites, files, tool
results, MCP responses, and channel content as attacker-influenced input.

Prompt injection is expected in any tool-enabled agent. A prompt-injection-only
chain is not a Kova vulnerability unless it bypasses a documented boundary such
as auth, allowlists, approvals, sandboxing, tool policy, or credential routing.

Use stronger models, narrow tool profiles, sandboxing, approvals, and separate
sessions for untrusted channels.

## Plugins and Skills

Plugins run as trusted code inside the Kova process or adjacent runtime. A
plugin can read, execute, register hooks, call runtime helpers, and access the
resources granted to the Kova process.

Installing or enabling a plugin means you trust that plugin.

A malicious trusted-installed plugin is not by itself a Kova vulnerability. A
bug in Kova that loads a plugin without authorization, ignores plugin policy,
misrepresents what is being installed, or lets a plugin escape a declared
sandbox or policy boundary is in scope.

Skills are also trusted instructions and, depending on their contents, may cause
the agent to run commands or call tools. Review third-party skills before use.

## In Scope

Security reports are in scope when they demonstrate one of these:

- Bypass of Gateway auth, channel pairing, allowlists, or trusted-proxy checks.
- Bypass of exec approvals, sandbox policy, tool allow/deny policy, or elevated-mode gates.
- Secret or credential leakage caused by Kova where the secret should have been withheld.
- Plugin install, update, discovery, or loading behavior that violates configured policy.
- Path traversal, archive extraction, file write, or media handling bug reachable from an untrusted boundary with demonstrated impact.
- Cross-boundary channel behavior where an unauthorized sender can dispatch work, resolve approvals, or receive private output.
- A released package or installer behavior that exposes secrets, weakens auth, or installs unexpected executable code.
- A documentation or product claim that says a boundary exists when the shipped code does not enforce it.

## Usually Out of Scope

These are normally not security vulnerabilities by themselves:

- Prompt injection without a boundary bypass.
- A trusted operator intentionally running commands, enabling tools, installing plugins, or exposing the Gateway.
- A malicious plugin or skill after a trusted operator installs it.
- Multiple mutually untrusted users sharing one Gateway and expecting isolation.
- Public internet exposure that ignores Kova's local-first deployment guidance.
- Missing HSTS on loopback/local deployments.
- Scanner-only findings without a working reproduction and Kova-specific impact.
- Dependency-only findings without proof that the shipped package is affected and reachable.
- Reports against tests, fixtures, benchmark rigs, local repro harnesses, or maintainer-only tooling unless the same bug is reachable in shipped production code.
- Reports that rely on pre-existing trusted local filesystem tampering under `~/.kova`, the configured workspace, or an already-approved executable path.
- Resource-use reports that only show extra CPU, memory, decoding, transcoding, serialization, or base64 work after input has already passed Kova's configured acceptance limits, unless they demonstrate unauthenticated amplification, persistent exhaustion, crash, data exposure, or another boundary bypass.

When unsure, report privately. We would rather route a careful report than miss
a real issue.

## Recommended Secure Defaults

For personal use:

- Keep the Gateway bound to loopback unless you need remote access.
- Use Gateway token or password auth.
- Use channel pairing or allowlists.
- Require mentions in group chats.
- Keep broad tools off in shared or group sessions.
- Use sandbox mode for non-main or untrusted sessions.
- Keep plugins and skills allowlisted where possible.
- Store secrets through Kova credentials or environment-backed secret sources,
  not in prompts or public config.
- Run `kova security audit --deep` after setup changes.

For shared or team use:

- Use a dedicated host, VM, container, or OS user per trust boundary.
- Use dedicated provider, channel, browser, and workspace credentials.
- Keep personal browser profiles and personal files away from shared agents.
- Prefer sandboxed runtimes and explicit tool allowlists.
- Treat group chats as untrusted input.

## Gateway and Remote Access

The Gateway is the control plane for channels, nodes, cron, and remote access.
Do not expose it directly to the public internet.

Preferred remote access:

- SSH tunnel.
- Tailscale or another private network.
- Reverse proxy only when you understand the auth, origin, TLS, and trusted
  proxy settings.

Keep non-loopback deployments explicit and audited. Risky `dangerous*` or
`dangerously*` options are break-glass operator decisions and are not security
bugs by themselves.

## Docker and Sandboxing

Docker, SSH, OpenShell, node hosts, and elevated mode are different execution
postures. Make sure you know which one is active before treating a session as
isolated.

Sandboxing reduces what tool execution can reach. It does not make the model
trusted, and it does not make a shared Gateway into a hostile multi-tenant
service.

## Disclosure Handling

We aim to acknowledge high-signal reports quickly, reproduce the issue, decide
scope, prepare a fix, and publish an advisory when appropriate.

Low-signal reports may be closed or deprioritized when they lack reproduction,
impact, affected version, or a boundary-crossing explanation.

Duplicate reports may be closed in favor of the earliest high-quality canonical
report.

## Bug Bounty

Kova does not currently run a paid bug bounty program. Responsible disclosure is
still appreciated and helps us protect users before public release.
