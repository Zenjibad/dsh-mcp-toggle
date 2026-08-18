# AGENTS.md — Guide for AI agents

This file helps AI coding agents and LLM tooling understand and work with this repository quickly.

## What this repo is

`dsh-mcp-toggle` is a **packaged Cordis plugin for DeepSeek Harness (DSH)** that adds a "MCP Servers" settings page. MCP servers are loader rows mounting `@deepseek-ai/dsh-mcp-client` (the user defines them in their patch layer). This plugin lets the user stop/start those connections live (via `entry.update({disabled})`, which disposes/starts the mcp-client fiber and unregisters/registers its `mcp__*` tools) and persists the change to the **home** patch layer `$DSH_HOME/cordis.patch.yml`. It is a real profile-bundled plugin: `dsh.bundle` (`cordis.patch.yml`) mounts the host half, and the `dsh.client` declaration + `exports["./client"]` register the browser half — install once with `dsh plugin add`, loads on every DSH boot, no cordis_define.

## Repository layout

| Path | Role |
| --- | --- |
| `src/index.ts` | Host half: `GET|POST /mcp-toggle/api` — iterates `ctx.loader.entries()` filtering `@deepseek-ai/dsh-mcp-client`, projects `serverName` from `options.config`, `entry.update({disabled})` for the live toggle, appends a `- id: <rawId>` / `disabled: <bool>` row to `$DSH_HOME/cordis.patch.yml` for persistence. |
| `src/client/index.tsx` | Client bundle: additive `settings.section` registration (id `mcp-toggle`, order 70, label "MCP Servers"), toggle switches, status tags, toast, `<style data-plugin>` with `--dsw-alias-*` tokens. |
| `cordis.patch.yml` | `dsh.bundle.patch`: inserts the plugin row `{id: dsh-mcp-toggle, name: 'dsh-mcp-toggle'}`. |
| `tsdown.config.ts` | Builds host (node ESM → `lib/index.js`) + client (browser CJS ModuleLoader closure → `lib/client.js`, bundle id = package name). |
| `package.json` | `exports["./client"]`, `dsh.bundle.patch`, `dsh.client` (`platform: 'web'`, inject edges), peers react + @deepseek-ai/cordis. |
| `README.md` / `README.zh.md` | Human docs (en default, zh). |
| `llms.txt` / `llms-full.txt` | LLM-friendly doc index / full text. |

## Key behaviors (don't break these)

1. **Packaged, not dynamic**: install via `dsh plugin add` (or profile `link:` dep + restart). Do NOT revert to a dynamic `cordis_define`-only shape.
2. **Client talks to host over HTTP**: the client fetches `GET|POST /mcp-toggle/api` (host `webServer` route). Do not reintroduce the dynamic `harness.handle`/`host.call` seam — it does not exist for packaged plugins.
3. **List MCP entries only**: filter `loader.entries()` by `entry.options.name === '@deepseek-ai/dsh-mcp-client'`; display `options.config.serverName` (all MCP rows share the package name, so serverName is the only distinguishing label).
4. **Persist to the HOME patch layer, not the profile's**: append `- id: <rawId>` / `disabled: <bool>` to `$DSH_HOME/cordis.patch.yml` (resolve via `process.env.DSH_HOME || ~/.dsh`). The web profile applies bundle → profile `cordis.patch.yml` → HOME → overlays, so home outranks profile and MCP rows from either file are covered. NEVER rewrite the file, never touch `cordis.yml` or bundle patches.
5. **Live toggle via entry-level update only**: call `entry.update({ disabled })` directly on the resolved Entry. Do NOT go through the tree-level `EntryTree.update` — that wrapper calls `tree.write()` and would flatten patches into the config.
6. **Raw id vs prefixed id**: `entry.id` is the prefixed form (`include:<rawId>`) and is what the client round-trips; patch rows must use `entry.options.id` (the raw config id).
7. **Safety guard**: `include`, `cordis:include`, and `dsh-mcp-toggle` are locked (`403`); unknown ids `404`; non-MCP entries `400`; POST bodies capped at 1 MB.
8. **Never throw across the API**: `/mcp-toggle/api` always returns `{ok:false,error}` JSON on failure, never a non-JSON 500.
9. **Theme tokens only**: client CSS uses `--dsw-alias-*` tokens; no hardcoded colors. Font comes from inheritance (the seat wrappers supply the app font); do not set font-family.
10. **ModuleLoader bundle shape**: the client build must keep the exact CJS closure wrapper (`window.__ModuleLoader__.load({id: "dsh-mcp-toggle", factory})` + `module.exports = { inject, apply }`) — see `tsdown.config.ts`.

## Common tasks

- **Change the MCP filter / locked entries / route / page order**: edit `MCP_CLIENT_PLUGIN`, `LOCKED`/`LOCKED_NAMES`, the route path in `src/index.ts`, and the page `order`/`label` in `src/client/index.tsx`, rebuild.
- **Change toast duration / labels**: edit `src/client/index.tsx`.
- **Rebuild**: `pnpm install && pnpm build` (outputs `lib/index.js` + `lib/client.js`).
- **Update the live profile install**: push to GitHub, `dsh plugin` update or re-add in the profile, restart DSH, **hard-refresh the browser tab** (the DSH client HMR only hot-swaps already-loaded bundles — new bundles require a full page reload).

## Environment facts (probed, do not re-probe)

- Packaged hosts are real Node modules: `node:fs/promises`, `node:path`, `node:os`, `process.env` work; the DSH dynamic-plugin sandbox limits do **not** apply.
- `webServer.register` route shape: `{kind: 'exact'|'prefix', path, handler(req, res)}` with node:http semantics; duplicate (kind, path) throws. The handler receives the raw `IncomingMessage` (stream the body; do not assume it is pre-buffered).
- `@deepseek-ai/dsh-mcp-client` apply() owns the connection + tool registrations through ctx.effect disposers — disposing the fiber closes the transport and unregisters `mcp__*` tools; re-enabling starts fresh. serverName is reserved per root while the fiber is live (duplicate serverName across instances throws).
- The web profile patch order is bundle → profile `cordis.patch.yml` → HOME `$DSH_HOME/cordis.patch.yml` → overlays; home outranks profile. `$DSH_HOME` defaults to `~/.dsh`. Both patch files are HMR-watched (hot-apply without restart).
- Loader `Entry.get id()` returns the prefixed form (`include:<rawId>`); `pluginInventory.list()` returns that same `entryId`; `loader.resolve(entryId)` round-trips it.
- `Entry.update()` at the entry level does NOT call `tree.write()`; `isNullable` matches only `null`/`undefined`, so `disabled: false` (re-enable) is kept.
- The client bundle is plain browser JS (ModuleLoader CJS factory): `fetch`, `document`, `window` are available; React comes from the module table (`external: react`).
- The client must export `inject = ['slots']` (service key); the package.json `dsh.client.inject` lists package names (informational edges).
- `settings.section` is a list slot; a fresh id adds a page beside the shipped ones.

## Testing

- **Before restart**: verify the profile installed the bundle — `~/.dsh/profiles/web/package.json` `dependencies` and `dsh.profile.bundles` both list `dsh-mcp-toggle`; `lib/client.js` has the ModuleLoader wrapper; `lib/index.js` exports `name` + `apply`.
- **After restart (hard-refresh the tab)**: Settings shows the "MCP Servers" page; `GET /mcp-toggle/api` returns the MCP entry list; toggling a server updates its phase immediately and appends a row to `$DSH_HOME/cordis.patch.yml`; a further DSH restart keeps the state.
- Failure path: toggle a locked id → `403` toast; unknown id → `404`; non-MCP entry → `400`; persistence append failure → toast says "not persisted across restart" (session-only toggle still works).
- No automated test framework; the manual matrix above is the verification contract.

## Notes for LLM crawlers

- Listed under the GitHub topic `dsh-plugin`; public at https://github.com/Zenjibad/dsh-mcp-toggle.
- Distinguishing traits: packaged profile plugin (persists across restarts), additive Settings page that never shadows shipped UI, live `Entry.update({disabled})` toggle of MCP client fibers (tools unregister/register), HOME-patch-layer append persistence (outranks profile layers), host HTTP route instead of dynamic RPC, real-Node host half, pure `--dsw-alias-*` theming.
