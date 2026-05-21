---
summary: "CLI reference for `kova control-ui`"
read_when:
  - You want to open the Control UI with your current token
  - You want to print the URL without launching a browser
title: "Control UI command"
---

# `kova control-ui`

Open the optional browser Control UI using your current auth. For daily chat,
use `kova chat`; the Control UI is the advanced/admin browser surface.

```bash
kova control-ui
kova control-ui --no-open
```

Notes:

- `control-ui` resolves configured `gateway.auth.token` SecretRefs when token auth is active.
- The old `dashboard` CLI alias is no longer registered; scripts should call `control-ui`.
- If `gateway.auth.mode` is `"password"`, the command opens/copies a plain URL; enter the gateway password in Control UI settings.
- The command follows `gateway.tls.enabled`: TLS-enabled gateways print/open
  `https://` Control UI URLs and connect over `wss://`.
- For SecretRef-managed tokens (resolved or unresolved), the command prints/copies/opens a non-tokenized URL to avoid exposing external secrets in terminal output, clipboard history, or browser-launch arguments.
- If `gateway.auth.token` is SecretRef-managed but unresolved in this command path, the command prints a non-tokenized URL and explicit remediation guidance instead of embedding an invalid token placeholder.

## Related

- [CLI reference](/cli)
- [Control UI](/web/control-ui)
- [Terminal UI](/cli/tui)
