# dsh-mcp-toggle · Enable/Disable MCP Servers from DSH Settings

> Turn MCP servers on and off **directly from Settings → MCP Servers**: an additive settings page that **stops/starts each `@deepseek-ai/dsh-mcp-client` connection immediately** (its `mcp__*` tools unregister/register live) and **persists** the change so it survives a DSH restart. 在 DSH 设置 → MCP 服务器页面直接启用/停用 MCP：即时停止/启动每个 MCP 客户端连接，并持久化，重启后依旧生效。
>
> 中文文档: [README.zh.md](README.zh.md) · LLM index: [llms.txt](llms.txt) · Agent guide: [AGENTS.md](AGENTS.md)

![dsh-plugin](https://img.shields.io/badge/dsh--plugin-ready-4c8dff) ![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-✓-0f1115) ![license](https://img.shields.io/badge/license-MIT-green) ![install](https://img.shields.io/badge/dsh%20plugin%20add-✓-22c55e)

**Keywords**: `dsh-plugin` · `deepseek-harness-plugin` · mcp · mcp-client · settings · enable · disable · toggle · MCP 服务器 · 启用 · 停用

## Repo

GitHub: [Zenjibad/dsh-mcp-toggle](https://github.com/Zenjibad/dsh-mcp-toggle) · Requires DSH ≥ 0.1 with the web profile.

---

## 📑 Table of Contents

- [✨ Features](#-features)
- [🏗️ How it works](#️-how-it-works)
- [🚀 Quick start](#-quick-start)
- [⚙️ Configuration](#️-configuration)
- [❓ FAQ](#-faq)
- [⚠️ Security notes](#️-security-notes)
- [📦 Project structure](#-project-structure)
- [🙏 Credits](#-credits)

---

## ✨ Features

| Feature | Description |
| --- | --- |
| 🎚️ **MCP Servers settings page** | Additive Settings page (id `mcp-toggle`, order 70) listing every `@deepseek-ai/dsh-mcp-client` server the user has configured — with a toggle per row |
| 🔄 **Live toggle** | Flipping the switch calls the Cordis Loader's `Entry.update({disabled})` — the MCP connection fiber is disposed (stop) or started immediately, its `mcp__*` tools unregister/register live, no DSH restart |
| 💾 **Persists across restarts** | Each change is appended to the **home** patch layer (`$DSH_HOME/cordis.patch.yml`) — the layer that outranks every profile, so the state survives a DSH restart regardless of where the MCP row originated |
| 📊 **Status at a glance** | Each row shows the MCP server name, an Enabled/Disabled tag, and the connection phase (Connected / Stopped / Connecting / Connection failed) |
| 🔒 **Safety guard** | The loader's `include` entry, non-MCP entries, and this plugin itself are guarded; unknown ids return `404`, locked ids return `403` |
| 🌗 **Theme-aware** | All colors use `--dsw-alias-*` design tokens; follows light/dark automatically |
| ♨️ **Survives restarts** | Real profile-bundled plugin: install once with `dsh plugin add`, auto-loads on every DSH boot — no per-session define, no cordis_define |

## 🏗️ How it works

```
Settings → MCP Servers (additive page, id `mcp-toggle`)
                                  │
Client bundle (browser)           ▼
  └─ fetch GET /mcp-toggle/api → list of MCP client entries
  └─ one row per server: name + Enabled/Disabled tag + connection phase + toggle
  └─ toggle flipped → fetch POST /mcp-toggle/api { entryId, disabled }
                                  │
Host half (DSH process)           ▼
  └─ webServer route POST /mcp-toggle/api
  └─ filter: entry.options.name === '@deepseek-ai/dsh-mcp-client'
  └─ loader.resolve(entryId).update({ disabled })
       └─ disposes the mcp-client fiber (stop: transport closed, mcp__* tools
          unregistered) or starts it (enable) — live, no restart
  └─ appends `- id: <rawId>` / `disabled: <bool>` to $DSH_HOME/cordis.patch.yml
       (the HOME user patch layer, applied AFTER every profile layer → wins at boot)
  └─ returns { ok, entryId, serverName, disabled, fiberPhase, persisted }
                                  │
Client bundle (browser)           ▼
  └─ toast: "Disabled MCP server <name>" / "Enabled …" (or the error) → reload
```

- **Live + persistent, decoupled**: `Entry.update()` (entry-level) does **not** write the loader tree back to any config file — the live effect is in-memory only, and persistence is the append to the home patch layer. No patch flattening, no duplicate rows.
- **Home patch outranks profile**: the web profile composes patches in order *bundle → profile `cordis.patch.yml` → HOME `$DSH_HOME/cordis.patch.yml` → overlays*. MCP rows are split across the home and profile files; a disabled row in the **home** file wins for every MCP regardless of origin. Both files are HMR-watched (hot-apply without restart).
- **Persistence**: ships `dsh.bundle` (`cordis.patch.yml`) + `dsh.client` (`exports["./client"]`, bundled) so it installs as a real profile plugin that the DSH client-modules scanner loads on every boot.

## 🚀 Quick start

### Standard install: `dsh plugin add` (persists across restarts)

Install the package from this GitHub repo:

```bash
# local directory (from the parent of this repo):
dsh plugin --profile web add ./dsh-mcp-toggle

# or directly from GitHub (any DSH machine):
dsh plugin --profile web add github:Zenjibad/dsh-mcp-toggle
# or:
dsh plugin --profile web add git+https://github.com/Zenjibad/dsh-mcp-toggle.git
```

`dsh plugin add` is a pnpm add into the profile plus a `dsh.profile.bundles` reconcile: seeing this package's `dsh.bundle` declaration, it appends `dsh-mcp-toggle` to the bundle stack. **Restart DSH, then hard-refresh the browser tab** (`Ctrl+F5`). On boot the client-modules scanner resolves `exports["./client"]` and the MCP Servers page appears in Settings. No per-session define, survives restarts.

> ⚠️ **Important**: after installing (or updating) a client plugin, a **hard page refresh** (`Ctrl+F5`) is required — the DSH client HMR only hot-swaps already-loaded bundles and does not pull in *new* bundles into an open tab.

### Manual profile mount (alternative)

1. `git clone https://github.com/Zenjibad/dsh-mcp-toggle.git` (any location).
2. Add to `~/.dsh/profiles/web/package.json` `dependencies`: `"dsh-mcp-toggle": "link:<repo-path>"`, then `pnpm install` in the profile dir.
3. Restart DSH.

### Requirements

- A DSH web profile with at least one `@deepseek-ai/dsh-mcp-client` row configured (any server name the user defined in their patch layer).
- No MCP servers configured → the page shows "No MCP servers are configured."

## ⚙️ Configuration

No config file, no persisted settings of its own. Behaviour is fixed by constants in the source:

| Knob | Location | Default |
| --- | --- | --- |
| HTTP route | `src/index.ts` | `GET|POST /mcp-toggle/api` |
| MCP plugin filter | `MCP_CLIENT_PLUGIN` in `src/index.ts` | `@deepseek-ai/dsh-mcp-client` |
| Locked entries | `LOCKED` / `LOCKED_NAMES` in `src/index.ts` | `include`, `cordis:include`, `dsh-mcp-toggle` |
| Settings page | `src/client/index.tsx` | `settings.section` id `mcp-toggle`, order 70 |
| Toast duration | `src/client/index.tsx` | 6 s |
| Persistence target | `$DSH_HOME/cordis.patch.yml` (home patch layer) | appended rows |

## ❓ FAQ

**Q: The "MCP Servers" page is missing?**
A: Restart DSH (if the host half isn't mounted yet), then **hard-refresh the browser tab** (`Ctrl+F5`). New client bundles only appear on a full page reload — the HMR client does not add new bundles to an already-open tab.

**Q: I disabled a server but its tools are still there?**
A: The toggle is live — the mcp-client fiber is disposed and its tool registrations are removed. If a tool from that server still appears, it may be from a different server (server names are namespaced `mcp__<server>__<tool>`) or the page session hasn't refreshed its tool list.

**Q: Does the change survive a restart?**
A: Yes. Each toggle appends a `- id: <entry>` / `disabled: <bool>` row to the **home** patch layer (`$DSH_HOME/cordis.patch.yml`), which outranks every profile layer. If the append failed, the toast says "not persisted across restart" and only the current session is affected.

**Q: Why can't I toggle some entries?**
A: Only `@deepseek-ai/dsh-mcp-client` rows are listed. The loader's `include` entry and this plugin itself are locked (`403`); unknown ids are `404`; a non-MCP entry returns `400`.

**Q: Will disabling a server uninstall it?**
A: No — it only stops the Loader entry and adds a `disabled` override. The MCP row stays configured; re-enabling starts the connection again.

**Q: How do I remove the toggle plugin itself?**
A: `dsh plugin --profile web rm dsh-mcp-toggle` (or delete the profile dependency + bundle entry) and restart DSH. Previously persisted `$DSH_HOME/cordis.patch.yml` rows remain (they are the persistence layer, independent of this plugin).

## ⚠️ Security notes

- **No Remote seam, no writes to loader config**: the client only calls the same-origin `/mcp-toggle/api` route; the host never writes `cordis.yml` or any bundle patch — only appends rows to the home user patch layer.
- **Input validated**: `entryId` must resolve in the loader and must be an MCP client entry; locked ids (`include`, self) are rejected with `403`; unknown ids with `404`.
- **Small payloads**: POST bodies are capped at 1 MB.
- **Live-stop is intentional**: disabling a server disposes its mcp-client fiber immediately — the same operation `cordis_stop` performs; re-enabling restarts it.

## 📦 Project structure

```
dsh-mcp-toggle/
├── src/
│   ├── index.ts            # host half: MCP entry list, loader.resolve().update(), home patch append, route
│   └── client/index.tsx    # client bundle: MCP Servers settings page, toggle switches, toast
├── cordis.patch.yml        # dsh.bundle patch (inserts the plugin row on boot)
├── tsdown.config.ts        # bundles host (node ESM) + client (CJS ModuleLoader)
├── package.json            # name, exports["./client"], dsh.client + dsh.bundle
├── lib/                    # build output (index.js, client.js)
├── AGENTS.md               # repository guide for AI agents
├── llms.txt / llms-full.txt
├── README.md / README.zh.md
└── LICENSE
```

## 🙏 Credits

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — the DSH plugin/dynamic runtime, Cordis Loader, Slots, theme, webServer, client-modules, `@deepseek-ai/dsh-mcp-client`.
- [headroom-stats-plugin](https://github.com/Zenjibad/headroom-stats-plugin) — reference for the packaged client-plugin build pattern (tsdown host/client split, `cordis.patch.yml`, `dsh.client`).
- [dsh-plugin-toggle](https://github.com/Zenjibad/dsh-plugin-toggle) — sibling plugin; same Loader-toggle mechanics for plugins, this plugin extends it to MCP servers.

## 📄 License

[MIT](LICENSE)
