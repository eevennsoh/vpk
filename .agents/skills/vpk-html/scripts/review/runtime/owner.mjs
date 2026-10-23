/*
 * review/runtime/owner: the M2 owner tools of the review drawer (ws1 4.7, 4.8, 9 M2):
 *   Owner mode      a local toggle in the Share tab: import, "Resolve all addressed" and the
 *                   embed instructions in one group (memory only; it is off on every load)
 *   Re-attach       for an orphaned thread: select the new text and press C, or pick a block; the
 *                   comment's anchor is replaced (anchorAt, so the merge keeps the newer anchor)
 *   Storage meter   what this browser holds for this document and for all reviewed documents,
 *                   with "Clear this document" (removes only this document's saved comments, its
 *                   seen receipt and its index entry; other documents and the identity stay)
 *
 * Serialized module: named function imports and export function declarations only, no
 * module-level state, plain ASCII.
 */

import { threadsFrom } from "../merge.mjs";
import { nowIso } from "../schema.mjs";
import { announce, loadState, readStore, refreshAll, reviewCounts, saveState, threadStatus, updateComment, writeStore } from "./boot.mjs";
import { enterBlockPicker, exitBlockPicker } from "./composer.mjs";
import { h, plural, uiButton } from "./dom.mjs";
import { dotSep, renderShareTab, showToast } from "./panel.mjs";
import { focusThread, renderComments } from "./threads.mjs";

// The root threads that read "addressed": a revision lists them and nobody resolved them since.
export function addressedThreadIds(ctx) {
	return threadsFrom(ctx.review).threads.filter((thread) => !thread.root.deleted && threadStatus(ctx, thread.root) === "addressed").map((thread) => thread.root.id);
}

// Owner mode: resolves exactly the addressed set, in one write.
export function resolveAllAddressed(ctx) {
	const ids = new Set(addressedThreadIds(ctx));
	if (!ids.size) return showToast(ctx, "No addressed comments to resolve");
	const change = { status: "resolved", statusAt: nowIso() };
	if (ctx.identity) change.statusBy = ctx.identity.id;
	ctx.review.comments = ctx.review.comments.map((comment) => (ids.has(comment.id) ? Object.assign({}, comment, change) : comment));
	saveState(ctx);
	refreshAll(ctx);
	ctx.focusAfter = (panel) => panel.querySelector(".vr-owner-toggle");
	renderShareTab(ctx);
	showToast(ctx, "Resolved " + plural(ids.size, "addressed comment"));
}

// The Owner mode toggle; when on, the group also holds the import box, the summary, the bulk
// resolve and the embed instructions. `bring` is the Share tab's "Bring comments in" box.
export function ownerBlock(ctx, bring) {
	const toggle = uiButton(ctx, { label: "Owner mode", cls: "vr-owner-toggle", pressed: !!ctx.owner, onClick: () => {
		ctx.owner = !ctx.owner;
		ctx.focusAfter = (panel) => panel.querySelector(".vr-owner-toggle");
		renderShareTab(ctx);
	} });
	if (!ctx.owner) return h(ctx, "div", { class: "vr-stack" }, [bring, toggle]);
	const counts = reviewCounts(ctx);
	const addressed = addressedThreadIds(ctx).length;
	const dot = dotSep();
	return h(ctx, "div", { class: "vr-stack", role: "group", "aria-label": "Owner tools" }, [
		toggle,
		h(ctx, "p", { class: "vr-where", text: plural(counts.total, "thread") + dot + addressed + " addressed" + dot + counts.orphaned + " orphaned" + dot + plural(ctx.review.reviewers.length, "reviewer") }),
		bring,
		uiButton(ctx, { label: "Resolve all addressed", cls: "vr-resolve-all", disabled: !addressed, onClick: () => resolveAllAddressed(ctx) }),
		h(ctx, "p", { class: "vr-where", text: "To keep the whole conversation in the file: download everyone's comments, then ask your agent to run build.mjs --embed-review <review.json> " + ctx.fileName + "." }),
	]);
}

// ---- Re-attach ----

// The orphaned thread's control: a Re-attach button, or the pick prompt once it is started.
export function reattachBar(ctx, root, resolution) {
	if (root.deleted || !resolution || resolution.status !== "orphaned" || (root.kind !== "text" && root.kind !== "block")) return null;
	if (!ctx.reattach || ctx.reattach.id !== root.id) return h(ctx, "div", { class: "vr-actions" }, [uiButton(ctx, { label: "Re-attach", onClick: () => startReattach(ctx, root.id) })]);
	return h(ctx, "div", { class: "vr-stack", role: "group", "aria-label": "Re-attach comment" }, [
		h(ctx, "p", { class: "vr-where", text: "Select the text this comment belongs to on the page and press C, or pick a block." }),
		h(ctx, "div", { class: "vr-row-actions" }, [
			uiButton(ctx, { label: "Pick a block", onClick: () => enterBlockPicker(ctx) }),
			uiButton(ctx, { label: "Cancel", onClick: () => cancelReattach(ctx, true) }),
		]),
	]);
}

export function startReattach(ctx, id) {
	ctx.reattach = { id };
	ctx.focusAfter = (panel) => panel.querySelector(".vr-thread[data-id=\"" + id + "\"] .vr-stack .vr-btn");
	renderComments(ctx);
	announce(ctx, "Select the new text on the page and press C, or pick a block");
}

export function cancelReattach(ctx, render) {
	if (!ctx.reattach) return;
	const id = ctx.reattach.id;
	ctx.reattach = null;
	if (ctx.picker) exitBlockPicker(ctx, true);
	if (render && ctx.isOpen && ctx.tab === "comments") {
		ctx.focusAfter = (panel) => panel.querySelector(".vr-thread[data-id=\"" + id + "\"] .vr-actions .vr-btn");
		renderComments(ctx);
	}
}

// Called by openComposer with the text or block anchor the reviewer just picked.
export function applyReattach(ctx, anchor) {
	const id = ctx.reattach.id;
	ctx.reattach = null;
	ctx.selectionRange = null;
	updateComment(ctx, id, { anchor, anchorAt: nowIso() });
	ctx.activeId = id;
	showToast(ctx, "Comment re-attached");
	if (ctx.isOpen && ctx.tab === "comments") focusThread(ctx, id);
}

// ---- Storage meter ----

export function formatBytes(bytes) {
	const n = Math.max(0, Number(bytes) || 0);
	if (n < 1024) return n + " B";
	if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB";
	return (n / 1048576).toFixed(1) + " MB";
}

// { mine, total, documents } from the index key (bytes as of each document's last write).
export function storageUsage(ctx) {
	const index = readStore(ctx, ctx.keys.index) || {};
	let total = 0;
	let documents = 0;
	for (const id of Object.keys(index)) {
		total += Number(index[id] && index[id].bytes) || 0;
		documents++;
	}
	return { mine: Number(index[ctx.docId] && index[ctx.docId].bytes) || 0, total, documents };
}

export function storageBlock(ctx) {
	const box = h(ctx, "div", { class: "vr-stack" }, [h(ctx, "h3", { class: "vr-sub", text: "Saved in this browser" })]);
	if (!ctx.storageOk) {
		box.appendChild(h(ctx, "p", { class: "vr-where", text: "This browser blocks storage here, so comments live only while this page is open." }));
		return box;
	}
	const use = storageUsage(ctx);
	const limit = 5242880;
	box.appendChild(h(ctx, "p", { class: "vr-where", text: "This document " + formatBytes(use.mine) + dotSep() + plural(use.documents, "reviewed document") + ", " + formatBytes(use.total) + " of about 5 MB" }));
	box.appendChild(h(ctx, "meter", { min: "0", max: String(limit), value: String(Math.min(use.total, limit)), "aria-label": "Review storage used in this browser" }));
	if (!ctx.clearing) {
		box.appendChild(uiButton(ctx, { label: "Clear this document", cls: "vr-clear-open", onClick: () => {
			ctx.clearing = true;
			ctx.focusAfter = (panel) => panel.querySelector(".vr-clear-box .vr-btn");
			renderShareTab(ctx);
		} }));
		return box;
	}
	box.appendChild(h(ctx, "div", { class: "vr-stack vr-dialog vr-clear-box", role: "group", "aria-label": "Clear this document" }, [
		h(ctx, "p", { class: "vr-where", text: "Remove this document's saved comments from this browser? Comments embedded in the file stay. Download your review first to keep yours." }),
		h(ctx, "div", { class: "vr-row-actions" }, [
			uiButton(ctx, { label: "Cancel", onClick: () => {
				ctx.clearing = false;
				ctx.focusAfter = (panel) => panel.querySelector(".vr-clear-open");
				renderShareTab(ctx);
			} }),
			uiButton(ctx, { label: "Clear this document", cls: "vr-primary", onClick: () => clearDocument(ctx) }),
		]),
	]));
	return box;
}

// Removes this document's saved comments, seen receipt and index entry (nothing else), then
// rebuilds the working set from what the file embeds.
export function clearDocument(ctx) {
	try {
		ctx.win.localStorage.removeItem(ctx.keys.doc);
		ctx.win.localStorage.removeItem(ctx.keys.seen);
	} catch {
		// Storage vanished: the in-memory reset below still applies.
	}
	const index = readStore(ctx, ctx.keys.index);
	if (index && index[ctx.docId]) {
		delete index[ctx.docId];
		writeStore(ctx, ctx.keys.index, index);
	}
	if (ctx.timers.save) ctx.win.clearTimeout(ctx.timers.save);
	ctx.timers.save = null;
	ctx.dirty = false;
	ctx.capHold = false;
	ctx.quotaFull = false;
	ctx.hadLocal = false;
	ctx.seen = null;
	ctx.clearing = false;
	ctx.leftOut = { comments: 0, decisions: 0, reviewers: 0, mine: 0 };
	loadState(ctx);
	// loadState records a first-visit receipt; a cleared document keeps no stored key until it is used again.
	try {
		ctx.win.localStorage.removeItem(ctx.keys.seen);
	} catch {
		// Nothing stored to remove.
	}
	refreshAll(ctx);
	ctx.focusAfter = (panel) => panel.querySelector(".vr-clear-open");
	renderShareTab(ctx);
	showToast(ctx, "Cleared this document's saved comments");
}
