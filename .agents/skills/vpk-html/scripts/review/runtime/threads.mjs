/*
 * review/runtime/threads: the Comments tab of the review drawer (ws1 4.8): thread order and filter,
 * thread rows with replies, resolve/edit/delete-with-undo, jump, list keyboard, and the focus
 * save/restore the drawer's other tabs share. Split out of panel.mjs in P3 (B2 decision 19g) so
 * the panel has room for the M2 Layout tab and Owner mode.
 *
 * Serialized module: named function imports and export function declarations only, no
 * module-level state, plain ASCII.
 */

import { addressedIndex, threadsFrom } from "../merge.mjs";
import { nowIso } from "../schema.mjs";
import { excerpt } from "../text.mjs";
import { displayTone, reviewerFor, setCommentStatus, threadStatus, updateComment } from "./boot.mjs";
import { openComposer, enterBlockPicker, renderInlineComposer } from "./composer.mjs";
import { appendNodes, clearNode, clockTime, h, relativeTime, revealInView, uiButton } from "./dom.mjs";
import { paintHighlights, scheduleLayout } from "./highlights.mjs";
import { reattachBar } from "./owner.mjs";
import { showToast } from "./panel.mjs";

export function orderedThreads(ctx) {
	const { threads, loose } = threadsFrom(ctx.review);
	const groupOf = (thread) => {
		const root = thread.root;
		const resolution = ctx.resolutions.get(root.id);
		if (root.kind === "doc" || !root.anchor) return [0, 0];
		if (resolution && resolution.status === "orphaned") return [3, 0];
		if (resolution && typeof resolution.start === "number") return [1, resolution.start];
		return [2, 0];
	};
	const list = threads.map((thread, position) => ({ thread, position, group: groupOf(thread) }))
		.sort((a, b) => a.group[0] - b.group[0] || a.group[1] - b.group[1] || a.position - b.position)
		.map((item) => item.thread);
	return { threads: list, loose };
}

export function matchesFilter(ctx, thread) {
	const status = threadStatus(ctx, thread.root);
	const resolution = ctx.resolutions.get(thread.root.id);
	if (ctx.filter === "all") return true;
	if (ctx.filter === "orphaned") return !!resolution && resolution.status === "orphaned";
	return status === ctx.filter;
}

// Focus survives panel rebuilds: the focused control is found again by owner
// data-id, tag and label (nth of that key), else its thread row, else the same
// position, else the tab. ctx.focusAfter (panel => node) overrides once.
export function focusables(panel) {
	return [...panel.querySelectorAll("button, input, select, textarea, [tabindex]")].filter((node) => !node.disabled && node.type !== "file" && !node.closest("[hidden]"));
}

export function focusKeys(nodes) {
	const seen = new Map();
	return nodes.map((node) => {
		const owner = node.closest("[data-id]");
		const base = (owner ? owner.getAttribute("data-id") : "") + "|" + node.localName + "|" + String(node.getAttribute("aria-label") || node.getAttribute("value") || node.textContent || "").trim();
		const count = seen.get(base) || 0;
		seen.set(base, count + 1);
		return base + "#" + count;
	});
}

export function captureFocus(ctx, panel) {
	const active = ctx.ui.shadow.activeElement;
	if (!active || !panel.contains(active)) return null;
	const nodes = focusables(panel);
	const at = nodes.indexOf(active);
	const thread = active.closest(".vr-thread");
	return { key: at >= 0 ? focusKeys(nodes)[at] : null, at: Math.max(0, at), thread: thread ? thread.getAttribute("data-id") : null };
}

export function restoreFocus(ctx, panel, saved) {
	const after = ctx.focusAfter;
	ctx.focusAfter = null;
	const active = ctx.ui.shadow.activeElement;
	if (!after && (!saved || (active && panel.contains(active)))) return;
	const nodes = focusables(panel);
	let target = after ? after(panel) : null;
	if (!target && saved) {
		const keys = focusKeys(nodes);
		target = nodes[keys.indexOf(saved.key)] || (saved.thread ? nodes.find((node) => node.classList.contains("vr-thread") && node.getAttribute("data-id") === saved.thread) : null) || nodes[Math.min(saved.at, nodes.length - 1)] || ctx.ui.tabs[ctx.tab];
	}
	if (target) target.focus();
}

export function renderComments(ctx) {
	const panel = ctx.ui.panels.comments;
	const saved = captureFocus(ctx, panel);
	clearNode(panel);
	if (ctx.composer && ctx.composer.open) panel.appendChild(ctx.composer.el);
	const filters = h(ctx, "div", { class: "vr-filters", role: "group", "aria-label": "Show" });
	for (const [key, label] of [["open", "Open"], ["addressed", "Addressed"], ["resolved", "Resolved"], ["orphaned", "Orphaned"], ["all", "All"]]) {
		filters.appendChild(uiButton(ctx, { label, cls: "vr-chip-btn", pressed: ctx.filter === key, onClick: () => {
			ctx.filter = key;
			renderComments(ctx);
			paintHighlights(ctx);
			scheduleLayout(ctx);
		} }));
	}
	const actions = h(ctx, "div", { class: "vr-row-actions" }, [
		uiButton(ctx, { label: "Comment on a block", onClick: () => enterBlockPicker(ctx) }),
		uiButton(ctx, { label: "General comment", onClick: () => openComposer(ctx, { kind: "doc", anchor: null, label: "General comment" }) }),
	]);
	appendNodes(ctx, panel, [filters, actions]);
	const { threads, loose } = orderedThreads(ctx);
	const visible = threads.filter((thread) => matchesFilter(ctx, thread));
	const list = h(ctx, "div", { class: "vr-threads", role: "list", "aria-label": "Comment threads" });
	visible.forEach((thread, position) => list.appendChild(threadRow(ctx, thread, position === 0)));
	if (!visible.length) list.appendChild(h(ctx, "p", { class: "vr-empty", text: ctx.filter === "open" ? "No open comments. Select text and press C, or use Comment on a block." : "Nothing here." }));
	list.addEventListener("keydown", (event) => onThreadListKey(ctx, event));
	panel.appendChild(list);
	if (loose.length && ctx.filter === "all") {
		panel.appendChild(h(ctx, "h3", { class: "vr-sub", text: "Replies without a thread" }));
		for (const reply of loose) panel.appendChild(h(ctx, "p", { class: "vr-loose", text: reviewerFor(ctx, reply.authorId).name + ": " + reply.body }));
	}
	restoreFocus(ctx, panel, saved);
}

export function chipsFor(ctx, root, resolution) {
	const status = threadStatus(ctx, root);
	const chips = [];
	if (status === "addressed") chips.push("addressed in " + (addressedIndex(ctx.registry).get(root.id) || {}).revision);
	else if (status === "resolved") chips.push("resolved");
	if (resolution && resolution.status && !["exact", "css"].includes(resolution.status) && root.anchor) chips.push(resolution.status === "orphaned" ? "orphaned" : resolution.status);
	if (root.sentAt) chips.push("sent to agent " + clockTime(root.sentAt));
	return chips;
}

export function personLine(ctx, comment, extra) {
	const author = reviewerFor(ctx, comment.authorId);
	return h(ctx, "div", { class: "vr-who" }, [
		h(ctx, "span", { class: "vr-initials vr-tone-" + displayTone(ctx, comment.authorId), "aria-hidden": "true", text: author.initials }),
		h(ctx, "span", { class: "vr-name", text: author.name }),
		h(ctx, "span", { class: "vr-time", text: relativeTime(comment.createdAt) }),
		extra || null,
	]);
}

export function threadRow(ctx, thread, first) {
	const root = thread.root;
	const resolution = ctx.resolutions.get(root.id) || null;
	const status = threadStatus(ctx, root);
	const author = reviewerFor(ctx, root.authorId);
	const mine = !!ctx.identity && ctx.identity.id === root.authorId;
	const row = h(ctx, "div", { class: "vr-thread" + (root.id === ctx.activeId ? " is-active" : ""), role: "listitem", "data-id": root.id, tabindex: first ? "0" : "-1", "aria-label": author.name + ": " + excerpt(root.deleted ? "deleted comment" : root.body, 80) });
	const chips = chipsFor(ctx, root, resolution).map((text) => h(ctx, "span", { class: "vr-chip", text }));
	row.appendChild(personLine(ctx, root, chips));
	const anchor = root.anchor;
	const where = !anchor ? "General comment" : anchor.quote ? anchor.quote.exact : "Block: " + (anchor.blockText || anchor.blockTag || "");
	row.appendChild(h(ctx, "p", { class: anchor && anchor.quote ? "vr-quote" : "vr-where", text: excerpt(where, 240) }));
	if (resolution && resolution.changedText) row.appendChild(h(ctx, "p", { class: "vr-where", text: "Now reads: " + excerpt(resolution.changedText, 160) }));
	row.appendChild(h(ctx, "p", { class: "vr-body", text: root.deleted ? "(comment deleted)" : root.body }));
	if (ctx.inline && ctx.inline.mode === "edit" && ctx.inline.id === root.id) row.appendChild(renderInlineComposer(ctx));
	for (const reply of thread.replies) {
		const box = h(ctx, "div", { class: "vr-reply", "data-id": reply.id }, [personLine(ctx, reply), h(ctx, "p", { class: "vr-body", text: reply.body })]);
		if (ctx.identity && ctx.identity.id === reply.authorId) box.appendChild(ownActions(ctx, reply));
		if (ctx.inline && ctx.inline.mode === "edit" && ctx.inline.id === reply.id) box.appendChild(renderInlineComposer(ctx));
		row.appendChild(box);
	}
	const reattach = reattachBar(ctx, root, resolution);
	if (reattach) row.appendChild(reattach);
	const bar = h(ctx, "div", { class: "vr-actions" });
	if (resolution && (resolution.range || resolution.el)) bar.appendChild(uiButton(ctx, { label: "Jump", onClick: () => jumpToThread(ctx, root.id) }));
	bar.appendChild(uiButton(ctx, { label: "Reply", icon: "reply", onClick: () => startInline(ctx, "reply", root.id, "") }));
	bar.appendChild(uiButton(ctx, { label: status === "resolved" ? "Reopen" : "Resolve", icon: status === "resolved" ? null : "check", onClick: () => setCommentStatus(ctx, root.id, status === "resolved" ? "open" : "resolved") }));
	if (mine && !root.deleted) bar.appendChild(ownActions(ctx, root));
	row.appendChild(bar);
	if (ctx.inline && ctx.inline.mode === "reply" && ctx.inline.id === root.id) row.appendChild(renderInlineComposer(ctx));
	row.addEventListener("click", (event) => {
		if (event.target === row || event.target.classList.contains("vr-body") || event.target.classList.contains("vr-quote")) {
			ctx.activeId = root.id;
			paintHighlights(ctx);
			scheduleLayout(ctx);
		}
	});
	return row;
}

// "More actions" (author only): Edit and Delete (a tombstone with a 5 s Undo).
export function ownActions(ctx, comment) {
	const box = h(ctx, "span", { class: "vr-more" });
	const menu = h(ctx, "span", { class: "vr-more-menu", hidden: true }, [
		uiButton(ctx, { label: "Edit", onClick: () => startInline(ctx, "edit", comment.id, comment.body) }),
		uiButton(ctx, { label: "Delete", onClick: () => deleteWithUndo(ctx, comment.id) }),
	]);
	const toggle = uiButton(ctx, { label: String.fromCharCode(8943), title: "More actions", hideLabel: false, cls: "vr-icon-btn" });
	toggle.setAttribute("aria-label", "More actions");
	toggle.setAttribute("aria-expanded", "false");
	toggle.addEventListener("click", () => {
		menu.hidden = !menu.hidden;
		toggle.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
	});
	appendNodes(ctx, box, [toggle, menu]);
	return box;
}

// Undo puts focus back on the restored thread (clearToast covers the rest).
export function deleteWithUndo(ctx, id) {
	const comment = ctx.review.comments.find((entry) => entry.id === id);
	updateComment(ctx, id, { deleted: true, deletedAt: nowIso() });
	showToast(ctx, "Comment deleted", { label: "Undo", ms: 5000, run: () => {
		updateComment(ctx, id, { deleted: false, deletedAt: nowIso() });
		if (ctx.isOpen && ctx.tab === "comments") focusThread(ctx, (comment && comment.parentId) || id);
	} });
}

export function startInline(ctx, mode, id, text) {
	ctx.inline = { mode, id, text: text || "" };
	renderComments(ctx);
	const area = ctx.ui.panels.comments.querySelector(".vr-inline-text");
	if (area) area.focus();
}

export function focusThread(ctx, id) {
	const rows = [...ctx.ui.panels.comments.querySelectorAll(".vr-thread")];
	const target = rows.find((row) => row.getAttribute("data-id") === id);
	if (!target) return false;
	for (const row of rows) row.setAttribute("tabindex", row === target ? "0" : "-1");
	target.focus();
	if (typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "nearest" });
	return true;
}

export function jumpToThread(ctx, id) {
	const resolution = ctx.resolutions.get(id);
	if (!resolution) return;
	ctx.activeId = id;
	paintHighlights(ctx);
	renderComments(ctx);
	focusThread(ctx, id);
	revealInView(ctx, resolution.range || resolution.el);
	scheduleLayout(ctx);
}

export function onThreadListKey(ctx, event) {
	const row = event.target;
	if (!row || !row.classList || !row.classList.contains("vr-thread")) return;
	const rows = [...ctx.ui.panels.comments.querySelectorAll(".vr-thread")];
	const at = rows.indexOf(row);
	const move = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: rows.length - 1 }[event.key];
	if (move !== undefined) {
		event.preventDefault();
		const next = rows[Math.max(0, Math.min(rows.length - 1, move))];
		if (next) focusThread(ctx, next.getAttribute("data-id"));
		return;
	}
	if (event.key === "Enter") {
		event.preventDefault();
		jumpToThread(ctx, row.getAttribute("data-id"));
	} else if (event.key === "r" || event.key === "R") {
		event.preventDefault();
		startInline(ctx, "reply", row.getAttribute("data-id"), "");
	}
}
