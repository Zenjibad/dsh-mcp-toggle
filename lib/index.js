import { promises as fsp } from "node:fs";
import path from "node:path";
import os from "node:os";

//#region src/index.ts
const name = "dsh-mcp-toggle";
const inject = ["webServer"];
/** The MCP client plugin module name every toggleable row mounts. */
const MCP_CLIENT_PLUGIN = "@deepseek-ai/dsh-mcp-client";
/** Runtime mirror of the Cordis Fiber state const enum (see dsh-host-plugin-inventory). */
const FIBER_PHASE = {
	0: "pending",
	1: "loading",
	2: "active",
	3: "failed",
	4: null,
	5: "unloading"
};
/** Infrastructure entry ids/names that must never be toggled. */
const LOCKED = new Set(["include"]);
const LOCKED_NAMES = new Set(["cordis:include", "dsh-mcp-toggle"]);
function fiberPhaseLabel(phase) {
	return FIBER_PHASE[phase] ?? null;
}
function isLocked(id, name$1) {
	return LOCKED.has(id) || LOCKED_NAMES.has(name$1);
}
function json(res, status, body) {
	const text = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(text);
}
/** Accumulate a small JSON request body. */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > 1e6) {
				reject(new Error("payload too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			try {
				const raw = Buffer.concat(chunks).toString("utf8");
				resolve(raw ? JSON.parse(raw) : {});
			} catch (e) {
				reject(e);
			}
		});
		req.on("error", reject);
	});
}
/** Resolve the HOME user patch layer ($DSH_HOME/cordis.patch.yml). */
function resolveHomePatchPath() {
	const home = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
	return path.join(home, "cordis.patch.yml");
}
/** Upsert one `- id: <rawId>` / `disabled: <bool>` row in the home patch layer.
*  Replaces the existing row's value in place (patch "last row wins", no
*  duplication); appends only when the id has no top-level row yet. */
async function persistDisabled(rawId, disabled) {
	const patchPath = resolveHomePatchPath();
	const yamlId = /^[A-Za-z0-9_.@/-]+$/.test(rawId) ? rawId : JSON.stringify(rawId);
	const row = `- id: ${yamlId}\n  disabled: ${String(disabled)}\n`;
	let content = "";
	try {
		content = await fsp.readFile(patchPath, "utf8");
	} catch {
		content = "";
	}
	const lines = content.split("\n");
	let currentId = null;
	let lastDisabled = -1;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const bare = line.endsWith("\r") ? line.slice(0, -1) : line;
		const idMatch = /^- id: (.+)$/.exec(bare);
		if (idMatch && idMatch[1] !== undefined) {
			currentId = idMatch[1].trim();
			continue;
		}
		if (currentId === yamlId && /^\s*disabled:/.test(bare)) lastDisabled = i;
	}
	if (lastDisabled >= 0) {
		const target = lines[lastDisabled];
		if (target !== undefined) {
			const cr = target.endsWith("\r") ? "\r" : "";
			const bare = cr ? target.slice(0, -1) : target;
			lines[lastDisabled] = bare.replace(/^(\s*disabled:).*$/, `$1 ${String(disabled)}`) + cr;
			await fsp.writeFile(patchPath, lines.join("\n"), "utf8");
		}
		return patchPath;
	}
	if (content.length > 0 && !content.endsWith("\n")) content += "\n";
	await fsp.writeFile(patchPath, content + row, "utf8");
	return patchPath;
}
function serverNameOf(entry) {
	const raw = entry.options.config?.serverName;
	return typeof raw === "string" && raw.length > 0 ? raw : entry.options.name ?? entry.id;
}
function listMcpEntries(loader) {
	const entries = [];
	for (const entry of loader.entries()) {
		if (entry.options.group) continue;
		if (entry.options.name !== MCP_CLIENT_PLUGIN) continue;
		if (LOCKED.has(entry.id) || LOCKED_NAMES.has(entry.options.name ?? "")) continue;
		entries.push({
			entryId: entry.id,
			serverName: serverNameOf(entry),
			enabled: !entry.disabled,
			fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state] ?? null
		});
	}
	return entries;
}
function apply(ctx) {
	const webServer = ctx.webServer;
	ctx.effect(() => webServer.register({
		kind: "exact",
		path: "/mcp-toggle/api",
		handler: async (req, res) => {
			const loader = ctx.get("loader");
			if (loader === undefined) {
				json(res, 503, {
					ok: false,
					error: "loader service unavailable"
				});
				return;
			}
			if (req.method === "GET") {
				json(res, 200, {
					ok: true,
					entries: listMcpEntries(loader)
				});
				return;
			}
			if (req.method !== "POST") {
				json(res, 405, {
					ok: false,
					error: "method not allowed"
				});
				return;
			}
			let payload;
			try {
				payload = await readJsonBody(req);
			} catch (e) {
				json(res, 400, {
					ok: false,
					error: "unreadable body: " + String(e?.message ?? e)
				});
				return;
			}
			const entryId = typeof payload.entryId === "string" ? payload.entryId : "";
			const disabled = payload.disabled === true;
			if (entryId === "" || LOCKED.has(entryId) || LOCKED_NAMES.has(entryId)) {
				json(res, 403, {
					ok: false,
					error: "entry is not toggleable: " + entryId
				});
				return;
			}
			let entry;
			try {
				entry = loader.resolve(entryId);
			} catch {
				json(res, 404, {
					ok: false,
					error: "unknown entry: " + entryId
				});
				return;
			}
			if (entry.options.name !== MCP_CLIENT_PLUGIN) {
				json(res, 400, {
					ok: false,
					error: "not an MCP client entry: " + entryId
				});
				return;
			}
			try {
				await entry.update({ disabled });
			} catch (e) {
				json(res, 500, {
					ok: false,
					error: "failed to " + (disabled ? "disable" : "enable") + ": " + String(e?.message ?? e)
				});
				return;
			}
			const rawId = entry.options.id ?? entry.id;
			let persisted = false;
			let patchPath = null;
			try {
				patchPath = await persistDisabled(rawId, disabled);
				persisted = true;
			} catch (e) {
				console.log("mcp-toggle: persistence failed", String(e?.message ?? e));
			}
			json(res, 200, {
				ok: true,
				entryId,
				serverName: serverNameOf(entry),
				disabled,
				fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state] ?? null,
				persisted,
				patchPath
			});
		}
	}));
}

//#endregion
export { apply, fiberPhaseLabel, inject, isLocked, name };