/**
 * dsh-mcp-toggle — host half.
 *
 * Enables/disables MCP servers from the web UI. MCP rows are ordinary loader
 * entries whose plugin is `@deepseek-ai/dsh-mcp-client` (e.g. the rows a DSH
 * user configures in their patch layer). Exposes one HTTP route:
 *
 *   GET  /mcp-toggle/api  → { entries: [{ entryId, serverName, enabled, fiberPhase }] }
 *   POST /mcp-toggle/api  → { entryId, disabled } → stops/starts the MCP
 *                           connection immediately AND persists the change to
 *                           the HOME patch layer ($DSH_HOME/cordis.patch.yml).
 *
 * Mechanics (verified against the runtime):
 *  - `@deepseek-ai/dsh-mcp-client` apply() owns the connection + tool
 *    registrations through ctx.effect disposers, so `Entry.update({disabled})`
 *    tears the transport down (tools unregister) or starts it fresh — live.
 *  - The web profile composes patches in order: bundle → profile
 *    cordis.patch.yml → HOME $DSH_HOME/cordis.patch.yml → overlays. The home
 *    layer OUTRANKS the per-profile layer, and MCP rows are split across both
 *    files — so a disabled row in the HOME file wins for every MCP regardless
 *    of origin. Both files are HMR-watched (hot-apply without restart).
 *  - A packaged host is a real Node module, so node:fs / node:path work.
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'

export const name = 'dsh-mcp-toggle'

// webServer is a hard dependency: the host half exists to serve the toggle route.
export const inject = ['webServer']

/** The MCP client plugin module name every toggleable row mounts. */
const MCP_CLIENT_PLUGIN = '@deepseek-ai/dsh-mcp-client'

/** Runtime mirror of the Cordis Fiber state const enum (see dsh-host-plugin-inventory). */
const FIBER_PHASE: Record<number, string | null> = {
  0: 'pending',
  1: 'loading',
  2: 'active',
  3: 'failed',
  4: null,
  5: 'unloading',
}

/** Infrastructure entry ids/names that must never be toggled. */
const LOCKED = new Set(['include'])
const LOCKED_NAMES = new Set(['cordis:include', 'dsh-mcp-toggle'])

/** Map a Cordis Fiber phase to its human label, or null. */
export function fiberPhaseLabel(phase: number): string | null {
  return FIBER_PHASE[phase] ?? null
}

/** True if a load id or module name must never be toggled. */
export function isLocked(id: string, name: string): boolean {
  return LOCKED.has(id) || LOCKED_NAMES.has(name)
}

/** The webServer route-registration service (typed loosely to avoid hard deps). */
interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** Minimal Loader surface we use (typed loosely; the Loader is a real dependency). */
interface LoaderLike {
  entries(): Generator<EntryLike, void, void>
  resolve(id: string): EntryLike
}
interface EntryLike {
  id: string
  options: { id?: string; name?: string; group?: boolean | null; config?: { serverName?: unknown } }
  disabled: boolean
  fiber?: { state: number } | undefined
  update(options: Record<string, unknown>, create?: boolean, force?: boolean): Promise<void>
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(text)
}

/** Accumulate a small JSON request body. */
function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 1_000_000) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

/** Resolve the HOME user patch layer ($DSH_HOME/cordis.patch.yml). */
function resolveHomePatchPath(): string {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'cordis.patch.yml')
}

/** Upsert one `- id: <rawId>` / `disabled: <bool>` row in the home patch layer.
 *  Replaces the existing row's value in place (patch "last row wins", no
 *  duplication); appends only when the id has no top-level row yet. */
async function persistDisabled(rawId: string, disabled: boolean): Promise<string> {
  const patchPath = resolveHomePatchPath()
  const yamlId = /^[A-Za-z0-9_.@/-]+$/.test(rawId) ? rawId : JSON.stringify(rawId)
  const row = `- id: ${yamlId}\n  disabled: ${String(disabled)}\n`
  let content = ''
  try {
    content = await fsp.readFile(patchPath, 'utf8')
  } catch {
    content = ''
  }
  const lines = content.split('\n')
  // Track the current top-level item id (plugin rows are top-level `- id:`;
  // nested `- insert:` rows are indented and never match). Remember the last
  // `  disabled:` line under our id so "last row wins" stays true. Lines may
  // carry a trailing `\r` (CRLF files) — strip it for matching and preserve it.
  let currentId: string | null = null
  let lastDisabled = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue
    const bare = line.endsWith('\r') ? line.slice(0, -1) : line
    const idMatch = /^- id: (.+)$/.exec(bare)
    if (idMatch && idMatch[1] !== undefined) {
      currentId = idMatch[1].trim()
      continue
    }
    if (currentId === yamlId && /^\s*disabled:/.test(bare)) {
      lastDisabled = i
    }
  }
  if (lastDisabled >= 0) {
    const target = lines[lastDisabled]
    if (target !== undefined) {
      const cr = target.endsWith('\r') ? '\r' : ''
      const bare = cr ? target.slice(0, -1) : target
      lines[lastDisabled] = bare.replace(/^(\s*disabled:).*$/, `$1 ${String(disabled)}`) + cr
      await fsp.writeFile(patchPath, lines.join('\n'), 'utf8')
    }
    return patchPath
  }
  if (content.length > 0 && !content.endsWith('\n')) content += '\n'
  await fsp.writeFile(patchPath, content + row, 'utf8')
  return patchPath
}

function serverNameOf(entry: EntryLike): string {
  const raw = entry.options.config?.serverName
  return typeof raw === 'string' && raw.length > 0 ? raw : entry.options.name ?? entry.id
}

function listMcpEntries(loader: LoaderLike): Array<{ entryId: string; serverName: string; enabled: boolean; fiberPhase: string | null }> {
  const entries: Array<{ entryId: string; serverName: string; enabled: boolean; fiberPhase: string | null }> = []
  for (const entry of loader.entries()) {
    if (entry.options.group) continue
    if (entry.options.name !== MCP_CLIENT_PLUGIN) continue
    if (LOCKED.has(entry.id) || LOCKED_NAMES.has(entry.options.name ?? '')) continue
    entries.push({
      entryId: entry.id,
      serverName: serverNameOf(entry),
      enabled: !entry.disabled,
      fiberPhase: entry.fiber === undefined ? null : (FIBER_PHASE[entry.fiber.state] ?? null),
    })
  }
  return entries
}

export function apply(ctx: Context): void {
  const webServer = (ctx as unknown as { webServer: WebServerLike }).webServer

  ctx.effect(() =>
    webServer.register({
      kind: 'exact',
      path: '/mcp-toggle/api',
      handler: async (req, res) => {
        const loader = ctx.get('loader') as LoaderLike | undefined
        if (loader === undefined) {
          json(res, 503, { ok: false, error: 'loader service unavailable' })
          return
        }

        if (req.method === 'GET') {
          json(res, 200, { ok: true, entries: listMcpEntries(loader) })
          return
        }
        if (req.method !== 'POST') {
          json(res, 405, { ok: false, error: 'method not allowed' })
          return
        }

        let payload: Record<string, unknown>
        try {
          payload = await readJsonBody(req)
        } catch (e) {
          json(res, 400, { ok: false, error: 'unreadable body: ' + String((e as Error)?.message ?? e) })
          return
        }

        const entryId = typeof payload.entryId === 'string' ? payload.entryId : ''
        const disabled = payload.disabled === true

        if (entryId === '' || LOCKED.has(entryId) || LOCKED_NAMES.has(entryId)) {
          json(res, 403, { ok: false, error: 'entry is not toggleable: ' + entryId })
          return
        }

        let entry: EntryLike
        try {
          entry = loader.resolve(entryId)
        } catch {
          json(res, 404, { ok: false, error: 'unknown entry: ' + entryId })
          return
        }
        if (entry.options.name !== MCP_CLIENT_PLUGIN) {
          json(res, 400, { ok: false, error: 'not an MCP client entry: ' + entryId })
          return
        }

        try {
          await entry.update({ disabled })
        } catch (e) {
          json(res, 500, { ok: false, error: 'failed to ' + (disabled ? 'disable' : 'enable') + ': ' + String((e as Error)?.message ?? e) })
          return
        }

        // Persist under the entry's RAW config id (patch rows target the config
        // entry list, whose ids are unprefixed — the loader entry id is the
        // prefixed `include:<rawId>` form).
        const rawId = entry.options.id ?? entry.id
        let persisted = false
        let patchPath: string | null = null
        try {
          patchPath = await persistDisabled(rawId, disabled)
          persisted = true
        } catch (e) {
          console.log('mcp-toggle: persistence failed', String((e as Error)?.message ?? e))
        }

        json(res, 200, {
          ok: true,
          entryId,
          serverName: serverNameOf(entry),
          disabled,
          fiberPhase: entry.fiber === undefined ? null : (FIBER_PHASE[entry.fiber.state] ?? null),
          persisted,
          patchPath,
        })
      },
    }),
  )
}
