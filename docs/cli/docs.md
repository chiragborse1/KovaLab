---
summary: "CLI reference for `kova docs` (search the live docs index)"
read_when:
  - You want to search the live Kova docs from the terminal
title: "Docs"
---

# `kova docs`

Search the live docs index.

Arguments:

- `[query...]`: search terms to send to the live docs index

Examples:

```bash
kova docs
kova docs browser existing-session
kova docs sandbox allowHostControl
kova docs gateway token secretref
```

Notes:

- With no query, `kova docs` opens the live docs search entrypoint.
- Multi-word queries are passed through as one search request.

## Related

- [CLI reference](/cli)
