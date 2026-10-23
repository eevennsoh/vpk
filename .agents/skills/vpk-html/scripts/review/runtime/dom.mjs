/*
 * review/runtime/dom: small DOM helpers for the in-page review runtime (ws1 4.6, 4.8).
 *
 * Serialized module: named function imports and export function declarations
 * only, no module-level state, plain ASCII, no HTML-structural text. DOM is
 * built with createElement + setAttribute; reviewer text only ever goes through
 * textContent. Icons are trusted build-time strings from the runtime config,
 * parsed into a template element.
 */

import { revealTarget } from "../anchor-dom.mjs";
import { closePanel, renderBanner } from "./panel.mjs";

// Element factory. attrs: plain attributes (true = empty value; null/false/undefined
// skipped), `text` (textContent) and `on<event>` functions (addEventListener).
// children: nodes, strings (text nodes) or nested arrays; null entries are skipped.
export function h(ctx, tag, attrs, children) {
	const node = ctx.doc.createElement(tag);
	if (attrs) {
		for (const name of Object.keys(attrs)) {
			const value = attrs[name];
			if (value === null || value === undefined || value === false) continue;
			if (name === "text") node.textContent = String(value);
			else if (name.slice(0, 2) === "on" && typeof value === "function") node.addEventListener(name.slice(2), value);
			else node.setAttribute(name, value === true ? "" : String(value));
		}
	}
	appendNodes(ctx, node, children);
	return node;
}

export function appendNodes(ctx, parent, children) {
	if (children === null || children === undefined || children === false) return parent;
	const list = Array.isArray(children) ? children : [children];
	for (const child of list) {
		if (child === null || child === undefined || child === false) continue;
		if (Array.isArray(child)) appendNodes(ctx, parent, child);
		else if (typeof child === "string" || typeof child === "number") parent.appendChild(ctx.doc.createTextNode(String(child)));
		else parent.appendChild(child);
	}
	return parent;
}

export function clearNode(node) {
	while (node && node.firstChild) node.removeChild(node.firstChild);
	return node;
}

// An icon from config.icons (build-time inline SVG text), or an empty span.
export function iconNode(ctx, name) {
	const markup = ctx.config.icons && ctx.config.icons[name];
	if (markup) {
		const holder = ctx.doc.createElement("template");
		holder.innerHTML = markup;
		const first = holder.content ? holder.content.firstElementChild : holder.firstElementChild;
		if (first) return first.cloneNode(true);
	}
	return h(ctx, "span", { class: "vr-icon", "aria-hidden": "true" });
}

// A real button with an accessible name: an icon, a visible label, or both.
// options: { label, icon, title, cls, onClick, pressed, disabled, hideLabel }
export function uiButton(ctx, options) {
	const attrs = { type: "button", class: "vr-btn" + (options.cls ? " " + options.cls : "") };
	if (options.hideLabel || !options.label) attrs["aria-label"] = options.title || options.label;
	if (options.title) attrs.title = options.title;
	if (options.pressed !== undefined) attrs["aria-pressed"] = options.pressed ? "true" : "false";
	if (options.disabled) attrs.disabled = true;
	const node = h(ctx, "button", attrs, [options.icon ? iconNode(ctx, options.icon) : null, options.label && !options.hideLabel ? h(ctx, "span", { text: options.label }) : null]);
	if (typeof options.onClick === "function") node.addEventListener("click", options.onClick);
	return node;
}

// The element an event really started on (composedPath()[0] when it is an element).
export function composedOrigin(event) {
	const path = event && typeof event.composedPath === "function" ? event.composedPath() : [];
	const first = path.length ? path[0] : null;
	if (first && first.nodeType === 1) return first;
	const target = event ? event.target : null;
	return target && target.nodeType === 3 ? target.parentElement : target;
}

// True when any element on the composed path carries `attribute`.
export function pathHasAttribute(event, attribute) {
	const path = event && typeof event.composedPath === "function" ? event.composedPath() : [];
	for (const node of path) if (node && node.nodeType === 1 && typeof node.hasAttribute === "function" && node.hasAttribute(attribute)) return true;
	return false;
}

// Form controls, links and widget roles keep their own keys (repo rule, gotchas-ui).
export function isInteractiveOrigin(node) {
	if (!node || typeof node.closest !== "function") return false;
	const roles = ["button", "link", "menuitem", "tab", "checkbox", "radio", "switch", "slider", "spinbutton", "textbox", "combobox", "application"];
	const selector = "input, textarea, select, button, a[href], [contenteditable]:not([contenteditable=\"false\"]), " + roles.map((role) => "[role=\"" + role + "\"]").join(", ");
	return node.closest(selector) !== null;
}

export function reducedMotion(ctx) {
	try {
		return !!(ctx.win.matchMedia && ctx.win.matchMedia("(prefers-reduced-motion: reduce)").matches);
	} catch {
		return false;
	}
}

// Below 640 px the open drawer is a bottom sheet: the top of the sheet (less a
// gap), else 0. Targets are revealed in the part of the viewport above it.
export function sheetTop(ctx) {
	const drawer = ctx.ui && ctx.ui.drawer;
	if (!ctx.isOpen || !drawer || !ctx.win.matchMedia || !ctx.win.matchMedia("(max-width: 640px)").matches) return 0;
	return Math.max(0, drawer.getBoundingClientRect().top - 8);
}

// Page focus vs review chrome (WCAG 2.4.11 Focus Not Obscured). Drawer closed:
// focus under the revision banner hides it until focus moves clear of its place,
// into the review UI or to nothing; under the Review button the page scrolls the
// control clear. Bottom sheet open (<= 640 px): focus under the sheet is
// scrolled above it, or, in fixed chrome that cannot scroll (a pager), closes it.
export function watchPageFocus(ctx, host) {
	const doc = ctx.doc;
	const later = (fn) => ctx.win.requestAnimationFrame(fn);
	doc.addEventListener("focusin", (event) => {
		const target = event.target;
		if (target === host) later(() => yieldBanner(ctx, null));
		else if (target && target.getBoundingClientRect) later(() => (ctx.isOpen ? guardSheet(ctx, target) : yieldBanner(ctx, target)));
	});
	doc.addEventListener("focusout", () => later(() => {
		const active = doc.activeElement;
		if (ctx.bannerYield && (!active || active === doc.body)) yieldBanner(ctx, null);
	}));
}

export function overlaps(rect, box) {
	return !!box && box.width > 0 && rect.left < box.right && rect.right > box.left && rect.top < box.bottom && rect.bottom > box.top;
}

export function yieldBanner(ctx, target) {
	const ui = ctx.ui;
	const rect = target ? target.getBoundingClientRect() : null;
	if (rect && !ui.banner.hidden && overlaps(rect, ui.banner.getBoundingClientRect())) {
		ctx.bannerYield = ui.banner.getBoundingClientRect();
		renderBanner(ctx);
	} else if (ctx.bannerYield && (!rect || !overlaps(rect, ctx.bannerYield))) {
		ctx.bannerYield = null;
		renderBanner(ctx);
	}
	const button = ui.launcher.getBoundingClientRect();
	if (rect && overlaps(rect, button)) ctx.win.scrollBy({ top: rect.bottom - button.top + 12, behavior: "auto" });
}

export function guardSheet(ctx, target) {
	const top = sheetTop(ctx);
	if (!top || target.getBoundingClientRect().bottom <= top) return;
	let pinned = false;
	for (let node = target; node && !pinned; node = node.parentElement) pinned = /fixed|sticky/.test(ctx.win.getComputedStyle(node).position);
	if (pinned) closePanel(ctx, { focus: false });
	else revealInView(ctx, target);
}

// revealTarget, then (sheet open) centre the target above the sheet, or align
// its top when it is taller than that room. Instant under reduced motion.
export function revealInView(ctx, target, instant) {
	const quick = instant === true || reducedMotion(ctx);
	if (!revealTarget(target, { reducedMotion: quick })) return false;
	const room = sheetTop(ctx);
	if (!room || typeof target.getBoundingClientRect !== "function") return true;
	const rect = target.getBoundingClientRect();
	const top = rect.height > room - 32 ? rect.top - 16 : rect.top + rect.height / 2 - room / 2;
	ctx.win.scrollBy({ top, behavior: quick ? "auto" : "smooth" });
	return true;
}

// "just now", "5 min ago", "3 h ago", "2 d ago", else the ISO date.
export function relativeTime(iso, now) {
	const time = Date.parse(iso);
	if (Number.isNaN(time)) return "";
	const seconds = Math.max(0, Math.round(((typeof now === "number" ? now : Date.now()) - time) / 1000));
	if (seconds < 45) return "just now";
	if (seconds < 3600) return Math.round(seconds / 60) + " min ago";
	if (seconds < 86400) return Math.round(seconds / 3600) + " h ago";
	if (seconds < 86400 * 14) return Math.round(seconds / 86400) + " d ago";
	return String(iso).slice(0, 10);
}

export function clockTime(iso) {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const pad = (value) => String(value).padStart(2, "0");
	return pad(date.getHours()) + ":" + pad(date.getMinutes());
}

// Reader-facing name for a block tag (block picker announcements).
export function tagLabel(tag) {
	const names = { p: "Paragraph", li: "List item", dt: "Term", dd: "Definition", blockquote: "Quote", pre: "Code block", figure: "Figure", figcaption: "Caption", table: "Table", caption: "Table caption", tr: "Table row", details: "Details", summary: "Summary", fieldset: "Decision", svg: "Figure", img: "Image", video: "Video", canvas: "Canvas", section: "Section", article: "Article", header: "Header", footer: "Footer", aside: "Aside", nav: "Navigation", div: "Block" };
	if (/^h[1-6]$/.test(tag)) return "Heading";
	return names[tag] || "Block";
}

// UTF-8 byte length (TextEncoder, or a code-point count fallback).
export function utf8Length(text) {
	const value = String(text ?? "");
	if (typeof TextEncoder === "function") return new TextEncoder().encode(value).length;
	let bytes = 0;
	for (const char of value) {
		const code = char.codePointAt(0);
		bytes += code < 128 ? 1 : code < 2048 ? 2 : code < 65536 ? 3 : 4;
	}
	return bytes;
}

export function plural(count, one, many) {
	return count + " " + (count === 1 ? one : many || one + "s");
}
