/*
 * review/runtime/boot: context, storage, identity, comment state and the
 * window.__VPK_REVIEW__ API of the in-page review runtime (ws1 4.7, C9, C10, C14).
 *
 * Storage keys (C10): vpk-review/1/identity, vpk-review/1/doc/<docId>,
 * vpk-review/1/seen/<docId>, vpk-review/1/index. Writes are debounced 250 ms and
 * flushed on pagehide; the embedded island and the local store are merged,
 * never replaced. Without storage, or once the quota is full, the runtime keeps
 * working in memory and says so.
 *
 * Serialized module: named function imports and export function declarations
 * only, no module-level state (everything lives in one ctx), plain ASCII.
 */

import { parseJsonIsland } from "../../json-island.mjs";
import { buildTextIndex, createBlockAnchor, createTextAnchor, findQuote, headingPathFor, resolveAnchor } from "../anchor.mjs";
import { rangeFromOffsets } from "../anchor-dom.mjs";
import { reviewMarkdown } from "../markdown.mjs";
import { addressedIndex, canonicalJson, capIssue, capIssues, commentStatus, filterOwn, mergeReviewsReport, threadsFrom } from "../merge.mjs";
import { createEmptyReview, createId, initialsFor, isDocId, isReviewerId, isRevisionId, normalizeContentRendered, normalizeRegistry, normalizeReview, nowIso, reviewLimits, toneFor } from "../schema.mjs";
import { fnv1a32, normalizeWhitespace } from "../text.mjs";
import { bindDecisions, decisionInfoMap, ensureDecisionRecords } from "./decisions.mjs";
import { createComposer, createSelectionButton, handlePageShortcut, updateSelectionButton } from "./composer.mjs";
import { createHighlighter, paintHighlights, scheduleLayout } from "./highlights.mjs";
import { closePanel, createPanel, openPanel, renderPanel, showToast } from "./panel.mjs";
import { composeReviewedCopy, createHostBridge, handlePageDrop, notifyHost, parseImportText } from "./transport.mjs";

export function readDocMeta(doc, win) {
	const meta = (name) => {
		const node = doc.querySelector("meta[name=\"" + name + "\"]");
		return node ? String(node.getAttribute("content") || "").trim() : "";
	};
	let docId = meta("vpk-doc-id");
	let fallback = false;
	if (!isDocId(docId)) {
		docId = "p" + String(fnv1a32(win.location.pathname + "\n" + (doc.title || ""))).padStart(9, "0");
		fallback = true;
	}
	const revision = isRevisionId(meta("vpk-doc-revision")) ? meta("vpk-doc-revision") : "r1";
	return { docId, revision, title: normalizeWhitespace(doc.title || "").slice(0, 300), fallback };
}

export function storageKeys(docId) {
	const base = "vpk-review/1/";
	return { identity: base + "identity", doc: base + "doc/" + docId, seen: base + "seen/" + docId, index: base + "index", probe: base + "probe" };
}

export function storageAvailable(win) {
	try {
		const store = win.localStorage;
		const key = "vpk-review/1/probe";
		store.setItem(key, "1");
		store.removeItem(key);
		return true;
	} catch {
		return false;
	}
}

export function readStore(ctx, key) {
	if (!ctx.storageOk) return null;
	try {
		const text = ctx.win.localStorage.getItem(key);
		return text ? JSON.parse(text) : null;
	} catch {
		return null;
	}
}

// False when the value could not be written (storage off, over the per-document
// cap, or the quota is full); the runtime then continues in memory.
export function writeStore(ctx, key, value) {
	if (!ctx.storageOk || ctx.quotaFull || (key === ctx.keys.doc && ctx.capHold)) return false;
	const text = JSON.stringify(value);
	if (key === ctx.keys.doc && text.length > reviewLimits().storageBytes) {
		ctx.notice = "This document's review is over 1.5 MB, so it stays in memory. Download your review before closing.";
		ctx.quotaFull = true;
		return false;
	}
	try {
		ctx.win.localStorage.setItem(key, text);
		return true;
	} catch (error) {
		const quota = error && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014);
		ctx.quotaFull = true;
		ctx.notice = quota ? "This browser's storage is full. Download your review before closing." : "Comments could not be saved in this browser. Download your review before closing.";
		return false;
	}
}

export function createContext(config, win, doc) {
	const meta = readDocMeta(doc, win);
	const storageOk = storageAvailable(win);
	const path = String(win.location.pathname || "");
	const fileName = decodeURIComponent(path.slice(path.lastIndexOf("/") + 1)) || "document.html";
	return {
		config: config || {},
		win,
		doc,
		docId: meta.docId,
		revision: meta.revision,
		title: meta.title,
		fileName,
		keys: storageKeys(meta.docId),
		storageOk,
		quotaFull: false,
		capHold: false,
		leftOut: { comments: 0, decisions: 0, reviewers: 0, mine: 0 },
		capNotice: null,
		notice: !storageOk
			? "Comments are kept only while this page is open (this browser blocks storage here). Download your review before closing."
			: meta.fallback ? "This file has no review id, so comments are keyed by its location." : null,
		review: createEmptyReview({ docId: meta.docId, revision: meta.revision, title: meta.title }),
		registry: { schema: "vpk-revisions/1", entries: [] },
		identity: null,
		seen: null,
		hadLocal: false,
		index: null,
		indexDirty: true,
		resolutions: new Map(),
		ui: {},
		tab: "comments",
		filter: "open",
		isOpen: false,
		activeId: null,
		composer: null,
		picker: null,
		owner: false,
		reattach: null,
		clearing: false,
		decisions: new Map(),
		pendingSeen: new Set(),
		reveal: { revision: null, list: [], position: -1, all: false },
		timers: {},
		host: null,
		pending: new Map(),
		dirty: false,
		undo: null,
		debug: { reindexes: 0, rendered: "none", paints: 0 },
	};
}

// Over a cap (2,000 comments, 200 decision answers, 64 reviewers) nothing is
// dropped silently (B2 decision 10a): the reader's records, then the local
// working set, keep their places (embedded records stay in the file), the
// counts left out are reported, and a stored record a cap cut is never
// overwritten (capHold: changes stay in memory).
export function loadState(ctx) {
	const identity = readStore(ctx, ctx.keys.identity);
	if (identity && isReviewerId(identity.id) && typeof identity.name === "string" && identity.name.trim()) {
		ctx.identity = { id: identity.id, name: identity.name.slice(0, 60), initials: String(identity.initials || initialsFor(identity.name)).slice(0, 3), tone: Number.isInteger(identity.tone) ? identity.tone : toneFor(identity.id) };
	}
	const reviews = [];
	const islands = ctx.doc.querySelectorAll("script[type=\"application/json\"][data-vpk-review]");
	for (const island of islands) {
		try {
			const result = normalizeReview(parseJsonIsland(island.textContent || ""), { docId: ctx.docId, cap: false });
			if (result.review) reviews.push(result.review);
		} catch {
			// An unreadable island is ignored; check-html rule 4 reports it at build time.
		}
	}
	const local = readStore(ctx, ctx.keys.doc);
	let keep = [];
	if (local) {
		const result = normalizeReview(local, { docId: ctx.docId, cap: false });
		if (result.review) {
			reviews.push(result.review);
			ctx.hadLocal = true;
			keep = reviewIds(result.review);
		}
	}
	const merged = mergeReviewsReport([createEmptyReview({ docId: ctx.docId, revision: ctx.revision, title: ctx.title }), ...reviews], { docId: ctx.docId, keep, reviewerId: ctx.identity ? ctx.identity.id : undefined });
	ctx.review = merged.review;
	const stored = new Set(keep);
	noteLeftOut(ctx, merged.dropped, merged.dropped.ids.some((id) => stored.has(id)));
	const registryNode = ctx.doc.querySelector("script[type=\"application/json\"][data-vpk-revisions]");
	if (registryNode) {
		try {
			ctx.registry = normalizeRegistry(parseJsonIsland(registryNode.textContent || "")).registry;
		} catch {
			ctx.registry = { schema: "vpk-revisions/1", entries: [] };
		}
	}
	const seen = readStore(ctx, ctx.keys.seen);
	if (seen && isRevisionId(seen.lastSeenRevision)) ctx.seen = { lastSeenRevision: seen.lastSeenRevision, seenAt: String(seen.seenAt || "") };
	// A first visit records a seen receipt, so the banner (ws1 4.11) only ever
	// greets a reader who has seen an earlier revision. Own comments count too.
	if (!ctx.seen && !ownComments(ctx).length) {
		ctx.seen = { lastSeenRevision: ctx.revision, seenAt: nowIso() };
		writeStore(ctx, ctx.keys.seen, ctx.seen);
	}
}

export function ownComments(ctx) {
	return ctx.identity ? ctx.review.comments.filter((comment) => comment.authorId === ctx.identity.id && !comment.deleted) : [];
}

// Every record id of a review (comments, "key|reviewerId" decisions, reviewers): a merge keep set.
export function reviewIds(review) {
	return [...review.comments.map((comment) => comment.id), ...review.decisions.map((decision) => decision.key + "|" + decision.reviewerId), ...review.reviewers.map((reviewer) => reviewer.id)];
}

// Adds what a merge left out to ctx.leftOut; hold stops writes so stored records stay.
export function noteLeftOut(ctx, dropped, hold) {
	for (const field of ["comments", "decisions", "reviewers", "mine"]) ctx.leftOut[field] += dropped[field] || 0;
	if (hold) ctx.capHold = true;
	updateCapNotice(ctx);
}

// The persistent cap line in the drawer notice: what a load left out, and a full review.
export function updateCapNotice(ctx) {
	const parts = [];
	const lines = capIssues(ctx.leftOut, "not loaded");
	if (lines.length) parts.push(lines.join("; ") + (ctx.capHold ? "; changes stay in memory so the stored ones are kept" : "") + ".");
	if (ctx.review.comments.length >= reviewLimits().comments) parts.push("This review is full, so new comments and replies are off.");
	if (ctx.review.decisions.length >= reviewLimits().decisions) parts.push("Decision answers are full, so new answers are not recorded.");
	ctx.capNotice = parts.join(" ") || null;
}

// Refuses a record at a cap with a visible notice; null tells the caller to keep the draft.
export function refuseAtCap(ctx, field) {
	updateCapNotice(ctx);
	if (ctx.ui.notice) renderPanel(ctx);
	const max = reviewLimits()[field || "comments"].toLocaleString("en-US");
	showToast(ctx, "This review is full (" + max + (field === "decisions" ? " decision answers" : field === "reviewers" ? " reviewers" : " comments") + ", the most one document holds), so " + (field === "decisions" ? "your answer was not recorded." : "this comment was not added."));
	return null;
}

export function saveState(ctx) {
	ctx.dirty = true;
	if (ctx.timers.save) ctx.win.clearTimeout(ctx.timers.save);
	ctx.timers.save = ctx.win.setTimeout(() => flushState(ctx), 250);
}

export function flushState(ctx) {
	if (ctx.timers.save) ctx.win.clearTimeout(ctx.timers.save);
	ctx.timers.save = null;
	if (!ctx.dirty) return true;
	const value = workingReview(ctx);
	const hadNotice = ctx.notice;
	if (writeStore(ctx, ctx.keys.doc, value)) {
		ctx.dirty = false;
		const index = readStore(ctx, ctx.keys.index) || {};
		index[ctx.docId] = { title: ctx.title, updatedAt: nowIso(), bytes: JSON.stringify(value).length };
		writeStore(ctx, ctx.keys.index, index);
		return true;
	}
	if (ctx.notice !== hadNotice && ctx.ui.notice) renderPanel(ctx);
	return false;
}

// The working set with the current doc header (what storage and exports hold).
export function workingReview(ctx) {
	const review = JSON.parse(JSON.stringify(ctx.review));
	review.doc = { id: ctx.docId, revision: ctx.revision, title: ctx.title };
	if (/\.html?$/i.test(ctx.fileName)) review.doc.sourceName = ctx.fileName.slice(0, 260);
	return review;
}

export function saveIdentity(ctx, name, initials) {
	const cleanName = normalizeWhitespace(name).slice(0, 60);
	if (!cleanName) return null;
	const cleanInitials = Array.from(String(initials || "").replace(/\s+/g, "")).slice(0, 3).join("") || initialsFor(cleanName);
	const id = ctx.identity ? ctx.identity.id : createId("u");
	ctx.identity = { id, name: cleanName, initials: cleanInitials.toUpperCase(), tone: toneFor(id) };
	writeStore(ctx, ctx.keys.identity, ctx.identity);
	upsertReviewer(ctx);
	for (const key of ctx.pendingSeen) {
		const entry = ctx.decisions.get(key);
		if (entry) entry.seen = true;
	}
	ensureDecisionRecords(ctx, false);
	saveState(ctx);
	return ctx.identity;
}

export function upsertReviewer(ctx) {
	if (!ctx.identity) return;
	const me = ctx.identity;
	const record = { id: me.id, name: me.name, initials: me.initials, tone: me.tone, updatedAt: nowIso() };
	const others = ctx.review.reviewers.filter((reviewer) => reviewer.id !== me.id);
	const current = ctx.review.reviewers.find((reviewer) => reviewer.id === me.id);
	if ((current && current.name === record.name && current.initials === record.initials && current.tone === record.tone) || (!current && others.length >= reviewLimits().reviewers)) return;
	ctx.review.reviewers = [...others, record].sort((a, b) => (a.id < b.id ? -1 : 1));
}

// Display tones: each reviewer's own tone, the later of two colliding reviewers
// taking the next free one (display only; ws1 4.7).
export function displayTone(ctx, reviewerId) {
	const first = new Map();
	for (const comment of ctx.review.comments) if (!first.has(comment.authorId)) first.set(comment.authorId, comment.createdAt);
	const order = ctx.review.reviewers.slice().sort((a, b) => String(first.get(a.id) || a.updatedAt).localeCompare(String(first.get(b.id) || b.updatedAt)) || (a.id < b.id ? -1 : 1));
	const used = new Set();
	const tones = new Map();
	for (const reviewer of order) {
		let tone = toneFor(reviewer.id);
		for (let step = 0; step < 6 && used.has(tone); step++) tone = (tone + 1) % 6;
		used.add(tone);
		tones.set(reviewer.id, tone);
	}
	return tones.has(reviewerId) ? tones.get(reviewerId) : toneFor(reviewerId);
}

export function reviewerFor(ctx, id) {
	return ctx.review.reviewers.find((reviewer) => reviewer.id === id) || { id, name: "Unknown reviewer", initials: "?", tone: toneFor(id) };
}

export function ensureIndex(ctx) {
	if (ctx.index && !ctx.indexDirty) return ctx.index;
	const root = ctx.doc.querySelector("main") || ctx.doc.body;
	ctx.index = buildTextIndex(root);
	ctx.indexDirty = false;
	ctx.debug.reindexes++;
	return ctx.index;
}

// Resolves every live root comment against the live DOM (the canonical index in
// the browser) and keeps a Range or element per thread for painting.
export function resolveComments(ctx) {
	const index = ensureIndex(ctx);
	const out = new Map();
	for (const { root } of threadsFrom(ctx.review).threads) {
		if (root.deleted) continue;
		const result = root.anchor ? resolveAnchor(index, root.anchor) : { status: "exact", start: null, end: null, blockId: null };
		const entry = { status: result.status, start: result.start, end: result.end, blockId: result.blockId, changedText: result.changedText || null, range: null, el: null };
		if (root.anchor) {
			entry.headingPath = typeof result.start === "number" ? headingPathFor(index, result.start) : root.anchor.headingPath || [];
			entry.blockTag = root.anchor.blockTag;
		}
		if (typeof result.start === "number" && typeof result.end === "number" && result.end > result.start && root.anchor && root.anchor.quote) {
			try {
				entry.range = rangeFromOffsets(index, result.start, result.end);
			} catch {
				entry.range = null;
			}
		}
		if (result.blockId && index.elements.has(result.blockId)) entry.el = index.elements.get(result.blockId);
		out.set(root.id, entry);
	}
	ctx.resolutions = out;
	return out;
}

export function threadStatus(ctx, comment) {
	return commentStatus(comment, addressedIndex(ctx.registry));
}

// { open, addressed, resolved, orphaned, total, decisionsTodo }
export function reviewCounts(ctx) {
	const addressed = addressedIndex(ctx.registry);
	const counts = { open: 0, addressed: 0, resolved: 0, orphaned: 0, total: 0, decisionsTodo: 0 };
	for (const { root } of threadsFrom(ctx.review).threads) {
		if (root.deleted) continue;
		counts.total++;
		counts[commentStatus(root, addressed)]++;
		const resolution = ctx.resolutions.get(root.id);
		if (resolution && resolution.status === "orphaned") counts.orphaned++;
	}
	for (const entry of ctx.decisions.values()) if (!entry.seen && !entry.changed) counts.decisionsTodo++;
	return counts;
}

export function addCommentRecord(ctx, fields) {
	if (!ctx.identity) throw new Error("Add your name before commenting");
	if (ctx.review.comments.length >= reviewLimits().comments) return refuseAtCap(ctx);
	if (ctx.review.reviewers.length >= reviewLimits().reviewers && !ctx.review.reviewers.some((reviewer) => reviewer.id === ctx.identity.id)) return refuseAtCap(ctx, "reviewers");
	const now = nowIso();
	const comment = { id: createId("c"), parentId: fields.parentId || null, kind: fields.kind || "doc", authorId: ctx.identity.id, createdAt: now, revision: ctx.revision, body: String(fields.body || "").slice(0, 8000), bodyAt: now, status: "open", deleted: false, anchor: fields.anchor || null };
	if (fields.decisionKey) comment.decisionKey = fields.decisionKey;
	if (fields.layout) comment.layout = fields.layout;
	upsertReviewer(ctx);
	ctx.review.comments = [...ctx.review.comments, comment];
	updateCapNotice(ctx);
	saveState(ctx);
	refreshAll(ctx);
	return comment;
}

export function updateComment(ctx, id, change) {
	ctx.review.comments = ctx.review.comments.map((comment) => (comment.id === id ? Object.assign({}, comment, change) : comment));
	saveState(ctx);
	refreshAll(ctx);
}

export function setCommentStatus(ctx, id, status) {
	const by = ctx.identity ? ctx.identity.id : undefined;
	const change = { status, statusAt: nowIso() };
	if (by) change.statusBy = by;
	updateComment(ctx, id, change);
}

// Re-resolves, repaints and re-renders after any state change.
export function refreshAll(ctx) {
	if (ctx.index || ctx.isOpen || ctx.review.comments.length) {
		try {
			resolveComments(ctx);
		} catch {
			ctx.resolutions = new Map();
		}
	}
	paintHighlights(ctx);
	scheduleLayout(ctx);
	renderPanel(ctx);
	notifyHost(ctx);
}

export function exportReviewValue(ctx, scope) {
	ensureDecisionRecords(ctx, false);
	const review = workingReview(ctx);
	review.exportedAt = nowIso();
	if (ctx.identity) review.exportedBy = ctx.identity.id;
	return scope === "mine" && ctx.identity ? filterOwn(review, ctx.identity.id) : review;
}

// Normalizes and merges one review (object, JSON text or reviewed HTML text).
// Returns { added, updated, issues, comments, reviewers, rejected }.
export function importReviewValue(ctx, input, label) {
	const name = label || "review";
	let raw = input;
	if (typeof input === "string") {
		const parsed = parseImportText(input, name);
		if (parsed.issue) return { added: 0, updated: 0, issues: [parsed.issue], comments: 0, reviewers: 0, rejected: "schema" };
		raw = parsed.raw;
	}
	const result = normalizeReview(raw, { docId: ctx.docId, cap: false });
	if (!result.review) {
		const issue = result.rejected === "doc" ? name + " is a review of another document" : name + ": " + result.issues.join("; ");
		return { added: 0, updated: 0, issues: [issue], comments: 0, reviewers: 0, rejected: result.rejected };
	}
	const before = new Map(ctx.review.comments.map((comment) => [comment.id, canonicalJson(comment)]));
	// The reader's records keep their places; what does not fit is refused and reported.
	const merged = mergeReviewsReport([ctx.review, result.review], { docId: ctx.docId, keep: reviewIds(ctx.review), reviewerId: ctx.identity ? ctx.identity.id : undefined });
	ctx.review = merged.review;
	let added = 0;
	let updated = 0;
	for (const comment of ctx.review.comments) {
		if (!before.has(comment.id)) added++;
		else if (before.get(comment.id) !== canonicalJson(comment)) updated++;
	}
	const ids = new Set(ctx.review.comments.map((comment) => comment.id));
	const refused = merged.dropped;
	const issues = result.issues.map((issue) => name + ": " + issue);
	for (const line of capIssues(refused, "not imported")) issues.push(name + ": " + line);
	updateCapNotice(ctx);
	saveState(ctx);
	return { added, updated, issues, refused, comments: result.review.comments.filter((comment) => !comment.deleted && ids.has(comment.id)).length, reviewers: result.review.reviewers.length, reviewerIds: result.review.reviewers.map((reviewer) => reviewer.id), rejected: null };
}

export function buildMarkdown(ctx, mode) {
	ensureDecisionRecords(ctx, false);
	let resolutions = new Map();
	try {
		resolutions = resolveComments(ctx);
	} catch {
		resolutions = new Map();
	}
	const plain = new Map();
	for (const [id, entry] of resolutions) plain.set(id, { status: entry.status, start: entry.start, blockId: entry.blockId, headingPath: entry.headingPath, blockTag: entry.blockTag, changedText: entry.changedText || undefined });
	const notes = capIssues(ctx.leftOut, "not loaded").map((line) => line + ", so this review is incomplete");
	return reviewMarkdown(workingReview(ctx), { mode: mode === "tasks" ? "tasks" : "copy", registry: ctx.registry, currentRevision: ctx.revision, resolutions: plain, decisions: decisionInfoMap(ctx), now: nowIso(), artifact: ctx.fileName, notes });
}

export function resolutionList(ctx, review) {
	const index = ensureIndex(ctx);
	const out = [];
	for (const { root } of threadsFrom(review).threads) {
		if (root.deleted) continue;
		const result = root.anchor ? resolveAnchor(index, root.anchor) : { status: "exact", blockId: null };
		out.push({ commentId: root.id, status: result.status, blockId: result.blockId || null });
	}
	return out;
}

// API addComment: { quote, occurrence, blockId, body, parentId }. Throws a
// RangeError (after the visible notice) when the review is full.
export function apiAddComment(ctx, options) {
	const opts = options || {};
	const add = (fields) => {
		const comment = addCommentRecord(ctx, fields);
		if (!comment) throw new RangeError(capIssue(1, "not added"));
		return comment.id;
	};
	if (opts.parentId) return add({ parentId: opts.parentId, kind: "doc", body: opts.body });
	const index = ensureIndex(ctx);
	if (opts.quote) {
		const range = opts.blockId ? index.blocks.get(opts.blockId) : null;
		const hits = findQuote(index.text, normalizeWhitespace(opts.quote), range ? range.start : 0, range ? range.end : index.text.length);
		const hit = hits[Math.max(0, (Number(opts.occurrence) || 1) - 1)];
		if (hit === undefined) throw new RangeError("Quote not found in the document");
		const anchor = createTextAnchor(index, { start: hit, end: hit + normalizeWhitespace(opts.quote).length });
		return add({ kind: "text", anchor, body: opts.body });
	}
	if (opts.blockId) {
		const el = index.elements.get(opts.blockId);
		if (!el) throw new RangeError("No block " + opts.blockId);
		return add({ kind: "block", anchor: createBlockAnchor(index, el), body: opts.body });
	}
	return add({ kind: "doc", body: opts.body });
}

export function createReviewApi(ctx) {
	return {
		version: 1,
		docId: ctx.docId,
		revision: ctx.revision,
		getReview: () => workingReview(ctx),
		exportReview: (opts) => exportReviewValue(ctx, opts && opts.scope === "mine" ? "mine" : "all"),
		importReview: (input) => {
			const result = importReviewValue(ctx, input, "import");
			refreshAll(ctx);
			const refused = capIssues(result.refused, "not imported");
			if (refused.length) showToast(ctx, refused.join("; "));
			return { added: result.added, updated: result.updated, issues: result.issues };
		},
		markdown: (opts) => buildMarkdown(ctx, opts && opts.mode),
		resolutions: () => resolutionList(ctx, ctx.review),
		resolveAll: (review) => {
			const result = normalizeReview(typeof review === "string" ? parseJsonIsland(review) : review, {});
			return result.review ? resolutionList(ctx, result.review) : [];
		},
		addComment: (opts) => apiAddComment(ctx, opts),
		reviewedCopy: (source, opts) => composeReviewedCopy(ctx, opts && opts.scope === "mine" ? "mine" : "all", source, true),
		setIdentity: (opts) => saveIdentity(ctx, opts && opts.name, opts && opts.initials),
		open: (tab) => openPanel(ctx, tab),
		close: () => closePanel(ctx),
		flush: () => flushState(ctx),
		notice: () => [ctx.notice, ctx.capNotice].filter(Boolean).join(" ") || null,
		debug: () => "reindex:" + ctx.debug.reindexes + " rendered:" + ctx.debug.rendered + " highlights:" + (ctx.useHighlights ? "css" : "overlay") + " storage:" + (ctx.storageOk && !ctx.quotaFull && !ctx.capHold ? "local" : "memory") + " picker:" + (ctx.picker ? "on" : "off"),
	};
}

// vpk:content-rendered (C14, R18 detail { type, ids }): rebuild the index and
// repaint once per frame.
export function onContentRendered(ctx, event) {
	const detail = normalizeContentRendered(event && event.detail);
	ctx.debug.rendered = (detail.type || "unknown") + ":" + detail.ids.length;
	ctx.indexDirty = true;
	if (ctx.timers.rendered) return;
	const raf = ctx.win.requestAnimationFrame ? ctx.win.requestAnimationFrame.bind(ctx.win) : (fn) => ctx.win.setTimeout(fn, 16);
	ctx.timers.rendered = raf(() => {
		ctx.timers.rendered = null;
		if (ctx.index || ctx.review.comments.length) refreshAll(ctx);
	});
}

export function mountReviewUi(ctx) {
	const win = ctx.win;
	const doc = ctx.doc;
	createPanel(ctx);
	createHighlighter(ctx);
	createComposer(ctx);
	createSelectionButton(ctx);
	bindDecisions(ctx);
	createHostBridge(ctx);
	doc.addEventListener("selectionchange", () => {
		if (ctx.timers.selection) win.clearTimeout(ctx.timers.selection);
		ctx.timers.selection = win.setTimeout(() => updateSelectionButton(ctx), 150);
	});
	win.addEventListener("keydown", (event) => handlePageShortcut(ctx, event));
	doc.addEventListener("vpk:content-rendered", (event) => onContentRendered(ctx, event));
	win.addEventListener("storage", (event) => {
		if (event.key === ctx.keys.doc && event.newValue) {
			try {
				const result = normalizeReview(JSON.parse(event.newValue), { docId: ctx.docId, cap: false });
				if (result.review) {
					const merged = mergeReviewsReport([ctx.review, result.review], { docId: ctx.docId, keep: reviewIds(ctx.review), reviewerId: ctx.identity ? ctx.identity.id : undefined });
					ctx.review = merged.review;
					// Over a cap, this tab stops writing so the other tab's records stay stored.
					const lines = capIssues(merged.dropped, "from another tab not shown");
					if (lines.length) {
						noteLeftOut(ctx, merged.dropped, true);
						showToast(ctx, lines.join("; ") + ".");
					}
				}
				refreshAll(ctx);
			} catch {
				// Ignore a foreign or partial write.
			}
		}
	});
	win.addEventListener("pagehide", () => flushState(ctx));
	win.addEventListener("beforeunload", (event) => {
		const memoryOnly = !ctx.storageOk || ctx.quotaFull || ctx.capHold;
		if (memoryOnly && ctx.dirty && ctx.review.comments.some((comment) => ctx.identity && comment.authorId === ctx.identity.id)) {
			event.preventDefault();
			event.returnValue = "";
		}
	});
	// Bubble phase (K26: no document-level capture); page drop zones that handle
	// the drop first (defaultPrevented, or inside [data-vpk-file-drop]) win.
	win.addEventListener("dragover", (event) => handlePageDrop(ctx, event));
	win.addEventListener("drop", (event) => handlePageDrop(ctx, event));
	renderPanel(ctx);
	const lines = capIssues(ctx.leftOut, "not loaded");
	if (lines.length) showToast(ctx, lines.join("; ") + ". Open Review for details.");
	firstPaint(ctx);
}

// Builds the index at first paint only when there is something to show.
export function firstPaint(ctx) {
	const win = ctx.win;
	const show = ctx.review.comments.some((comment) => !comment.deleted && comment.anchor);
	if (!show) return;
	const run = () => {
		if (ctx.index && !ctx.indexDirty) return;
		refreshAll(ctx);
	};
	const idle = () => (typeof win.requestIdleCallback === "function" ? win.requestIdleCallback(run, { timeout: 1000 }) : win.setTimeout(run, 200));
	const fonts = ctx.doc.fonts;
	if (fonts && fonts.ready && typeof fonts.ready.then === "function") fonts.ready.then(idle, idle);
	else idle();
}

export function bootVpkReview(config) {
	const win = window;
	const doc = document;
	if (win.__VPK_REVIEW__) return win.__VPK_REVIEW__;
	const ctx = createContext(config, win, doc);
	loadState(ctx);
	const api = createReviewApi(ctx);
	win.__VPK_REVIEW__ = api;
	const start = () => {
		try {
			mountReviewUi(ctx);
		} catch (error) {
			ctx.debug.bootError = String(error && error.message ? error.message : error);
		}
	};
	if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
	else start();
	return api;
}

export function announce(ctx, text) {
	if (ctx.ui.live) {
		ctx.ui.live.textContent = "";
		ctx.win.setTimeout(() => {
			if (ctx.ui.live) ctx.ui.live.textContent = text;
		}, 30);
	}
}

export function toast(ctx, text, action) {
	showToast(ctx, text, action);
}
