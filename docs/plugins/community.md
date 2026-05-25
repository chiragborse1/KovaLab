---
summary: "Community-maintained Kova plugins: browse, install, and submit your own"
read_when:
  - You want to find third-party Kova plugins
  - You want to publish or list your own plugin
title: "Community plugins"
---

Community plugins are third-party packages that extend Kova with new
channels, tools, providers, or other capabilities. They are built and maintained
by the community and installable from npm, local paths, archives, or marketplace
entries.

```bash
kova plugins install <package-name>
```

KovaHub is planned for a future Kova-owned marketplace. It is not an active
install or publish path in this build.

## Listed plugins

### Apify

Scrape data from any website with 20,000+ ready-made scrapers. Let your agent
extract data from Instagram, Facebook, TikTok, YouTube, Google Maps, Google
Search, e-commerce sites, and more — just by asking.

- **npm:** `@apify/apify-kova-plugin`
- **repo:** [github.com/apify/apify-kova-plugin](https://github.com/apify/apify-kova-plugin)

```bash
kova plugins install @apify/apify-kova-plugin
```

### Codex App Server Bridge

Independent Kova bridge for Codex App Server conversations. Bind a chat to
a Codex thread, talk to it with plain text, and control it with chat-native
commands for resume, planning, review, model selection, compaction, and more.

- **npm:** `kova-codex-app-server`
- **repo:** [github.com/pwrdrvr/kova-codex-app-server](https://github.com/pwrdrvr/kova-codex-app-server)

```bash
kova plugins install kova-codex-app-server
```

### DingTalk

Enterprise robot integration using Stream mode. Supports text, images, and
file messages via any DingTalk client.

- **npm:** `@largezhou/ddingtalk`
- **repo:** [github.com/largezhou/kova-dingtalk](https://github.com/largezhou/kova-dingtalk)

```bash
kova plugins install @largezhou/ddingtalk
```

### Lossless Claw (LCM)

Lossless Context Management plugin for Kova. DAG-based conversation
summarization with incremental compaction — preserves full context fidelity
while reducing token usage.

- **npm:** `@martian-engineering/lossless-claw`
- **repo:** [github.com/Martian-Engineering/lossless-claw](https://github.com/Martian-Engineering/lossless-claw)

```bash
kova plugins install @martian-engineering/lossless-claw
```

### Opik

Official plugin that exports agent traces to Opik. Monitor agent behavior,
cost, tokens, errors, and more.

- **npm:** `@opik/opik-kova`
- **repo:** [github.com/comet-ml/opik-kova](https://github.com/comet-ml/opik-kova)

```bash
kova plugins install @opik/opik-kova
```

### Prometheus Avatar

Give your Kova agent a Live2D avatar with real-time lip-sync, emotion
expressions, and text-to-speech. Includes creator tools for AI asset generation
and one-click deployment to the Prometheus Marketplace. Currently in alpha.

- **npm:** `@prometheusavatar/kova-plugin`
- **repo:** [github.com/myths-labs/prometheus-avatar](https://github.com/myths-labs/prometheus-avatar)

```bash
kova plugins install @prometheusavatar/kova-plugin
```

### QQbot

Connect Kova to QQ via the QQ Bot API. Supports private chats, group
mentions, channel messages, and rich media including voice, images, videos,
and files.

Current Kova releases bundle QQ Bot. Use the bundled setup in
[QQ Bot](/channels/qqbot) for normal installs; install this external plugin only
when you intentionally want the Tencent-maintained standalone package.

- **npm:** `@tencent-connect/kova-qqbot`
- **repo:** [github.com/tencent-connect/kova-qqbot](https://github.com/tencent-connect/kova-qqbot)

```bash
kova plugins install @tencent-connect/kova-qqbot
```

### wecom

WeCom channel plugin for Kova by the Tencent WeCom team. Powered by
WeCom Bot WebSocket persistent connections, it supports direct messages & group
chats, streaming replies, proactive messaging, image/file processing, Markdown
formatting, built-in access control, and document/meeting/messaging skills.

- **npm:** `@wecom/wecom-kova-plugin`
- **repo:** [github.com/WecomTeam/wecom-kova-plugin](https://github.com/WecomTeam/wecom-kova-plugin)

```bash
kova plugins install @wecom/wecom-kova-plugin
```

## Submit your plugin

We welcome community plugins that are useful, documented, and safe to operate.

<Steps>
  <Step title="Publish to npm">
    Your plugin must be installable via `kova plugins install \<package-name\>`.
    Publish it to npm or distribute it as a local/archive package.
    See [Building Plugins](/plugins/building-plugins) for the full guide.

  </Step>

  <Step title="Host on GitHub">
    Source code must be in a public repository with setup docs and an issue
    tracker.

  </Step>

  <Step title="Use docs PRs only for source-doc changes">
    Open a docs PR only when Kova's source docs need an actual content
    change, such as correcting install guidance or adding cross-repo
    documentation that belongs in the main docs set.

  </Step>
</Steps>

## Quality bar

| Requirement                          | Why                                         |
| ------------------------------------ | ------------------------------------------- |
| Published on npm or packaged locally | Users need `kova plugins install` to work   |
| Public GitHub repo                   | Source review, issue tracking, transparency |
| Setup and usage docs                 | Users need to know how to configure it      |
| Active maintenance                   | Recent updates or responsive issue handling |

Low-effort wrappers, unclear ownership, or unmaintained packages may be declined.

## Related

- [Install and Configure Plugins](/tools/plugin) — how to install any plugin
- [Building Plugins](/plugins/building-plugins) — create your own
- [Plugin Manifest](/plugins/manifest) — manifest schema
