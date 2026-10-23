/*
 * review/anchor-dom: DOM-position helpers split out of anchor.mjs in P3 (B2 decision 19g):
 * childNodes index paths (nodePath, resolveNodePath), a Range for index offsets
 * (rangeFromOffsets) and revealTarget. Browser and Node (linkedom) share nodePath and
 * resolveNodePath; rangeFromOffsets and revealTarget only run in a browser. Serialized module
 * (ws1 4.6): named function imports and export function declarations only, no module-level
 * state, plain ASCII, no tags.
 */

import { domPointFor } from "./anchor.mjs";

// childNodes index path from `from` down to `node` (null when not a descendant).
export function nodePath(node, from) {
	const path = [];
	let current = node;
	while (current && current !== from) {
		const parent = current.parentNode;
		if (!parent) return null;
		let position = 0;
		for (let sibling = parent.firstChild; sibling && sibling !== current; sibling = sibling.nextSibling) position++;
		path.unshift(position);
		current = parent;
	}
	return current === from ? path : null;
}

export function resolveNodePath(from, path) {
	let current = from;
	for (const position of path || []) {
		if (!current) return null;
		let child = current.firstChild;
		for (let step = 0; child && step < position; step++) child = child.nextSibling;
		current = child;
	}
	return current || null;
}

// A DOM Range for index offsets (browser; null without document.createRange).
export function rangeFromOffsets(index, start, end) {
	const owner = index.root.ownerDocument;
	if (!owner || typeof owner.createRange !== "function") return null;
	const from = domPointFor(index, start, "start");
	const to = domPointFor(index, end, "end");
	if (!from || !to) return null;
	const range = owner.createRange();
	range.setStart(from.node, from.offset);
	range.setEnd(to.node, to.offset);
	return range;
}

// Opens ancestor details, then scrolls the target to the viewport centre
// (instantly under reduced motion). Accepts an element or a Range.
export function revealTarget(target, options = {}) {
	if (!target) return false;
	const container = target.nodeType === 1 ? target : target.startContainer;
	const el = container ? (container.nodeType === 1 ? container : container.parentElement) : null;
	if (!el) return false;
	for (let details = el.closest("details"); details; details = details.parentElement ? details.parentElement.closest("details") : null) {
		if (!details.open) details.open = true;
	}
	if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center", behavior: options.reducedMotion === true ? "auto" : "smooth" });
	return true;
}
