/*
 * review/anchor: the text index, anchor records and hybrid anchor resolution for Node (linkedom)
 * and the browser (ws1 4.5). Only DOM APIs that linkedom, happy-dom and browsers share are used
 * (never innerText or layout), so Node and Chromium build the same index (S14). Resolution order,
 * first match wins: exact, moved, fuzzy (folded text, then prefix...suffix), block-only, css,
 * runtime (content-island documents), orphaned. Serialized module (ws1 4.6): named function
 * imports and export function declarations only, no module-level state, plain ASCII, no tags.
 * cssPathFor is ported from lavish-axi revisionSelectorFor (MIT, (c) 2026 Kun Chen).
 */

import { nodePath, resolveNodePath } from "./anchor-dom.mjs";
import { diceSimilarity, excerpt, foldTextMap, hashText, normalizeWhitespace, wordBigrams } from "./text.mjs";

// Stamping candidates (ws1 4.4; R3: figure roots are [data-vpk-engine]). The
// "div with a direct text child" rule is applied by the stamper on top of this.
export function reviewBlockSelector() {
	return "section, article, header, footer, aside, nav, h1, h2, h3, h4, h5, h6, p, li, dt, dd, blockquote, pre, figure, figcaption, table, caption, tr, details, summary, fieldset, svg, img, video, canvas, [data-vpk-block], [data-vpk-engine]";
}

// Subtrees whose text never enters the index (and never counts as own text).
export function anchorExclusionSelector() {
	return "script, style, template, noscript, .speaker-notes, [data-vpk-review-ui], [data-vpk-review-ignore], [data-vpk-generated], [aria-live], output, button, input, select, textarea, label, [contenteditable]";
}

// Walks `root` in document order: { text, nodes } with collapsed whitespace, one virtual space
// per block boundary and excluded subtrees skipped. nodes[i] = { node, start, end, offsets };
// offsets[k] is the raw offset of index char start + k, offsets[end - start] the raw offset past
// the last one. Options: excluded (Set), skipStamped, onEnter(el, offset, tag), onExit(el, offset, text).
export function textWalk(root, options = {}) {
	const excluded = options.excluded instanceof Set ? options.excluded : new Set(root.querySelectorAll(anchorExclusionSelector()));
	const boundary = /^(?:address|article|aside|audio|blockquote|br|canvas|caption|dd|details|dialog|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hgroup|hr|iframe|img|legend|li|main|menu|nav|object|ol|option|p|picture|pre|section|summary|svg|table|tbody|td|text|tfoot|th|thead|tr|ul|video)$/;
	const isSpace = (code) => code === 32 || (code >= 9 && code <= 13) || (code > 127 && /\s/.test(String.fromCharCode(code)));
	const skipStamped = options.skipStamped === true;
	const onEnter = typeof options.onEnter === "function" ? options.onEnter : null;
	const onExit = typeof options.onExit === "function" ? options.onExit : null;
	let text = "";
	let lastSpace = true;
	const nodes = [];
	const space = () => {
		if (!lastSpace) text += " ";
		lastSpace = true;
	};
	const visit = (parent) => {
		for (let child = parent.firstChild; child; child = child.nextSibling) {
			const type = child.nodeType;
			if (type === 3 || type === 4) {
				const value = child.nodeValue || "";
				if (!value) continue;
				const start = text.length;
				const offsets = [];
				let run = "";
				for (let index = 0; index < value.length; index++) {
					if (isSpace(value.charCodeAt(index))) {
						if (lastSpace) continue;
						run += " ";
						lastSpace = true;
					} else {
						run += value[index];
						lastSpace = false;
					}
					offsets.push(index);
				}
				if (offsets.length > 0) {
					text += run;
					offsets.push(offsets[offsets.length - 1] + 1);
					nodes.push({ node: child, start, end: text.length, offsets });
				}
				continue;
			}
			if (type !== 1 || excluded.has(child)) continue;
			const stamped = child.getAttribute("data-vpk-id") !== null;
			if (skipStamped && stamped) {
				space();
				continue;
			}
			const tag = tagNameOf(child);
			const isBoundary = stamped || boundary.test(tag);
			if (isBoundary) space();
			if (onEnter) onEnter(child, text.length, tag);
			visit(child);
			if (onExit) onExit(child, text.length, text);
			if (isBoundary) space();
		}
	};
	visit(root);
	if (text.endsWith(" ")) {
		text = text.slice(0, -1);
		const last = nodes[nodes.length - 1];
		if (last && last.end > text.length) {
			last.offsets.pop();
			last.end -= 1;
			if (last.end === last.start) nodes.pop();
		}
	}
	return { text, nodes };
}

// The review text index over `root` (default main, else body). Returns { root, text, nodes,
// nodeMap, blocks: Map<id, {start, end}>, elements: Map<id, Element>, headings: [{ level, start,
// text }], excluded, contentIslands }. The first element carrying an id wins when ids repeat.
export function buildTextIndex(root) {
	const doc = globalThis.document;
	const scope = root || (doc && (doc.querySelector("main") || doc.body));
	if (!scope) throw new TypeError("buildTextIndex: no root element");
	const excluded = new Set(scope.querySelectorAll(anchorExclusionSelector()));
	const blocks = new Map();
	const headings = [];
	const open = new Map();
	const trimEnd = (text, start, end) => {
		let stop = Math.min(end, text.length);
		while (stop > start && text[stop - 1] === " ") stop--;
		return stop;
	};
	const walk = textWalk(scope, {
		excluded,
		onEnter(el, offset, tag) {
			const id = el.getAttribute("data-vpk-id");
			const level = /^h[1-6]$/.test(tag) ? Number(tag[1]) : 0;
			if (id || level) open.set(el, { id, start: offset, level });
		},
		onExit(el, offset, text) {
			const entry = open.get(el);
			if (!entry) return;
			open.delete(el);
			const end = trimEnd(text, entry.start, offset);
			if (entry.id && !blocks.has(entry.id)) blocks.set(entry.id, { start: entry.start, end });
			if (entry.level) headings.push({ level: entry.level, start: entry.start, text: text.slice(entry.start, end) });
		},
	});
	const length = walk.text.length;
	for (const [id, range] of blocks) if (range.end > length) blocks.set(id, { start: Math.min(range.start, length), end: length });
	headings.sort((a, b) => a.start - b.start);
	const nodeMap = new Map(walk.nodes.map((entry) => [entry.node, entry]));
	const elements = new Map();
	for (const el of scope.querySelectorAll("[data-vpk-id]")) {
		const id = el.getAttribute("data-vpk-id");
		if (id && !elements.has(id)) elements.set(id, el);
	}
	const owner = scope.ownerDocument || scope;
	const contentIslands = typeof owner.querySelector === "function" && owner.querySelector("script[type=\"application/json\"][data-vpk-content]") !== null;
	return { root: scope, text: walk.text, nodes: walk.nodes, nodeMap, blocks, elements, headings, excluded, contentIslands };
}

// Index offset of the DOM point (node, offset). Points in unindexed text or
// between nodes snap to the next indexed character; -1 outside the root.
export function indexOffsetFor(index, node, offset) {
	if (!node || !index.root.contains(node)) return -1;
	const entry = index.nodeMap.get(node);
	if (entry) {
		const length = entry.end - entry.start;
		for (let position = 0; position < length; position++) if (entry.offsets[position] >= offset) return entry.start + position;
		return entry.end;
	}
	const after = (current) => {
		let cursor = current;
		while (cursor && cursor !== index.root) {
			if (cursor.nextSibling) return cursor.nextSibling;
			cursor = cursor.parentNode;
		}
		return null;
	};
	let cursor = node.nodeType === 1 ? node.childNodes[offset] || after(node) : node;
	while (cursor) {
		const found = index.nodeMap.get(cursor);
		if (found) return found.start;
		cursor = cursor.firstChild || after(cursor);
	}
	return index.text.length;
}

// DOM point { node, offset } for an index offset. An offset on a virtual space
// snaps forward (bias "start") or backward (bias "end").
export function domPointFor(index, offset, bias = "start") {
	const nodes = index.nodes;
	if (nodes.length === 0 || typeof offset !== "number") return null;
	const firstFailing = (test) => {
		let low = 0;
		let high = nodes.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (test(nodes[middle])) low = middle + 1;
			else high = middle;
		}
		return low;
	};
	if (bias === "end") {
		const entry = nodes[Math.max(0, firstFailing((node) => node.start < offset) - 1)];
		if (offset <= entry.start) return { node: entry.node, offset: entry.offsets[0] };
		return { node: entry.node, offset: entry.offsets[Math.min(offset, entry.end) - entry.start] };
	}
	const low = firstFailing((node) => node.end <= offset);
	if (low >= nodes.length) {
		const last = nodes[nodes.length - 1];
		return { node: last.node, offset: last.offsets[last.end - last.start] };
	}
	const entry = nodes[low];
	if (offset <= entry.start) return { node: entry.node, offset: entry.offsets[0] };
	return { node: entry.node, offset: entry.offsets[offset - entry.start] };
}

// Normalized own text of `el`: anchor-excluded subtrees and stamped ([data-vpk-id]) descendant
// blocks are left out. `excluded` may pass the document's precomputed exclusion set.
export function ownText(el, excluded) {
	return textWalk(el, { skipStamped: true, excluded }).text;
}

// Stable fingerprint of a media block: tags, text and content attributes. data-*, aria-* (except
// aria-label), class, style, tabindex and role are skipped because runtimes and the enhancer change
// them in the live DOM; SMIL elements are motion rather than content; canvas size follows
// devicePixelRatio. The text between two kept child elements is one quoted run: linkedom splits
// text at character references where HTML tree builders (Chromium, happy-dom) keep one node.
export function mediaFingerprint(el) {
	let out = "";
	const skipTags = /^(?:animate|animatetransform|animatemotion|set|mpath)$/;
	const quoted = (run) => (normalizeWhitespace(run) ? "\"" + normalizeWhitespace(run) + "\"" : "");
	const visit = (node) => {
		const tag = tagNameOf(node);
		const attrs = [];
		const list = node.attributes || [];
		for (let position = 0; position < list.length; position++) {
			const attr = list[position];
			const name = String(attr.name).toLowerCase();
			const volatile = name.startsWith("data-") || (name.startsWith("aria-") && name !== "aria-label") || /^(?:class|style|tabindex|role)$/.test(name);
			if (!volatile && !(tag === "canvas" && (name === "width" || name === "height"))) attrs.push(name + "=" + JSON.stringify(String(attr.value)));
		}
		attrs.sort();
		out += "(" + tag + (attrs.length ? " " + attrs.join(" ") : "");
		let run = "";
		for (let child = node.firstChild; child; child = child.nextSibling) {
			if (child.nodeType === 3 || child.nodeType === 4) run += child.nodeValue || "";
			else if (child.nodeType === 1 && !skipTags.test(tagNameOf(child))) {
				out += quoted(run);
				run = "";
				visit(child);
			}
		}
		out += quoted(run) + ")";
	};
	visit(el);
	return out;
}

export function isMediaBlock(el) {
	return /^(?:svg|img|video|canvas)$/.test(tagNameOf(el));
}

// Block signature for carry-over matching (ws1 4.4), at most 400 characters.
// `own` may pass a precomputed ownText(el).
export function blockSignature(el, own) {
	const label = () => el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("title") || "";
	let signature = isMediaBlock(el) ? normalizeWhitespace(label()) : "";
	if (!signature) signature = typeof own === "string" ? own : ownText(el);
	if (!signature) {
		const heading = el.querySelector("h1, h2, h3, h4, h5, h6, figcaption, caption, legend, summary");
		if (heading) signature = textWalk(heading).text;
	}
	if (!signature) signature = normalizeWhitespace(label() || el.getAttribute("data-vpk-figure") || "");
	return signature.slice(0, 400);
}

// Content hash of a block: own text, or the media fingerprint for svg/img/video/canvas.
export function blockContentHash(el, own) {
	if (isMediaBlock(el)) return hashText(mediaFingerprint(el));
	return hashText(typeof own === "string" ? own : ownText(el));
}

// The innermost stamped element containing index offset `offset`, or null.
export function blockElementAt(index, offset) {
	const point = domPointFor(index, offset, "start");
	if (!point) return null;
	const parent = point.node.nodeType === 1 ? point.node : point.node.parentElement;
	const el = parent ? parent.closest("[data-vpk-id]") : null;
	return el && index.root.contains(el) ? el : null;
}

export function blockIdAt(index, offset) {
	const el = blockElementAt(index, offset);
	return el ? el.getAttribute("data-vpk-id") : null;
}

// Up to three enclosing headings (outermost first) for an index offset.
export function headingPathFor(index, offset) {
	const stack = [];
	for (const heading of index.headings) {
		if (heading.start > offset) break;
		while (stack.length && stack[stack.length - 1].level >= heading.level) stack.pop();
		stack.push(heading);
	}
	return stack.slice(-3).map((heading) => excerpt(heading.text, 80)).filter(Boolean);
}

// Selector path to `el`, rooted at html or at the nearest ancestor with a unique id.
export function cssPathFor(el) {
	const parts = [];
	const owner = el.ownerDocument;
	let node = el;
	while (node && node.nodeType === 1) {
		const tag = tagNameOf(node);
		const id = node.getAttribute("id");
		if (id) {
			const selector = "[id=\"" + id.replace(/["\\]/g, "\\$&") + "\"]";
			if (owner && owner.querySelectorAll(selector).length === 1) {
				parts.unshift(selector);
				break;
			}
		}
		const parent = node.parentElement;
		if (tag === "html" || !parent) {
			parts.unshift(tag);
			break;
		}
		let count = 0;
		let position = 0;
		for (let sibling = parent.firstChild; sibling; sibling = sibling.nextSibling) {
			if (sibling.nodeType !== 1 || tagNameOf(sibling) !== tag) continue;
			count++;
			if (sibling === node) position = count;
		}
		parts.unshift(count > 1 ? tag + ":nth-of-type(" + position + ")" : tag);
		node = parent;
	}
	return parts.join(" > ");
}

// Every start offset of `exact` in text with the match inside [from, to).
export function findQuote(text, exact, from = 0, to = text.length) {
	const hits = [];
	if (!exact) return hits;
	let position = text.indexOf(exact, Math.max(0, from));
	while (position >= 0 && position + exact.length <= to) {
		hits.push(position);
		position = text.indexOf(exact, position + 1);
	}
	return hits;
}

// Characters of quote.prefix matching backward from `start`, plus characters of
// quote.suffix matching forward from `end`.
export function contextScore(text, start, end, quote) {
	let score = 0;
	const prefix = (quote && quote.prefix) || "";
	const suffix = (quote && quote.suffix) || "";
	for (let step = 1; step <= prefix.length && start - step >= 0; step++) {
		if (text[start - step] !== prefix[prefix.length - step]) break;
		score++;
	}
	for (let step = 0; step < suffix.length && end + step < text.length; step++) {
		if (text[end + step] !== suffix[step]) break;
		score++;
	}
	return score;
}

// The hit with the best context score (then nearest to `near` when >= 0), or -1.
// With `unique`, a tie for the best score returns -1.
export function bestHit(text, hits, length, quote, near = -1, unique = false) {
	let best = -1;
	let bestScore = -1;
	let bestDistance = Infinity;
	let ties = 0;
	for (const hit of hits) {
		const score = contextScore(text, hit, hit + length, quote);
		const distance = near >= 0 ? Math.abs(hit - near) : 0;
		if (score === bestScore) ties++;
		if (score > bestScore || (score === bestScore && distance < bestDistance)) {
			if (score > bestScore) ties = 1;
			best = hit;
			bestScore = score;
			bestDistance = distance;
		}
	}
	return unique && ties !== 1 ? -1 : best;
}

// Text anchor (C3 Anchor) for an index range: { start, end } offsets or a DOM
// Range. Throws RangeError for empty selections and for more than 2,000 characters.
export function createTextAnchor(index, range) {
	const isDomRange = !!(range && range.startContainer);
	let start = isDomRange ? indexOffsetFor(index, range.startContainer, range.startOffset) : range && typeof range.start === "number" ? range.start : -1;
	let end = isDomRange ? indexOffsetFor(index, range.endContainer, range.endOffset) : range && typeof range.end === "number" ? range.end : -1;
	const text = index.text;
	if (!(start >= 0 && end >= start && end <= text.length)) throw new RangeError("Select text inside the document");
	while (start < end && text[start] === " ") start++;
	while (end > start && text[end - 1] === " ") end--;
	if (end <= start) throw new RangeError("Select some text to comment on");
	if (end - start > 2000) throw new RangeError("Select less text (2,000 characters max)");
	const blockEl = blockElementAt(index, start);
	const endEl = blockElementAt(index, end - 1);
	const anchor = { blockId: blockEl ? blockEl.getAttribute("data-vpk-id") : null };
	if (endEl && endEl !== blockEl) anchor.endBlockId = endEl.getAttribute("data-vpk-id");
	if (blockEl) Object.assign(anchor, blockFields(index, blockEl));
	anchor.quote = { exact: text.slice(start, end), prefix: text.slice(Math.max(0, start - 32), start), suffix: text.slice(end, end + 32) };
	const blockRange = anchor.blockId ? index.blocks.get(anchor.blockId) : null;
	anchor.position = blockRange ? { start: start - blockRange.start, end: end - blockRange.start } : { start, end };
	const startPoint = domPointFor(index, start, "start");
	const endPoint = domPointFor(index, end, "end");
	const cssRoot = blockEl || (startPoint && startPoint.node.parentElement);
	if (cssRoot && startPoint && endPoint) {
		const path = cssPathFor(cssRoot);
		const startPath = nodePath(startPoint.node, cssRoot);
		const endPath = nodePath(endPoint.node, cssRoot);
		if (path.length <= 400 && startPath && endPath && startPath.length <= 64 && endPath.length <= 64) {
			anchor.css = { path, start: { path: startPath, offset: startPoint.offset }, end: { path: endPath, offset: endPoint.offset } };
		}
	}
	anchor.headingPath = headingPathFor(index, start);
	const sectionId = sectionIdFor(index, blockEl);
	if (sectionId) anchor.sectionId = sectionId;
	return anchor;
}

// Block anchor for `element` or its nearest stamped ancestor (no quote, no css).
export function createBlockAnchor(index, element) {
	const el = element && typeof element.closest === "function" ? element.closest("[data-vpk-id]") : null;
	if (!el || !index.root.contains(el)) throw new RangeError("Pick a block inside the document");
	const anchor = { blockId: el.getAttribute("data-vpk-id"), ...blockFields(index, el) };
	const range = index.blocks.get(anchor.blockId);
	anchor.headingPath = headingPathFor(index, range ? range.start : 0);
	const sectionId = sectionIdFor(index, el);
	if (sectionId) anchor.sectionId = sectionId;
	return anchor;
}

// Tag, own-text hash and signature excerpt of a stamped block (anchor fields).
export function blockFields(index, el) {
	const own = ownText(el, index.excluded);
	return { blockTag: tagNameOf(el), blockHash: blockContentHash(el, own), blockText: excerpt(blockSignature(el, own), 160) };
}

export function sectionIdFor(index, el) {
	const section = el ? el.closest("section[id], article[id]") : null;
	return section && index.root.contains(section) ? section.getAttribute("id") : null;
}

export function tagNameOf(el) {
	return String(el.localName || el.tagName || "").toLowerCase();
}

// Resolves an anchor against an index: { status, start, end, blockId,
// changedText? }, status one of exact | moved | fuzzy | block-only | css |
// runtime | orphaned; start/end are index offsets (null when not located).
// ctx.contentIslands overrides index.contentIslands for the runtime rule.
export function resolveAnchor(index, anchor, ctx = {}) {
	const text = index.text;
	const contentIslands = ctx.contentIslands === undefined ? index.contentIslands : ctx.contentIslands === true;
	if (!anchor) return { status: "exact", start: null, end: null, blockId: null };
	const cache = index.cache || (index.cache = new Map());
	const fieldsOf = (el) => cache.get(el) || cache.set(el, blockFields(index, el)).get(el);
	const located = (status, start, end, blockId, extra) => {
		const id = blockId || (typeof start === "number" ? blockIdAt(index, start) : null) || anchor.blockId || null;
		return Object.assign({ status, start, end, blockId: id }, extra || {});
	};
	const notLocated = (status) => ({ status, start: null, end: null, blockId: anchor.blockId || null });
	const runtimeRendered = () => contentIslands && !!anchor.blockId && !index.elements.has(anchor.blockId);
	const atBlock = (status, id) => {
		const range = index.blocks.get(id);
		return located(status, range ? range.start : null, range ? range.end : null, id);
	};
	const blockRange = (anchor.blockId && index.blocks.get(anchor.blockId)) || null;
	const blockExists = !!anchor.blockId && (index.blocks.has(anchor.blockId) || index.elements.has(anchor.blockId));
	// Every container whose children are all stamped has empty own text, so this one
	// "anonymous" hash: it never identifies a block on its own.
	const anonymous = anchor.blockHash === hashText("");
	// Block anchors: by id, then the one block with the same hash (moved; an
	// anonymous hash also needs the same signature; several are narrowed by heading
	// path, and identical twins never count as similar), then dice >= 0.6 (fuzzy).
	if (!anchor.quote) {
		if (blockExists) return atBlock("exact", anchor.blockId);
		const grams = anchor.blockTag ? wordBigrams(anchor.blockText || "") : [];
		const twins = [];
		let best = null;
		let bestScore = 0;
		for (const [id, el] of index.elements) {
			if (anchor.blockTag && tagNameOf(el) !== anchor.blockTag) continue;
			const fields = fieldsOf(el);
			const twin = anchor.blockHash && fields.blockHash === anchor.blockHash && (!anonymous || (!!anchor.blockText && fields.blockText === anchor.blockText));
			if (twin) twins.push(id);
			const score = grams.length && !twin ? diceSimilarity(grams, wordBigrams(fields.blockText)) : 0;
			if (score >= 0.6 && score > bestScore) {
				best = id;
				bestScore = score;
			}
		}
		const path = JSON.stringify(anchor.headingPath || []);
		const near = twins.length > 1 ? twins.filter((id) => JSON.stringify(headingPathFor(index, (index.blocks.get(id) || { start: 0 }).start)) === path) : twins;
		if (near.length === 1) return atBlock("moved", near[0]);
		if (best) return atBlock("fuzzy", best);
		return notLocated(runtimeRendered() ? "runtime" : "orphaned");
	}

	const quote = anchor.quote;
	const exact = quote.exact;
	const expected = anchor.position ? (blockRange ? blockRange.start : 0) + anchor.position.start : -1;
	const endRange = (anchor.endBlockId && index.blocks.get(anchor.endBlockId)) || null;
	const scopeEnd = blockRange ? Math.max(blockRange.end, endRange ? endRange.end : 0) : 0;

	// 1. block id + quote
	if (blockRange) {
		const hits = findQuote(text, exact, blockRange.start, scopeEnd);
		if (hits.length) {
			const hit = bestHit(text, hits, exact.length, quote, expected);
			return located("exact", hit, hit + exact.length, anchor.blockId);
		}
	}
	// 2. a unique best global occurrence (exact when it is where the anchor put it: no block, or past its end)
	const moved = bestHit(text, findQuote(text, exact), exact.length, quote, -1, true);
	if (moved >= 0) return located(moved === expected && (blockRange || !anchor.blockId) ? "exact" : "moved", moved, moved + exact.length);

	// 3. steps 1-2 on folded text
	const folded = index.folded || (index.folded = foldTextMap(text));
	const lowerBound = (value) => {
		let low = 0;
		let high = folded.map.length;
		while (low < high) {
			const middle = (low + high) >> 1;
			if (folded.map[middle] < value) low = middle + 1;
			else high = middle;
		}
		return low;
	};
	const toSource = (start, end) => {
		let from = folded.map[start];
		let to = folded.map[end - 1] + 1;
		while (from < to && text[from] === " ") from++;
		while (to > from && text[to - 1] === " ") to--;
		return [from, to];
	};
	const foldedQuote = foldTextMap(exact).text;
	const foldedContext = { prefix: foldTextMap(quote.prefix, true).text, suffix: foldTextMap(quote.suffix, true).text };
	if (foldedQuote) {
		if (blockRange) {
			const hits = findQuote(folded.text, foldedQuote, lowerBound(blockRange.start), lowerBound(scopeEnd));
			if (hits.length) {
				const hit = bestHit(folded.text, hits, foldedQuote.length, foldedContext, expected >= 0 ? lowerBound(expected) : -1);
				const [start, end] = toSource(hit, hit + foldedQuote.length);
				return located("fuzzy", start, end, anchor.blockId);
			}
		}
		const hit = bestHit(folded.text, findQuote(folded.text, foldedQuote), foldedQuote.length, foldedContext, -1, true);
		if (hit >= 0) {
			const [start, end] = toSource(hit, hit + foldedQuote.length);
			return located("fuzzy", start, end);
		}
	}

	// 4. prefix ... suffix bracket within exact.length * 2 + 40 characters
	const prefix = foldedContext.prefix;
	const suffix = foldedContext.suffix;
	if (prefix.trim() && suffix.trim()) {
		const limit = exact.length * 2 + 40;
		const candidates = [];
		for (const hit of findQuote(folded.text, prefix)) {
			const from = hit + prefix.length;
			const stop = folded.text.indexOf(suffix, from);
			if (stop < 0 || stop - from > limit || !folded.text.slice(from, stop).trim()) continue;
			candidates.push([from, stop]);
		}
		let chosen = candidates.length === 1 ? candidates[0] : null;
		if (!chosen && candidates.length > 1 && blockRange) {
			const inside = candidates.filter(([from, stop]) => folded.map[from] >= blockRange.start && folded.map[stop - 1] < scopeEnd);
			if (inside.length === 1) chosen = inside[0];
		}
		if (chosen) {
			const [start, end] = toSource(chosen[0], chosen[1]);
			const changed = text.slice(start, end);
			return located("fuzzy", start, end, null, changed === exact ? null : { changedText: changed });
		}
	}

	// 5. the block survives but the quote is gone
	if (blockExists) return atBlock("block-only", anchor.blockId);

	// 6. css path whose own-text hash still matches (an anonymous hash needs the quote)
	const query = (selector) => {
		try {
			return (index.root.ownerDocument || index.root).querySelector(selector);
		} catch {
			return null;
		}
	};
	const el = anchor.css && anchor.blockHash ? query(anchor.css.path) : null;
	if (el && index.root.contains(el) && fieldsOf(el).blockHash === anchor.blockHash) {
		const id = el.getAttribute("data-vpk-id") || null;
		const startNode = resolveNodePath(el, anchor.css.start.path);
		const endNode = resolveNodePath(el, anchor.css.end.path);
		const start = startNode ? indexOffsetFor(index, startNode, anchor.css.start.offset) : -1;
		const end = endNode ? indexOffsetFor(index, endNode, anchor.css.end.offset) : -1;
		if (start >= 0 && end > start && text.slice(start, end) === exact) return located("css", start, end, id);
		const elStart = indexOffsetFor(index, el, 0);
		const elEnd = indexOffsetFor(index, el, el.childNodes.length);
		const hit = bestHit(text, findQuote(text, exact, elStart, elEnd), exact.length, quote);
		if (hit >= 0) return located("css", hit, hit + exact.length, id);
		if (!anonymous) return located("css", elStart, elEnd, id);
	}

	// 7. rendered at runtime (documents with content islands; the CLI cannot check)
	return notLocated(runtimeRendered() ? "runtime" : "orphaned");
}
