window.__ModuleLoader__.load({ id: "dsh-mcp-toggle", factory: (require) => {
"use strict";
var module = { exports: {} }; var exports = module.exports;
//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
const react = __toESM(require("react"));

//#region src/client/index.tsx
const inject = ["slots"];
const API = "/mcp-toggle/api";
const PHASE_LABEL = {
	pending: "Connecting…",
	loading: "Loading",
	active: "Connected",
	failed: "Connection failed",
	unloading: "Stopping"
};
function phaseLabel(phase) {
	return phase === null ? "Stopped" : PHASE_LABEL[phase] ?? phase;
}
function apply(ctx) {
	const slots = ctx.get("slots");
	if (slots === undefined) return;
	const style = document.createElement("style");
	style.dataset.plugin = "dsh-mcp-toggle";
	style.textContent = [
		".mct-section{width:100%;max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex}",
		".mct-heading{display:flex;align-items:baseline;gap:7px;padding:0 2px}",
		".mct-heading h3{font-size:13px;font-weight:600;line-height:20px;margin:0}",
		".mct-heading span{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:12px;line-height:18px}",
		".mct-status{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px;margin:0}",
		".mct-failure{color:var(--dsw-alias-state-error-primary);align-items:center;gap:10px;display:flex}",
		".mct-failure p{margin:0}",
		".mct-failure button{border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border-radius:6px;padding:4px 10px}",
		".mct-list{flex-direction:column;gap:8px;display:flex;margin:0;padding:0;list-style:none}",
		".mct-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;min-width:0}",
		".mct-meta{flex:1;min-width:0}",
		".mct-name{font-size:13px;font-weight:600;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
		".mct-sub{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:18px;display:flex;gap:8px;align-items:center}",
		".mct-tag{font-size:11px;line-height:16px;padding:0 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2)}",
		".mct-tag[data-enabled=\"true\"]{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}",
		".mct-tag[data-enabled=\"false\"]{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}",
		".mct-switch{position:relative;display:inline-flex;flex-shrink:0;width:36px;height:20px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);cursor:pointer;padding:0;transition:background .15s ease}",
		".mct-switch[aria-checked=\"true\"]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}",
		".mct-switch[disabled]{opacity:.5;cursor:default}",
		".mct-switch::after{content:\"\";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-primary);transition:transform .15s ease}",
		".mct-switch[aria-checked=\"true\"]::after{transform:translateX(16px)}",
		".mct-toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:10000;max-width:82vw;padding:10px 16px;border-radius:10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);box-shadow:var(--dsw-shadow-md, none);font-size:13px;color:var(--dsw-alias-label-primary)}",
		".mct-toast-ok{border-color:var(--dsw-alias-state-success-primary)}",
		".mct-toast-err{border-color:var(--dsw-alias-state-error-primary)}"
	].join("");
	document.head.appendChild(style);
	ctx.effect(() => () => {
		style.remove();
	});
	function McpTogglePage() {
		const [state, setState] = react.default.useState({ status: "loading" });
		const [busyId, setBusyId] = react.default.useState(null);
		const [toast, setToast] = react.default.useState(null);
		const toastTimerRef = react.default.useRef(null);
		const showToast = (kind, text) => {
			setToast({
				kind,
				text
			});
			if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
			toastTimerRef.current = setTimeout(() => {
				setToast(null);
				toastTimerRef.current = null;
			}, 6e3);
		};
		const load = react.default.useCallback(() => {
			setState({ status: "loading" });
			void fetch(API, { cache: "no-store" }).then((res) => res.json()).then((result) => {
				if (!result.ok || !result.entries) throw new Error(result.error ?? "bad response");
				setState({
					status: "ready",
					entries: result.entries
				});
			}).catch((e) => {
				console.error("mcp-toggle list error", e);
				setState({ status: "error" });
			});
		}, []);
		react.default.useEffect(() => {
			load();
			return () => {
				if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
			};
		}, [load]);
		const toggle = react.default.useCallback((entry) => {
			setBusyId(entry.entryId);
			void fetch(API, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					entryId: entry.entryId,
					disabled: entry.enabled
				})
			}).then((res) => res.json()).then((result) => {
				if (!result.ok) throw new Error(result.error ?? "toggle failed");
				const verb = entry.enabled ? "Disabled" : "Enabled";
				const persistedNote = result.persisted === false ? " (not persisted across restart)" : "";
				showToast("ok", verb + " MCP server " + entry.serverName + persistedNote);
				load();
			}).catch((e) => {
				console.error("mcp-toggle toggle error", e);
				showToast("err", "Failed to toggle " + entry.serverName + ": " + String(e?.message ?? e));
			}).finally(() => setBusyId(null));
		}, [load]);
		const h = react.default.createElement;
		const sorted = state.entries ? [...state.entries].sort((a, b) => a.serverName.localeCompare(b.serverName)) : [];
		return h(react.default.Fragment, null, h("div", { className: "mct-section" }, state.status === "loading" ? h("p", { className: "mct-status" }, "Reading MCP servers…") : null, state.status === "error" ? h("div", { className: "mct-failure" }, h("p", { role: "alert" }, "MCP servers are temporarily unavailable."), h("button", {
			type: "button",
			onClick: load
		}, "Retry")) : null, state.status === "ready" ? h("div", { className: "mct-section" }, h("div", { className: "mct-heading" }, h("h3", null, "MCP servers"), h("span", { "data-server-count": sorted.length }, String(sorted.length))), sorted.length === 0 ? h("p", { className: "mct-status" }, "No MCP servers are configured.") : h("ul", { className: "mct-list" }, sorted.map((entry) => h("li", {
			className: "mct-row",
			key: entry.entryId,
			"data-mcp-server": entry.serverName
		}, h("div", { className: "mct-meta" }, h("div", {
			className: "mct-name",
			title: entry.entryId
		}, entry.serverName), h("div", { className: "mct-sub" }, h("span", {
			className: "mct-tag",
			"data-enabled": String(entry.enabled)
		}, entry.enabled ? "Enabled" : "Disabled"), h("span", null, phaseLabel(entry.fiberPhase)))), h("button", {
			type: "button",
			role: "switch",
			"aria-checked": entry.enabled,
			"aria-label": (entry.enabled ? "Disable " : "Enable ") + entry.serverName,
			className: "mct-switch",
			disabled: busyId !== null,
			onClick: () => toggle(entry)
		}))))) : null), toast !== null ? h("div", { className: "mct-toast " + (toast.kind === "ok" ? "mct-toast-ok" : "mct-toast-err") }, toast.text) : null);
	}
	slots.inject("settings.section", () => slots.register({
		name: "settings.section",
		id: "mcp-toggle",
		order: 70,
		label: () => "MCP Servers"
	}, () => react.default.createElement(McpTogglePage)));
}

//#endregion
exports.apply = apply
exports.inject = inject
return module.exports; } });
//# sourceMappingURL=client.js.map