---
title: "Learning Loop"
summary: "How Kova turns recalled memory, Dream Diary review, and Skill Workshop proposals into reviewable local improvements"
read_when:
  - You want Kova to learn from repeated work without hiding what changed
  - You are deciding how memory, dreaming, and Skill Workshop fit together
  - You are reviewing pending memory or skill updates before applying them
---

Kova's learning loop is the reviewable path from useful work to durable local
knowledge. It is intentionally made of separate checkpoints instead of one
silent auto-learning switch.

## The Loop

1. **Recall**: use `kova memory status` and `kova memory search <query>` to see
   whether memory is available and what Kova can already retrieve.
2. **Consolidate**: optional dreaming stages repeated or high-signal short-term
   material. Review the human-readable output with `kova memory dreams`.
3. **Promote**: preview durable memory candidates with `kova memory promote`.
   Add `--apply` only after reviewing what will be written to `MEMORY.md`.
4. **Capture procedures**: optional Skill Workshop turns repeated procedures
   into workspace skill proposals.
5. **Review skills**: inspect proposals with `kova skill-workshop review` and
   `kova skill-workshop inspect <proposal-id>`. Apply with
   `kova skill-workshop apply <proposal-id> --yes`, or reject/quarantine them.
6. **Use**: run future sessions with reviewed memory and skills available as
   local files.

## Terminal Surfaces

The daily terminal map is:

```bash
kova status
kova memory status
kova memory search "what changed?"
kova memory dreams
kova memory promote
kova skills list
kova skill-workshop status
kova skill-workshop review
```

Inside `kova`, use `/memory status`, `/memory search <query>`,
`/memory dreams`, `/skills`, and `/plugins list`.

## Safety Defaults

- Dreaming is opt-in and disabled by default.
- `kova memory promote` previews by default; `--apply` is the durable write.
- Skill Workshop is experimental and opt-in.
- Skill Workshop pending proposals are local and reviewable before apply.
- Applied skills write under the selected workspace `skills/` directory.
- Third-party skills and automatic writes should be treated as untrusted until
  reviewed.

## Related

- [Memory CLI](/cli/memory)
- [Dreaming](/concepts/dreaming)
- [Skills](/tools/skills)
- [Skill Workshop](/plugins/skill-workshop)
