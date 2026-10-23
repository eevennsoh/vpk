/*
 * review/runtime/transport: the four return paths, import and the VPK host
 * bridge (ws1 4.12-4.14, C6).
 *
 *   1. Copy for agent: clipboard, then execCommand, then a selected textarea.
 *   2. Download review: review-<slug>.<initials>.<yyyymmdd-hhmm>.json.
 *   3. Save reviewed copy: source bytes (fetch over http(s), else the file the
 *      reader picks), checked for the same doc id and revision, content
 *      providers applied (window.__VPK_CONTENT__[type].applyToSource, R19 R1),
 *      then the review-data block embedded with serializeJsonIsland. Bytes
 *      outside that block (and the providers' islands) never change.
 *   4. Send to agent: postMessage vpk-review:send to the pinned host origin,
 *      refused above 61,440 UTF-8 bytes. Each content provider's
 *      exportState({ includeImages: false }) follows as a "Content state"
 *      section (R19 R2), replaced by a note when it would pass that limit.
 *
 * Page-level file drops (window, bubble phase) import reviews, except drops a
 * page handler already took (defaultPrevented), drops inside
 * [data-vpk-file-drop] (R19 R3) and the review UI. The runtime posts hello only
 * when framed and never sends comment text without an explicit click.
 *
 * Serialized module: named function imports and export function declarations
 * only, no module-level state, plain ASCII.
 */

import { parseJsonIsland } from "../../json-island.mjs";
import { findReviewIsland, readMetaContent, setEmbeddedReviewText } from "../markup.mjs";
import { capIssues } from "../merge.mjs";
import { contentStateSection } from "../markdown.mjs";
import { createId, nowIso } from "../schema.mjs";
import { announce, buildMarkdown, exportReviewValue, importReviewValue, refreshAll, resolveComments, reviewCounts, saveState } from "./boot.mjs";
import { appendNodes, h, pathHasAttribute, plural, uiButton, utf8Length } from "./dom.mjs";
import { dotSep, renderPanel, renderShareTab, showToast } from "./panel.mjs";

export async function copyText(ctx, text) {
	const nav = ctx.win.navigator;
	if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
		try {
			await nav.clipboard.writeText(text);
			return "clipboard";
		} catch {
			// Fall through to execCommand.
		}
	}
	try {
		const area = ctx.doc.createElement("textarea");
		area.value = text;
		area.setAttribute("readonly", "");
		area.setAttribute("aria-hidden", "true");
		area.style.position = "fixed";
		area.style.opacity = "0";
		ctx.ui.shadow.appendChild(area);
		area.select();
		const ok = typeof ctx.doc.execCommand === "function" && ctx.doc.execCommand("copy");
		area.remove();
		if (ok) return "exec";
	} catch {
		// Fall through to the manual path.
	}
	return "manual";
}

export function downloadText(ctx, name, text, type) {
	try {
		const blob = new Blob([text], { type: (type || "text/plain") + ";charset=utf-8" });
		const url = ctx.win.URL.createObjectURL(blob);
		const anchor = ctx.doc.createElement("a");
		anchor.href = url;
		anchor.download = name;
		anchor.style.display = "none";
		ctx.ui.shadow.appendChild(anchor);
		anchor.click();
		ctx.win.setTimeout(() => {
			anchor.remove();
			ctx.win.URL.revokeObjectURL(url);
		}, 1500);
		ctx.lastDownload = { name, bytes: utf8Length(text) };
		return true;
	} catch {
		return false;
	}
}

export function fileSlug(ctx) {
	const base = ctx.fileName.replace(/\.reviewed\.html?$/i, "").replace(/\.html?$/i, "");
	return base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || ctx.docId;
}

export function exportFileName(ctx, scope) {
	const now = new Date();
	const pad = (value) => String(value).padStart(2, "0");
	const stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + "-" + pad(now.getHours()) + pad(now.getMinutes());
	const who = scope === "mine" && ctx.identity ? ctx.identity.initials.toLowerCase().replace(/[^a-z0-9]/g, "") || "me" : "all";
	return "review-" + fileSlug(ctx) + "." + who + "." + stamp + ".json";
}

export function reviewedFileName(name) {
	const base = String(name || "document.html");
	if (/\.reviewed\.html?$/i.test(base)) return base;
	return base.replace(/\.html?$/i, "") + ".reviewed.html";
}

export async function fetchOwnSource(ctx) {
	if (!/^https?:$/.test(String(ctx.win.location.protocol))) return null;
	try {
		const response = await ctx.win.fetch(ctx.win.location.href, { cache: "no-store" });
		return response.ok ? await response.text() : null;
	} catch {
		return null;
	}
}

// The reviewed copy, from source bytes: { ok, name, html, warning } or
// { ok: false, needsFile, error }.
export async function saveReviewedCopy(ctx, scope, file) {
	let source = null;
	if (file) {
		try {
			source = await file.text();
		} catch {
			return { ok: false, needsFile: true, error: "That file could not be read." };
		}
	} else source = await fetchOwnSource(ctx);
	if (source === null) return { ok: false, needsFile: true };
	return buildReviewedCopy(ctx, scope, source, !!file);
}

export function buildReviewedCopy(ctx, scope, input, picked) {
	const composed = composeReviewedCopy(ctx, scope, input, picked);
	if (!composed.ok) return composed;
	const name = reviewedFileName(ctx.fileName);
	const ok = downloadText(ctx, name, composed.html, "text/html");
	ctx.lastReviewedCopy = composed.html;
	return ok ? { ok: true, name, html: composed.html, warning: composed.warning } : { ok: false, error: "Downloads are blocked here. Use Download review instead." };
}

// The reviewed copy's bytes, without downloading: { ok, html, warning } or { ok: false, needsFile, error }.
export function composeReviewedCopy(ctx, scope, input, picked) {
	let source = String(input);
	const docId = readMetaContent(source, "vpk-doc-id");
	if (docId !== ctx.docId) return { ok: false, needsFile: true, error: picked ? "This isn't the same document. Choose " + ctx.fileName + "." : "This page could not read its own file. Choose " + ctx.fileName + "." };
	const revision = readMetaContent(source, "vpk-doc-revision") || "r1";
	if (revision !== ctx.revision) return { ok: false, needsFile: true, error: "This file is " + revision + "; you're viewing " + ctx.revision + "." };
	// The copy replaces the file's review block, so records a cap left out on
	// load would vanish from it: refuse instead (B2 decision 10a), as --embed-review does.
	const cut = leftOutLines(ctx, scope);
	if (cut) return { ok: false, error: cut + ", so a reviewed copy would leave them out. Nothing was saved; Download review saves what is loaded." };
	let warning = null;
	const providers = ctx.win.__VPK_CONTENT__;
	if (providers && typeof providers === "object") {
		for (const type of Object.keys(providers)) {
			const provider = providers[type];
			if (!provider || typeof provider.applyToSource !== "function") continue;
			try {
				const next = provider.applyToSource(source);
				if (typeof next === "string" && next) source = next;
			} catch (error) {
				warning = "Content state not saved: " + (error && error.message ? error.message : String(error));
				showToast(ctx, warning);
			}
		}
	}
	return { ok: true, html: setEmbeddedReviewText(source, exportReviewValue(ctx, scope)), warning };
}

// What a load left out that the scope ("mine": the reader's own records) would miss, or "".
export function leftOutLines(ctx, scope) {
	const counts = scope === "mine" ? { comments: ctx.leftOut.mine } : ctx.leftOut;
	return capIssues(counts, "not loaded").join("; ");
}

// { raw, issue }: JSON text, or reviewed HTML whose data-vpk-review island is read.
export function parseImportText(text, name) {
	const clean = String(text || "").charCodeAt(0) === 65279 ? String(text).slice(1) : String(text || "");
	try {
		if (/^\s*[[{]/.test(clean)) return { raw: parseJsonIsland(clean), issue: null };
		const island = findReviewIsland(clean);
		if (!island) return { raw: null, issue: name + ": no embedded review found" };
		return { raw: parseJsonIsland(island.text), issue: null };
	} catch (error) {
		return { raw: null, issue: name + ": " + (error && error.message ? error.message : "unreadable") };
	}
}

export async function readImportFiles(ctx, files) {
	const list = [...(files || [])];
	let accepted = 0;
	let comments = 0;
	const refused = { comments: 0, decisions: 0, reviewers: 0 };
	const reviewers = new Set();
	const issues = [];
	for (const file of list) {
		let text = null;
		try {
			text = await file.text();
		} catch {
			issues.push(file.name + ": unreadable");
			continue;
		}
		const result = importReviewValue(ctx, text, file.name);
		issues.push(...result.issues);
		if (result.rejected) continue;
		accepted++;
		comments += result.comments;
		for (const field of Object.keys(refused)) refused[field] += result.refused[field] || 0;
		for (const id of result.reviewerIds || []) reviewers.add(id);
	}
	refreshAll(ctx);
	const dot = dotSep();
	// Counts what the review now holds; records a cap refused are named, never hidden.
	const cut = capIssues(refused, "not imported");
	const summary = "Imported " + plural(accepted, "file") + dot + plural(comments, "comment") + " from " + plural(reviewers.size, "reviewer") + (cut.length ? dot + cut.join(dot) : issues.length ? dot + plural(issues.length, "issue") : "");
	ctx.lastImport = { files: accepted, comments, refused: refused.comments, refusedDecisions: refused.decisions, refusedReviewers: refused.reviewers, reviewers: reviewers.size, issues };
	showToast(ctx, summary);
	return ctx.lastImport;
}

export function estimateBytes(ctx) {
	const now = Date.now();
	if (ctx.sizeCache && now - ctx.sizeCache.at < 5000) return ctx.sizeCache.bytes;
	let bytes = 0;
	try {
		bytes = new Blob([ctx.doc.documentElement.outerHTML]).size;
	} catch {
		bytes = 0;
	}
	ctx.sizeCache = { at: now, bytes };
	return bytes;
}

export function handlePageDrop(ctx, event) {
	const transfer = event.dataTransfer;
	const types = transfer ? [...(transfer.types || [])] : [];
	if (!types.includes("Files") || event.defaultPrevented) return;
	if (pathHasAttribute(event, "data-vpk-file-drop") || pathHasAttribute(event, "data-vpk-review-ui")) return;
	event.preventDefault();
	if (event.type === "dragover") {
		transfer.dropEffect = "copy";
		return;
	}
	const files = [...transfer.files].filter((file) => /\.(?:json|html?)$/i.test(file.name) || /json|html/.test(file.type));
	if (files.length) readImportFiles(ctx, files);
}

export function createHostBridge(ctx) {
	const win = ctx.win;
	if (!win.parent || win.parent === win) return;
	win.addEventListener("message", (event) => onHostMessage(ctx, event));
	postHello(ctx);
}

export function postHello(ctx) {
	const counts = reviewCounts(ctx);
	ctx.lastHello = counts.open + "/" + counts.total;
	try {
		ctx.win.parent.postMessage({ type: "vpk-review:hello", v: 1, docId: ctx.docId, revision: ctx.revision, title: ctx.title, counts: { open: counts.open, total: counts.total }, capabilities: ["send"] }, "*");
	} catch {
		// A detached parent; nothing to tell.
	}
}

// Re-announces counts to the host when they change (no comment text).
export function notifyHost(ctx) {
	const win = ctx.win;
	if (!win.parent || win.parent === win || !ctx.host) return;
	const counts = reviewCounts(ctx);
	if (counts.open + "/" + counts.total !== ctx.lastHello) postHello(ctx);
}

export function onHostMessage(ctx, event) {
	if (event.source !== ctx.win.parent) return;
	const data = event.data;
	if (!data || typeof data !== "object" || data.v !== 1 || typeof data.type !== "string") return;
	if (data.type === "vpk-review:host-hello") {
		if (!ctx.hostOrigin && /^https?:\/\//.test(String(event.origin))) ctx.hostOrigin = event.origin;
		if (!ctx.hostOrigin || event.origin !== ctx.hostOrigin) return;
		const agents = Array.isArray(data.agents) ? data.agents.filter((agent) => typeof agent === "string").slice(0, 8) : [];
		ctx.host = { host: "vpk", agent: typeof data.agent === "string" ? data.agent.slice(0, 40) : null, agents, canSend: data.canSend === true };
		// VPK's artifact action bar overlays the frame's top-right corner; the
		// drawer starts below it so its header and Close stay reachable.
		if (ctx.ui.drawer) ctx.ui.drawer.classList.add("is-hosted");
		if (ctx.ui.toast) ctx.ui.toast.classList.add("is-hosted");
		postHello(ctx);
		renderPanel(ctx);
		return;
	}
	if (data.type === "vpk-review:send-result" && event.origin === ctx.hostOrigin) {
		const pending = ctx.pending.get(data.requestId);
		if (!pending) return;
		ctx.pending.delete(data.requestId);
		ctx.win.clearTimeout(pending.timer);
		pending.resolve({ ok: data.ok === true, fromHost: true, message: typeof data.message === "string" ? data.message.slice(0, 300) : "", windowName: typeof data.windowName === "string" ? data.windowName.slice(0, 120) : null });
	}
}

// Open roots and their replies (what a send includes).
export function sendableIds(ctx) {
	const live = ctx.review.comments.filter((comment) => !comment.deleted);
	const roots = new Set(live.filter((comment) => !comment.parentId && comment.status !== "resolved").map((comment) => comment.id));
	return live.filter((comment) => roots.has(comment.id) || roots.has(comment.parentId)).map((comment) => comment.id);
}

// The markdown plus each content provider's saved state (R19 R2): exportState without images, as a
// fenced json section. A section that would take the send past the limit is replaced by its note;
// a provider that throws is skipped. Returns { markdown, notes } (the notes are for the reader).
export function withContentState(ctx, markdown) {
	const providers = ctx.win.__VPK_CONTENT__;
	const notes = [];
	if (!providers || typeof providers !== "object") return { markdown, notes };
	let out = markdown;
	for (const type of Object.keys(providers)) {
		const provider = providers[type];
		if (!provider || typeof provider.exportState !== "function") continue;
		let json;
		try {
			json = JSON.stringify(provider.exportState({ includeImages: false }), null, 2);
		} catch (error) {
			notes.push("Content state not sent: " + (error && error.message ? error.message : String(error)));
			continue;
		}
		if (typeof json !== "string") continue;
		const section = contentStateSection(type, json);
		if (utf8Length(out) + 1 + utf8Length(section) <= 61440) out += "\n" + section;
		else {
			out += "\n" + contentStateSection(type, null);
			notes.push("Content state too large; use Export JSON");
		}
	}
	return { markdown: out, notes };
}

export function sendToAgent(ctx) {
	const win = ctx.win;
	if (!ctx.host || !ctx.host.canSend || !ctx.hostOrigin) return Promise.resolve({ ok: false, message: "Open this page inside VPK to send it to an agent." });
	const comments = buildMarkdown(ctx, "copy");
	if (utf8Length(comments) > 61440) return Promise.resolve({ ok: false, message: "Too large to send; use Download review" });
	const { markdown, notes } = withContentState(ctx, comments);
	if (notes.length) showToast(ctx, notes.join("; "));
	const ids = sendableIds(ctx);
	const counts = reviewCounts(ctx);
	const requestId = createId("q");
	return new Promise((resolve) => {
		const timer = win.setTimeout(() => {
			ctx.pending.delete(requestId);
			resolve({ ok: false, message: "VPK did not answer (timed out after 30 s)" });
		}, 30000);
		ctx.pending.set(requestId, { timer, resolve: (result) => {
			if (result.ok) markSent(ctx, ids);
			resolve(result);
		} });
		win.parent.postMessage({ type: "vpk-review:send", v: 1, requestId, docId: ctx.docId, revision: ctx.revision, title: ctx.title, markdown, commentIds: ids, counts: { open: counts.open, total: counts.total } }, ctx.hostOrigin);
	});
}

export function markSent(ctx, ids) {
	const set = new Set(ids);
	const now = nowIso();
	ctx.review.comments = ctx.review.comments.map((comment) => (set.has(comment.id) ? Object.assign({}, comment, { sentAt: now }) : comment));
	saveState(ctx);
}

// Share-tab flows (drop zone, save dialog, copy, download, send), wired by panel.renderShareTab.
export function dropZone(ctx, text, onFiles) {
	const zone = h(ctx, "div", { class: "vr-drop", text });
	zone.addEventListener("dragover", (event) => {
		event.preventDefault();
		zone.classList.add("is-over");
	});
	zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
	zone.addEventListener("drop", (event) => {
		event.preventDefault();
		event.stopPropagation();
		zone.classList.remove("is-over");
		const files = event.dataTransfer ? [...event.dataTransfer.files] : [];
		if (files.length) onFiles(files);
	});
	return zone;
}

export function saveFlowBox(ctx, reviewers) {
	const flow = ctx.saveFlow;
	const box = h(ctx, "div", { class: "vr-stack vr-dialog", role: "group", "aria-label": "Save reviewed copy" });
	if (flow.step === "scope") {
		const option = (value, label) => {
			const radio = h(ctx, "input", { type: "radio", name: "vr-scope", value });
			radio.checked = flow.scope === value;
			radio.addEventListener("change", () => (flow.scope = value));
			return h(ctx, "label", { class: "vr-check" }, [radio, " " + label]);
		};
		appendNodes(ctx, box, [
			h(ctx, "p", { class: "vr-where", text: "Which comments go into the copy?" }),
			ctx.identity ? option("mine", "My comments") : null,
			option("all", "Everyone's comments (" + plural(reviewers, "person", "people") + ")"),
			h(ctx, "div", { class: "vr-row-actions" }, [
				uiButton(ctx, { label: "Continue", onClick: () => runSave(ctx, null) }),
				uiButton(ctx, { label: "Cancel", onClick: () => {
					ctx.saveFlow = null;
					ctx.focusAfter = focusSaveOpener;
					renderShareTab(ctx);
				} }),
			]),
		]);
	} else {
		const input = h(ctx, "input", { type: "file", accept: ".html,text/html", class: "vr-file", "aria-label": "Choose this same file" });
		input.addEventListener("change", () => {
			if (input.files && input.files[0]) runSave(ctx, input.files[0]);
		});
		appendNodes(ctx, box, [
			h(ctx, "p", { class: "vr-where", text: "Browsers don't let a page read its own file. Choose this same file (" + ctx.fileName + ") and the copy is saved next to your downloads." }),
			uiButton(ctx, { label: "Choose file", onClick: () => input.click() }),
			input,
			dropZone(ctx, "Or drop " + ctx.fileName + " here", (files) => runSave(ctx, files[0])),
			uiButton(ctx, { label: "Cancel", onClick: () => {
				ctx.saveFlow = null;
				ctx.focusAfter = focusSaveOpener;
				renderShareTab(ctx);
			} }),
		]);
	}
	if (flow.message) box.appendChild(h(ctx, "p", { class: "vr-notice", role: "alert", text: flow.message }));
	return box;
}

export async function runSave(ctx, file) {
	const flow = ctx.saveFlow;
	if (!flow) return;
	const result = await saveReviewedCopy(ctx, flow.scope, file);
	if (result.needsFile) {
		flow.step = "pick";
		ctx.focusAfter = (panel) => panel.querySelector(".vr-dialog .vr-btn");
	}
	if (result.error) flow.message = result.error;
	if (result.ok) {
		ctx.saveFlow = null;
		ctx.focusAfter = focusSaveOpener;
		showToast(ctx, "Saved " + result.name + (result.warning ? dotSep() + result.warning : ""));
	}
	renderShareTab(ctx);
}

// After the save dialog closes, focus returns to the button that opened it.
export function focusSaveOpener(panel) {
	return panel.querySelector(".vr-save-open");
}

export async function runCopy(ctx) {
	const text = buildMarkdown(ctx, "copy");
	const how = await copyText(ctx, text);
	ctx.copyFallback = how === "manual" ? text : null;
	const cut = leftOutLines(ctx, "all");
	if (how === "manual") renderShareTab(ctx);
	// The warning shows on the manual-copy path too (B2 decision 19b); the markdown carries it as well.
	if (how !== "manual" || cut) showToast(ctx, (how === "manual" ? "Copy the text below" : "Copied the review for your agent") + (cut ? dotSep() + cut + ", so they are not in it" : ""));
}

export function runDownload(ctx, scope) {
	const value = exportReviewValue(ctx, scope);
	const json = JSON.stringify(value, null, 2);
	const name = exportFileName(ctx, scope);
	const ok = downloadText(ctx, name, json, "application/json");
	const cut = leftOutLines(ctx, scope);
	showToast(ctx, (ok ? "Downloaded " + name : "Downloads are blocked here") + (cut ? dotSep() + cut + ", so they are not in it" : ""), { label: "Copy JSON", run: () => copyText(ctx, json).then((how) => {
		ctx.copyFallback = how === "manual" ? json : null;
		renderShareTab(ctx);
	}) });
}

// True when the open drawer overlaps where the host's own toast shows (the selector toast: bottom
// centre, up to 520 px wide, under the review UI). `box` is the drawer's rect, `text` the toast text.
export function hostToastCovered(box, width, height, text) {
	const half = Math.min(520, width - 32, 30 + text.length * 7) / 2;
	return box.left < width / 2 + half && box.right > width / 2 - half && box.top < height - 18 && box.bottom > height - 58;
}

export async function runSend(ctx) {
	resolveComments(ctx);
	const result = await sendToAgent(ctx);
	if (!result.fromHost) showToast(ctx, result.message || (result.ok ? "Sent" : "Not sent"));
	else {
		const text = result.ok ? result.message || "Sent" : "Not sent" + (result.message ? ": " + result.message : "");
		// The host shows its own notification, and a second one beside it would be noise (r1.7), so the
		// runtime only announces the answer. But on a phone sheet, or a side drawer that reaches the
		// centred host toast, the drawer covers that notification, so the answer shows here instead
		// (a failure stays longer). The toast is a status region, so it is not announced twice.
		const win = ctx.win;
		if (ctx.isOpen && ctx.ui.drawer && hostToastCovered(ctx.ui.drawer.getBoundingClientRect(), win.innerWidth, win.innerHeight, text)) showToast(ctx, text, result.ok ? undefined : { ms: 10000 });
		else announce(ctx, text);
	}
	refreshAll(ctx);
}
