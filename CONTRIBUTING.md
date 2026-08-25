# Contributing

Thanks for your interest in `dsh-mcp-toggle`, a packaged Cordis plugin for the
DeepSeek Harness (DSH) web UI that adds a Settings page to enable/disable MCP
servers.

## Setup

- `pnpm install`
- `pnpm build` — outputs `lib/index.js` (host) and `lib/client.js` (browser bundle).
- `pnpm test` — runs the unit tests.

## Don't break these

- Keep the packaged profile-plugin structure — never revert to a dynamic
  `cordis_define`-only shape.
- Keep the exact CJS ModuleLoader client wrapper (`window.__ModuleLoader__.load`).
- Route handlers must always return `{ ok: false, error }` JSON on failure —
  never a non-JSON 500.
- Client styles use `--dsw-alias-*` design tokens only; no hardcoded colors.
- MCP rows are filtered by `@deepseek-ai/dsh-mcp-client`; persistence appends to
  the HOME patch layer.
