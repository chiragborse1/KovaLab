---
title: "Kova Capability Matrices"
summary: "Docs-derived capability matrices for channels, tools, runtimes, and memory backends"
read_when:
  - You need a high-level inventory of what Kova can already do
  - You are comparing Kova against another agent platform
  - You are deciding which capability gaps are implementation gaps versus documentation or UI gaps
---

## Scope

These matrices are a docs-derived inventory. They are meant to make Kova's
existing capability surface legible before implementation cleanup begins.

Use the linked owner docs as the source of truth for exact setup, limits, and
runtime behavior. Before changing behavior, verify the owner module and targeted
tests.

Manifest-backed ownership can be refreshed with:

```sh
node scripts/plugin-capability-inventory.mjs
node scripts/plugin-capability-inventory.mjs --json
```

That inventory reads tracked `extensions/*/kova.plugin.json` files and reports
channel, provider, CLI backend, skill, command alias, and `contracts.*`
ownership without loading plugin runtime code.

## Legend

| Mark    | Meaning                                                                |
| ------- | ---------------------------------------------------------------------- |
| Yes     | Documented support exists                                              |
| Partial | Support exists with setup limits, channel limits, or narrower behavior |
| No      | Not supported or explicitly absent in docs                             |
| Gap     | The docs do not expose enough product-level capability detail yet      |

## Channel Matrix

| Channel                                    | Text scope                               | Media or files                                              | Reactions                       | Threads or replies                         | Voice or audio                              | Live progress                       | Notes                                                       |
| ------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------- | ------------------------------- | ------------------------------------------ | ------------------------------------------- | ----------------------------------- | ----------------------------------------------------------- |
| [BlueBubbles](/channels/bluebubbles)       | iMessage DMs and groups                  | Yes                                                         | Yes, tapbacks                   | Partial, reply references                  | Yes, voice memo output                      | Typing plus opt-in block streaming  | Recommended iMessage path                                   |
| [Discord](/channels/discord)               | DMs, guild channels, forum/media threads | Yes                                                         | Yes                             | Yes, including thread bindings             | Yes, voice channels and voice messages      | Preview/block/progress streaming    | Richest real-time channel surface                           |
| [Feishu/Lark](/channels/feishu)            | DMs, groups, thread messages             | Yes                                                         | Partial, typing reactions/cards | Yes, thread messages and ACP binding       | Yes, voice-note handling                    | Streaming cards and block streaming | Production-ready bot channel                                |
| [Google Chat](/channels/googlechat)        | DMs and spaces                           | Yes, explicit upload action                                 | Yes                             | Partial, thread targeting                  | Gap                                         | Partial, typing indicator styles    | Needs a product-level matrix row in channel docs            |
| [IRC](/channels/irc)                       | DMs and channels                         | No documented rich media                                    | No documented reactions         | No documented native threads               | No                                          | No                                  | Text-first classic chat                                     |
| [LINE](/channels/line)                     | LINE bot conversations                   | Yes, images, video, audio                                   | No                              | No                                         | Yes, audio files                            | Gap                                 | Docs say reactions and threads are not supported            |
| [Matrix](/channels/matrix)                 | DMs, rooms, threads                      | Yes                                                         | Yes                             | Yes                                        | Partial, media/audio attachments            | Partial/quiet streaming             | Includes E2EE, polls, location, and push-rule notes         |
| [Mattermost](/channels/mattermost)         | DMs, channels, groups                    | Yes                                                         | Yes                             | Yes                                        | No documented native voice                  | Preview streaming                   | Thread behavior is configurable                             |
| [Microsoft Teams](/channels/msteams)       | DMs, channels, groups                    | Partial, DM files easy; channel files need Graph/SharePoint | Gap                             | Partial, reply style threads vs posts      | No documented native voice                  | Gap                                 | Enterprise setup has permission-dependent capability tiers  |
| [Nextcloud Talk](/channels/nextcloud-talk) | DMs and rooms                            | Partial, URLs instead of bot uploads                        | Yes                             | Gap                                        | No documented native voice                  | Block streaming config              | Webhook bot limits apply                                    |
| [Nostr](/channels/nostr)                   | Encrypted DMs                            | No                                                          | Gap                             | No                                         | No                                          | No                                  | Optional bundled plugin, text-first                         |
| [QQ Bot](/channels/qqbot)                  | DMs, groups, guild channels              | Yes, rich media                                             | No                              | No                                         | Yes, voice/STT/TTS path                     | Gap                                 | Docs explicitly say reactions and threads are not supported |
| [Signal](/channels/signal)                 | DMs and groups                           | Yes                                                         | Yes                             | No documented native threads               | Yes, voice-note attachments                 | Typing indicators                   | Uses signal-cli                                             |
| [Slack](/channels/slack)                   | DMs, channels, groups                    | Yes                                                         | Yes                             | Yes                                        | No documented native voice                  | Native/draft streaming              | Mature collaboration-channel surface                        |
| [Synology Chat](/channels/synology-chat)   | Direct-message webhook channel           | Gap                                                         | Gap                             | Gap                                        | No documented native voice                  | Gap                                 | Needs richer capability docs if it remains first-class      |
| [Telegram](/channels/telegram)             | DMs, groups, forum topics                | Yes                                                         | Yes                             | Yes, replies/topics/thread binding         | Yes, voice notes                            | Preview/block/progress streaming    | Strong mobile-first channel                                 |
| [Tlon](/channels/tlon)                     | DMs, group mentions, thread replies      | Partial, rich text documented                               | Yes                             | Yes                                        | No documented native voice                  | Gap                                 | Urbit-specific plugin surface                               |
| [Twitch](/channels/twitch)                 | Twitch chat                              | No documented rich media                                    | No documented reactions         | No                                         | No                                          | No                                  | Text-first livestream chat                                  |
| [Voice Call](/plugins/voice-call)          | Phone calls, not chat text               | Audio stream                                                | No                              | No                                         | Yes, full-duplex or streaming transcription | Live audio stream                   | Separate plugin, not a normal messaging channel             |
| [WebChat](/web/webchat)                    | Browser chat over Gateway WS             | Partial, Gateway/media dependent                            | No native reactions             | Session routing, not chat-native threads   | Audio playback depends on payload           | Agent events/tool activity          | Operator/browser surface, not a third-party chat network    |
| [WeChat](/channels/wechat)                 | External plugin, private chats           | Gap                                                         | Gap                             | Gap                                        | Gap                                         | Gap                                 | External plugin docs should own exact matrix row            |
| [WhatsApp](/channels/whatsapp)             | DMs and groups                           | Yes, image/video/audio/document                             | Yes                             | Partial, reply payloads not native threads | Yes, PTT voice notes and STT/TTS            | Gap                                 | Production-ready via WhatsApp Web                           |
| [Zalo](/channels/zalo)                     | Experimental DMs                         | Partial, marketplace-bot limits                             | Gap                             | No documented native threads               | Partial, see capability section             | No, blocked by default              | Experimental                                                |
| [Zalo Personal](/channels/zalouser)        | Experimental personal account            | Yes, text/media/link                                        | Partial                         | No documented native threads               | Gap                                         | Typing event                        | Experimental personal-account automation                    |

Channel matrix follow-ups:

- Move a maintained version of this table into [Chat channels](/channels).
- Add exact per-channel booleans from plugin manifests where available.
- Add a "last live-smoked" column only after targeted channel smoke proof
  exists.

## Tool Matrix

| Capability group        | Main tools or surfaces                                      | Owner                          | Status  | Notes                                                                                        |
| ----------------------- | ----------------------------------------------------------- | ------------------------------ | ------- | -------------------------------------------------------------------------------------------- |
| Runtime execution       | `exec`, `process`                                           | Core plus sandbox/node hosts   | Yes     | Host, sandbox, and node routing depend on tool policy and sandbox config                     |
| Remote analysis         | `code_execution`                                            | Core/tool provider             | Yes     | Sandboxed remote Python analysis path                                                        |
| File I/O                | `read`, `read_many`, `write`, `edit`, `apply_patch`         | Core                           | Yes     | `apply_patch` remains separately gated by exec/apply-patch policy                            |
| Web                     | `web_search`, `x_search`, `web_fetch`                       | Core plus provider plugins     | Yes     | Provider selection is plugin/config-owned                                                    |
| Browser and UI          | `browser`, `canvas`, `nodes`                                | Core plus plugins/nodes        | Yes     | Browser plugin and node pairing carry extra security policy                                  |
| Messaging               | `message`, channel actions, `sessions_send`                 | Gateway/channel plugins        | Yes     | Channel-specific action support varies                                                       |
| Automation              | `cron`, Gateway runtime tool, hooks, Task Flow              | Gateway/core/plugins           | Yes     | Automation product story is now centralized in [Automation and tasks](/automation)           |
| Memory                  | `memory_search`, `memory_get`                               | Active memory plugin           | Yes     | Default is `memory-core`; backends change behavior                                           |
| Sessions and subagents  | `sessions_*`, `subagents`, `agents_list`, `session_status`  | Core/Gateway                   | Yes     | Subagents are background task tracked                                                        |
| Media understanding     | `image`, `pdf`, audio/video media processing                | Core plus media plugins        | Yes     | Exact provider fallback depends on model/media config                                        |
| Media generation        | `image_generate`, `music_generate`, `video_generate`, `tts` | Shared capability plus plugins | Yes     | Provider-owned defaults and fallbacks                                                        |
| MCP tools               | Bundle MCP, saved MCP servers, `kova mcp serve`             | Plugin/runtime bridge          | Partial | Config status exists; live reachability probes, dynamic refresh, and sampling are follow-ups |
| Optional workflow tools | `llm-task`, `lobster`, `diffs`, `tokenjuice`, plugin tools  | Plugins                        | Yes     | Keep plugin-owned behavior out of core unless a generic contract is needed                   |

Tool matrix follow-ups:

- Make tool group/profile selection visible in terminal setup, `kova settings`,
  and `kova status --all`.
- Use `scripts/plugin-capability-inventory.mjs` as the manifest-backed starting
  point for plugin-owned tools and provider surfaces.
- Keep "built-in", "plugin", and "MCP" origin visible to users.

## Runtime And Isolation Matrix

| Runtime path                   | What it means                                              | Strength                                                               | Current gap                                                             |
| ------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Gateway host                   | Tools run on the Gateway machine when no sandbox is active | Simple default for trusted personal setups                             | Needs clearer setup warning when broad tools are enabled                |
| Node host                      | Paired node executes commands or device actions            | Extends Kova to another trusted machine                                | Needs per-node capability display in UI                                 |
| Docker sandbox                 | Tools run in local Docker sandbox containers               | Strong local isolation, sandbox browser support, no network by default | Needs simpler backend comparison and setup UX                           |
| SSH sandbox                    | Tools run on a remote SSH-accessible sandbox host          | Good for remote/off-host execution                                     | Browser sandbox not supported; remote workspace lifecycle must be clear |
| OpenShell sandbox              | Tools run in OpenShell-managed remote environments         | Managed remote sandbox option                                          | Experimental/product status should stay explicit                        |
| Elevated mode                  | Sandboxed agent can request host escape when allowed       | Useful for trusted maintenance                                         | Must stay visibly gated and audited                                     |
| ACP runtime                    | External coding harness owns the low-level loop            | Strong integration for coding agents                                   | Keep ACP advanced, not the default Kova mental model                    |
| OpenAI-compatible Gateway HTTP | External clients call Kova through `/v1/*`                 | Strong compatibility surface                                           | Disabled-by-default and operator-trust model must stay visible          |

Runtime matrix follow-ups:

- Promote the runtime comparison into [Sandboxing](/gateway/sandboxing) or setup
  docs.
- Decide whether cloud/serverless backends are a Kova goal.
- Add one terminal operator surface that shows current runtime, sandbox, host,
  and elevated policy together.

## Memory Matrix

| Memory surface            | Purpose                                                                | Default                             | Status                  | Next action                                                      |
| ------------------------- | ---------------------------------------------------------------------- | ----------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| Workspace memory files    | Durable facts, daily notes, user-editable context                      | Yes                                 | Strong                  | Keep plain Markdown as the beginner story                        |
| `memory-core`             | Built-in search, recall, promotion, dreaming base                      | Yes                                 | Strong                  | Simplify save/search/promote/review docs                         |
| Built-in memory search    | Keyword, vector, and hybrid search over memory chunks                  | Yes, richer with embedding provider | Strong                  | Make degraded keyword-only behavior clear in UI/status           |
| QMD                       | Local-first sidecar with richer search/reranking and extra collections | Opt-in                              | Strong advanced backend | Keep QMD as advanced, not required for normal memory             |
| Honcho                    | AI-native user modeling and cross-session memory                       | Opt-in plugin                       | Strong advanced backend | Keep trust and managed/self-hosted choice explicit               |
| Memory Wiki               | Provenance-rich compiled knowledge layer beside active memory          | Opt-in plugin                       | Strong companion        | Present as knowledge curation, not the default memory backend    |
| Active memory             | Proactive recall before/during turns                                   | Opt-in targeted plugin config       | Partial                 | Improve live status and default-safe setup path                  |
| Dreaming                  | Background consolidation and promotion into long-term memory           | Opt-in                              | Partial                 | Tie dreaming reports to Skill Workshop-style review UX           |
| Session transcript search | Search historical transcripts through memory search                    | Experimental opt-in                 | Partial                 | Keep experimental until storage, privacy, and UI story are clear |
| Skill Workshop            | Turns repeated procedures into skills                                  | Experimental opt-in                 | Partial                 | Graduate pending-first proposals before auto-apply defaults      |

Memory matrix follow-ups:

- Treat "learning loop" as a product feature: memory, active recall, dreaming,
  Skill Workshop, and skill curation together.
- Keep automatic writes reviewable.
- Add status surfaces that explain what was saved, recalled, promoted, or
  skipped.

## Capability Cleanup Order

1. Move the channel matrix into user-facing channel docs.
2. Add manifest-backed source/origin fields where possible.
3. Add runtime/tool/memory status summaries to CLI/TUI surfaces without making
   the legacy browser UI the required path.
4. Only then decide which missing capabilities deserve implementation work.
