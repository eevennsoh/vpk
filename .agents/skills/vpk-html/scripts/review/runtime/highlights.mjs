/*
 * review/runtime/highlights: text tints, pins, reveal marks and the layout loop
 * (ws1 4.9).
 *
 * Text tints use the CSS Custom Highlight API (one Highlight per reviewer tone
 * plus vpk-review-active), styled by the document-level review style block, so
 * the page DOM is never mutated. Without the API the runtime draws fixed
 * rectangles from range.getClientRects() in its shadow root instead. Pins sit
 * at the right edge of main, stacked and culled to the viewport. One
 * rAF-coalesced layout pass reads every rect before it writes any style, and
 * does nothing when there is nothing to draw.
 *
 * Serialized module: named function imports and export function declarations
 * only, no module-level state, plain ASCII.
 */

import { displayTone, reviewerFor, threadStatus } from "./boot.mjs";
import { clearNode, h, revealInView } from "./dom.mjs";
import { openPanel } from "./panel.mjs";
import { focusThread } from "./threads.mjs";

export function createHighlighter(ctx) {
	const win = ctx.win;
	ctx.useHighlights = !ctx.config.forceOverlay && !!(win.CSS && win.CSS.highlights && typeof win.Highlight === "function");
	ctx.fallbackRanges = [];
	ctx.ui.pins = new Map();
	const schedule = () => scheduleLayout(ctx);
	// K26 as amended by B2 decision 5: the passive capture scroll listener only
	// invalidates geometry. A details toggle resizes the root, so the
	// ResizeObserver below covers it (no document capture for toggle).
	win.addEventListener("scroll", schedule, { capture: true, passive: true });
	win.addEventListener("resize", schedule, { passive: true });
	const root = ctx.doc.querySelector("main") || ctx.doc.body;
	if (typeof win.ResizeObserver === "function" && root) {
		ctx.ui.resizeObserver = new win.ResizeObserver(schedule);
		ctx.ui.resizeObserver.observe(root);
	}
	const fonts = ctx.doc.fonts;
	if (fonts && fonts.ready && typeof fonts.ready.then === "function") fonts.ready.then(schedule, () => {});
}

// Threads are tinted while open or addressed; resolved ones only when the
// Comments filter shows them.
export function isTinted(ctx, comment) {
	const status = threadStatus(ctx, comment);
	if (status !== "resolved") return true;
	return ctx.isOpen && ctx.tab === "comments" && (ctx.filter === "resolved" || ctx.filter === "all");
}

export function paintHighlights(ctx) {
	if (!ctx.ui.layer) return;
	const groups = [[], [], [], [], [], []];
	const active = [];
	const roots = new Map(ctx.review.comments.filter((comment) => !comment.parentId && !comment.deleted).map((comment) => [comment.id, comment]));
	for (const [id, entry] of ctx.resolutions) {
		const comment = roots.get(id);
		if (!comment || !entry.range || !isTinted(ctx, comment)) continue;
		if (id === ctx.activeId) active.push(entry.range);
		else groups[displayTone(ctx, comment.authorId)].push(entry.range);
	}
	ctx.debug.paints++;
	if (ctx.useHighlights) {
		const registry = ctx.win.CSS.highlights;
		const Ctor = ctx.win.Highlight;
		groups.forEach((ranges, tone) => {
			const name = "vpk-review-" + tone;
			if (ranges.length) registry.set(name, new Ctor(...ranges));
			else registry.delete(name);
		});
		if (active.length) registry.set("vpk-review-active", new Ctor(...active));
		else registry.delete("vpk-review-active");
		ctx.fallbackRanges = [];
	} else {
		ctx.fallbackRanges = [];
		groups.forEach((ranges, tone) => ranges.forEach((range) => ctx.fallbackRanges.push({ range, tone })));
		active.forEach((range) => ctx.fallbackRanges.push({ range, tone: "active" }));
	}
}

export function clearHighlights(ctx) {
	if (ctx.useHighlights && ctx.win.CSS && ctx.win.CSS.highlights) {
		for (let tone = 0; tone < 6; tone++) ctx.win.CSS.highlights.delete("vpk-review-" + tone);
		ctx.win.CSS.highlights.delete("vpk-review-active");
	}
	ctx.fallbackRanges = [];
}

export function hasLayoutWork(ctx) {
	return ctx.resolutions.size > 0 || ctx.fallbackRanges.length > 0 || ctx.reveal.list.length > 0 || !!ctx.picker || !!ctx.selectionRange || (ctx.ui.layer && ctx.ui.layer.firstChild !== null);
}

export function scheduleLayout(ctx) {
	if (ctx.timers.layout || !ctx.ui.layer || !hasLayoutWork(ctx)) return;
	const win = ctx.win;
	const raf = win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : (fn) => win.setTimeout(fn, 16);
	ctx.timers.layout = raf(() => {
		ctx.timers.layout = null;
		layoutPins(ctx);
	});
}

export function rectOf(node) {
	if (!node) return null;
	if (typeof node.getClientRects === "function") {
		const rects = node.getClientRects();
		for (const rect of rects) if (rect.width > 0 || rect.height > 0) return rect;
	}
	return typeof node.getBoundingClientRect === "function" ? node.getBoundingClientRect() : null;
}

// The layout pass: reads all geometry first, then writes the layer.
export function layoutPins(ctx) {
	const layer = ctx.ui.layer;
	if (!layer) return;
	const win = ctx.win;
	const viewWidth = win.innerWidth || 1024;
	const viewHeight = win.innerHeight || 768;
	const root = ctx.doc.querySelector("main") || ctx.doc.body;
	const mainRect = root ? root.getBoundingClientRect() : { right: viewWidth - 40 };
	const pinX = Math.min(Math.max(8, mainRect.right + 8), viewWidth - 32);
	const roots = new Map(ctx.review.comments.filter((comment) => !comment.parentId && !comment.deleted).map((comment) => [comment.id, comment]));
	const pins = [];
	for (const [id, entry] of ctx.resolutions) {
		const comment = roots.get(id);
		if (!comment || !comment.anchor || entry.status === "orphaned" || !isTinted(ctx, comment)) continue;
		const rect = rectOf(entry.range) || rectOf(entry.el);
		if (!rect || rect.bottom < 0 || rect.top > viewHeight) continue;
		pins.push({ id, comment, top: rect.top });
	}
	const marks = [];
	for (const item of ctx.fallbackRanges) {
		const rects = item.range.getClientRects ? item.range.getClientRects() : [];
		let count = 0;
		for (const rect of rects) {
			if (count++ > 60) break;
			if (rect.bottom < 0 || rect.top > viewHeight || rect.width === 0) continue;
			marks.push({ tone: item.tone, left: rect.left, top: rect.top, width: rect.width, height: rect.height });
		}
	}
	const outlines = [];
	if (ctx.reveal.list.length) {
		const shown = ctx.reveal.all ? ctx.reveal.list : [ctx.reveal.list[ctx.reveal.position]].filter(Boolean);
		for (const el of shown) {
			const rect = el.getBoundingClientRect();
			if (rect.bottom < 0 || rect.top > viewHeight) continue;
			outlines.push({ kind: ctx.reveal.all ? "all" : "one", rect, label: ctx.reveal.all ? null : ctx.reveal.revision + " " + String.fromCharCode(183) + " " + (el.getAttribute("data-vpk-revision-kind") === "added" ? "added" : "changed") });
		}
	}
	if (ctx.picker && ctx.picker.blocks[ctx.picker.position]) outlines.push({ kind: "pick", rect: ctx.picker.blocks[ctx.picker.position].getBoundingClientRect(), label: null });
	let selection = null;
	if (ctx.selectionRange) {
		const rects = ctx.selectionRange.getClientRects();
		const last = rects.length ? rects[rects.length - 1] : null;
		if (last) selection = { left: Math.min(viewWidth - 32, last.right + 4), top: Math.min(viewHeight - 32, Math.max(4, last.bottom + 4)) };
	}
	const dark = ctx.doc.documentElement.getAttribute("data-theme") === "dark";

	// Writes.
	ctx.ui.host.toggleAttribute("data-dark", dark);
	pins.sort((a, b) => a.top - b.top);
	let lastBottom = -Infinity;
	const keep = new Set();
	for (const pin of pins) {
		const top = Math.max(pin.top, lastBottom + 2);
		lastBottom = top + 24;
		keep.add(pin.id);
		let node = ctx.ui.pins.get(pin.id);
		if (!node) {
			node = createPin(ctx, pin.id, pin.comment);
			ctx.ui.pins.set(pin.id, node);
		}
		node.className = "vr-pin vr-tone-" + displayTone(ctx, pin.comment.authorId) + (pin.id === ctx.activeId ? " is-active" : "");
		node.style.transform = "translate(" + Math.round(pinX) + "px, " + Math.round(top) + "px)";
		if (node.parentNode !== ctx.ui.pinLayer) ctx.ui.pinLayer.appendChild(node);
	}
	for (const [id, node] of ctx.ui.pins) {
		if (keep.has(id)) continue;
		node.remove();
		ctx.ui.pins.delete(id);
	}
	clearNode(layer);
	for (const mark of marks) {
		layer.appendChild(h(ctx, "div", { class: "vr-mark vr-tone-" + mark.tone, style: "left:" + mark.left + "px;top:" + mark.top + "px;width:" + mark.width + "px;height:" + mark.height + "px" }));
	}
	for (const outline of outlines) {
		const rect = outline.rect;
		const box = h(ctx, "div", { class: "vr-outline vr-outline-" + outline.kind, style: "left:" + (rect.left - 4) + "px;top:" + (rect.top - 4) + "px;width:" + (rect.width + 8) + "px;height:" + (rect.height + 8) + "px" });
		if (outline.label) box.appendChild(h(ctx, "span", { class: "vr-outline-chip", text: outline.label }));
		layer.appendChild(box);
	}
	const button = ctx.ui.selectButton;
	if (button) {
		button.hidden = !selection;
		if (selection) button.style.transform = "translate(" + Math.round(selection.left) + "px, " + Math.round(selection.top) + "px)";
	}
}

export function createPin(ctx, id, comment) {
	const author = reviewerFor(ctx, comment.authorId);
	const node = h(ctx, "button", { type: "button", class: "vr-pin", tabindex: "-1", "aria-hidden": "true", "aria-label": "Comment by " + author.name, "data-id": id, text: author.initials });
	node.addEventListener("click", () => {
		ctx.activeId = id;
		openPanel(ctx, "comments");
		focusThread(ctx, id);
		paintHighlights(ctx);
		scheduleLayout(ctx);
	});
	return node;
}

// Reveal stepper over [data-vpk-revision="<revision>"] blocks (ws1 4.9).
// options: { revision, step (+1 / -1), position, all }
export function revealMarks(ctx, options) {
	const opts = options || {};
	const revision = opts.revision || ctx.reveal.revision;
	if (!revision) return ctx.reveal;
	if (revision !== ctx.reveal.revision) {
		const list = [...ctx.doc.querySelectorAll("[data-vpk-revision]")].filter((el) => el.getAttribute("data-vpk-revision") === revision && !el.closest("[data-vpk-review-ui]"));
		ctx.reveal = { revision, list, position: list.length ? 0 : -1, all: false };
	} else if (typeof opts.step === "number" && ctx.reveal.list.length) {
		const count = ctx.reveal.list.length;
		ctx.reveal.position = (ctx.reveal.position + opts.step + count) % count;
	}
	if (typeof opts.position === "number" && ctx.reveal.list.length) ctx.reveal.position = Math.max(0, Math.min(ctx.reveal.list.length - 1, opts.position));
	if (typeof opts.all === "boolean") ctx.reveal.all = opts.all;
	const target = ctx.reveal.list[ctx.reveal.position];
	if (target && !ctx.reveal.all) revealInView(ctx, target);
	scheduleLayout(ctx);
	return ctx.reveal;
}

export function stopReveal(ctx) {
	ctx.reveal = { revision: null, list: [], position: -1, all: false };
	scheduleLayout(ctx);
}

// Kept for API symmetry with the spec (4.6): the overlay path is drawn by layoutPins.
export function drawFallbackRects(ctx) {
	ctx.useHighlights = false;
	paintHighlights(ctx);
	scheduleLayout(ctx);
}
