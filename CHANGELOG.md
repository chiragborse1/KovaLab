# Changelog

## Unreleased

### Changes

- Simplify the Control UI Agents section with quieter copy, plain agent rows, a compact overview, and less decorative workspace/file editing chrome. Thanks @chiragborse1
- Add a dedicated Control UI Persona menu with simple Identity, Behavior, and About You sections, default file creation, bootstrap status, and local draft recovery after refresh. Thanks @chiragborse1

### Fixes

- Telegram: keep forum-topic routing and buffered media/text lanes scoped per topic so sibling topics can progress independently. Thanks @VACInc
- CLI: format `kova acp client` failures through the shared error formatter so object-shaped errors stay readable instead of printing `[object Object]`. Thanks @hclsys
