---
summary: "WeChat channel setup through the external kova-weixin plugin"
read_when:
  - You want to connect Kova to WeChat or Weixin
  - You are installing or troubleshooting the kova-weixin channel plugin
  - You need to understand how external channel plugins run beside the Gateway
title: "WeChat"
---

Kova connects to WeChat through Tencent's external
`@tencent-weixin/kova-weixin` channel plugin.

Status: external plugin. Direct chats and media are supported. Group chats are not
advertised by the current plugin capability metadata.

## Naming

- **WeChat** is the user-facing name in these docs.
- **Weixin** is the name used by Tencent's package and by the plugin id.
- `kova-weixin` is the Kova channel id.
- `@tencent-weixin/kova-weixin` is the npm package.

Use `kova-weixin` in CLI commands and config paths.

## How it works

The WeChat code does not live in the Kova core repo. Kova provides the
generic channel plugin contract, and the external plugin provides the
WeChat-specific runtime:

1. `kova plugins install` installs `@tencent-weixin/kova-weixin`.
2. The Gateway discovers the plugin manifest and loads the plugin entrypoint.
3. The plugin registers channel id `kova-weixin`.
4. `kova channels login --channel kova-weixin` starts QR login.
5. The plugin stores account credentials under the Kova state directory.
6. When the Gateway starts, the plugin starts its Weixin monitor for each
   configured account.
7. Inbound WeChat messages are normalized through the channel contract, routed to
   the selected Kova agent, and sent back through the plugin outbound path.

That separation matters: Kova core should stay channel-agnostic. WeChat login,
Tencent iLink API calls, media upload/download, context tokens, and account
monitoring are owned by the external plugin.

## Install

Quick install:

```bash
npx -y @tencent-weixin/kova-weixin-cli install
```

Manual install:

```bash
kova plugins install "@tencent-weixin/kova-weixin"
kova config set plugins.entries.kova-weixin.enabled true
```

Restart the Gateway after install:

```bash
kova gateway restart
```

## Login

Run QR login on the same machine that runs the Gateway:

```bash
kova channels login --channel kova-weixin
```

Scan the QR code with WeChat on your phone and confirm the login. The plugin saves
the account token locally after a successful scan.

To add another WeChat account, run the same login command again. For multiple
accounts, isolate direct-message sessions by account, channel, and sender:

```bash
kova config set session.dmScope per-account-channel-peer
```

## Access control

Direct messages use the normal Kova pairing and allowlist model for channel
plugins.

Approve new senders:

```bash
kova pairing list kova-weixin
kova pairing approve kova-weixin <CODE>
```

For the full access-control model, see [Pairing](/channels/pairing).

## Compatibility

The plugin checks the host Kova version at startup.

| Plugin line | Kova version            | npm tag  |
| ----------- | ----------------------- | -------- |
| `2.x`       | `>=2026.3.22`           | `latest` |
| `1.x`       | `>=2026.1.0 <2026.3.22` | `legacy` |

If the plugin reports that your Kova version is too old, either update
Kova or install the legacy plugin line:

```bash
kova plugins install @tencent-weixin/kova-weixin@legacy
```

## Sidecar process

The WeChat plugin can run helper work beside the Gateway while it monitors the
Tencent iLink API. In issue #68451, that helper path exposed a bug in Kova's
generic stale-Gateway cleanup: a child process could try to clean up the parent
Gateway process, causing restart loops under process managers such as systemd.

Current Kova startup cleanup excludes the current process and its ancestors,
so a channel helper must not kill the Gateway that launched it. This fix is
generic; it is not a WeChat-specific path in core.

## Troubleshooting

Check install and status:

```bash
kova plugins list
kova channels status --probe
kova --version
```

If the channel shows as installed but does not connect, confirm that the plugin is
enabled and restart:

```bash
kova config set plugins.entries.kova-weixin.enabled true
kova gateway restart
```

If the Gateway restarts repeatedly after enabling WeChat, update both Kova and
the plugin:

```bash
npm view @tencent-weixin/kova-weixin version
kova plugins install "@tencent-weixin/kova-weixin" --force
kova gateway restart
```

Temporary disable:

```bash
kova config set plugins.entries.kova-weixin.enabled false
kova gateway restart
```

## Related docs

- Channel overview: [Chat Channels](/channels)
- Pairing: [Pairing](/channels/pairing)
- Channel routing: [Channel Routing](/channels/channel-routing)
- Plugin architecture: [Plugin Architecture](/plugins/architecture)
- Channel plugin SDK: [Channel Plugin SDK](/plugins/sdk-channel-plugins)
- External package: [@tencent-weixin/kova-weixin](https://www.npmjs.com/package/@tencent-weixin/kova-weixin)
