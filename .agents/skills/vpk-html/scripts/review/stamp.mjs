/*
 * review/stamp: block stamping, the vpk-blocks/1 ledger, revision stamping and lite-variant sync
 * (ws1 4.4). Node only. Stamping never reserializes the file: scanStartTags tokenizes the source,
 * a temporary attribute goes on every start tag inside main, linkedom decides candidacy from that
 * copy, and the output is the original source plus inserted (or rewritten) data-vpk-id attributes
 * only. Signatures and hashes come from the anchor.mjs functions the browser runs. linkedom
 * loads lazily (R28): importing this module loads no heavy dependency.
 */

import { createRequire } from "node:module";
import path from "node:path";
import { anchorExclusionSelector, blockContentHash, blockSignature, ownText, reviewBlockSelector } from "./anchor.mjs";
import { readIslandJson, readMarkedBlockText, readMetaContent, setMarkedBlockText, setRegistryText } from "./markup.mjs";
import { createBlockId, createDocId, createRandom, isBlockId, isCommentId, isDocId, isRevisionId, normalizeRegistry, nowIso, reviewLimits } from "./schema.mjs";
import { diceSimilarity, excerpt, hashText, wordBigrams } from "./text.mjs";

const require = createRequire(import.meta.url);

export const LEDGER_SCHEMA = "vpk-blocks/1";
export const REGISTRY_SCHEMA = "vpk-revisions/1";

// Elements (and their subtrees) that are never stamped.
export const STAMP_EXCLUSION_SELECTOR = "template, script, style, noscript, .speaker-notes, [data-vpk-review-ignore], [data-vpk-generated], [data-vpk-review-ui]";

const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "noscript"]);

/** An error that carries the CLI exit code (ws1 C8: 1 usage/IO, 2 schema, 3 doc id, 4 template). */
export class ReviewError extends Error {
	constructor(message, exitCode = 1) {
		super(message);
		this.name = "ReviewError";
		this.exitCode = exitCode;
	}
}

export function parseDocument(html) {
	const { parseHTML } = require("linkedom");
	return parseHTML(html).document;
}

function isSpaceChar(char) {
	return char === " " || char === "\n" || char === "\t" || char === "\r" || char === "\f";
}

// Tokenizes start tags. Skips comments, doctype/processing instructions, CDATA,
// raw-text element contents and quoted attribute values. Each token is
// { name, start, end, insertAt, selfClosing, attrs, inMain, inTemplate, inSvg }
// where inSvg means "inside an svg" (the svg root itself has inSvg false) and
// attrs are { name, start, end, valueStart, valueEnd, quote } (quote: '"', "'",
// "" for unquoted, null for a bare attribute).
export function scanStartTags(html) {
	const tags = [];
	const length = html.length;
	const endTag = /<\/([A-Za-z][^\s/>]*)[^>]*>/y;
	let index = 0;
	let main = 0;
	let template = 0;
	let svg = 0;
	while (index < length) {
		const lt = html.indexOf("<", index);
		if (lt < 0) break;
		const next = html[lt + 1];
		if (html.startsWith("<!--", lt)) {
			const close = html.indexOf("-->", lt + 4);
			index = close < 0 ? length : close + 3;
			continue;
		}
		if (html.startsWith("<![CDATA[", lt)) {
			const close = html.indexOf("]]>", lt + 9);
			index = close < 0 ? length : close + 3;
			continue;
		}
		if (next === "!" || next === "?") {
			const close = html.indexOf(">", lt + 2);
			index = close < 0 ? length : close + 1;
			continue;
		}
		if (next === "/") {
			endTag.lastIndex = lt;
			const match = endTag.exec(html);
			if (!match) {
				index = lt + 2;
				continue;
			}
			const name = match[1].toLowerCase();
			if (name === "main" && main > 0) main--;
			else if (name === "template" && template > 0) template--;
			else if (name === "svg" && svg > 0) svg--;
			index = lt + match[0].length;
			continue;
		}
		if (!next || !/[A-Za-z]/.test(next)) {
			index = lt + 1;
			continue;
		}
		let cursor = lt + 1;
		while (cursor < length && !isSpaceChar(html[cursor]) && html[cursor] !== "/" && html[cursor] !== ">") cursor++;
		const name = html.slice(lt + 1, cursor).toLowerCase();
		const attrs = [];
		let selfClosing = false;
		let end = -1;
		while (cursor < length) {
			const char = html[cursor];
			if (char === ">") {
				end = cursor;
				break;
			}
			if (isSpaceChar(char)) {
				cursor++;
				continue;
			}
			if (char === "/") {
				if (html[cursor + 1] === ">") {
					selfClosing = true;
					end = cursor + 1;
					break;
				}
				cursor++;
				continue;
			}
			const nameStart = cursor;
			cursor++;
			while (cursor < length && !isSpaceChar(html[cursor]) && html[cursor] !== "/" && html[cursor] !== ">" && html[cursor] !== "=") cursor++;
			const attrName = html.slice(nameStart, cursor).toLowerCase();
			let probe = cursor;
			while (probe < length && isSpaceChar(html[probe])) probe++;
			if (html[probe] !== "=") {
				attrs.push({ name: attrName, start: nameStart, end: cursor, valueStart: cursor, valueEnd: cursor, quote: null });
				continue;
			}
			probe++;
			while (probe < length && isSpaceChar(html[probe])) probe++;
			const quote = html[probe];
			if (quote === "\"" || quote === "'") {
				const close = html.indexOf(quote, probe + 1);
				const valueEnd = close < 0 ? length : close;
				attrs.push({ name: attrName, start: nameStart, end: Math.min(length, valueEnd + 1), valueStart: probe + 1, valueEnd, quote });
				cursor = Math.min(length, valueEnd + 1);
			} else {
				let valueEnd = probe;
				while (valueEnd < length && !isSpaceChar(html[valueEnd]) && html[valueEnd] !== ">") valueEnd++;
				attrs.push({ name: attrName, start: nameStart, end: valueEnd, valueStart: probe, valueEnd, quote: "" });
				cursor = valueEnd;
			}
		}
		if (end < 0) break;
		tags.push({ name, start: lt, end: end + 1, insertAt: selfClosing ? end - 1 : end, selfClosing, attrs, inMain: main > 0, inTemplate: template > 0, inSvg: svg > 0 });
		if (name === "main") main++;
		else if (name === "template") template++;
		else if (name === "svg" && !selfClosing) svg++;
		index = end + 1;
		if (RAW_TEXT_ELEMENTS.has(name)) {
			const close = new RegExp(`</${name}(?=[\\s/>])`, "gi");
			close.lastIndex = index;
			const match = close.exec(html);
			index = match ? match.index : length;
		}
	}
	return tags;
}

// Applies non-overlapping { start, end, text } edits to the source.
export function applyEdits(html, edits) {
	const sorted = edits.slice().sort((a, b) => a.start - b.start || a.end - b.end);
	let out = "";
	let last = 0;
	for (const edit of sorted) {
		if (edit.start < last) throw new Error(`overlapping edits at ${edit.start}`);
		out += html.slice(last, edit.start) + edit.text;
		last = edit.end;
	}
	return out + html.slice(last);
}

// Carry-over (ws1 4.4). Existing ids are kept (a duplicated id stays with the block matching the
// ledger hash and signature, else hash, else the first; the others are re-ided). Distances are
// aligned: the expected ledger order is offset from the nearest block that kept its id or whose
// tag and hash are unique on both sides, so an edit does not shift a pick onto a same-text
// neighbour. Candidates are unclaimed same-tag ledger blocks: (a) the same hash, nearest; (b)
// signature dice >= 0.6 (never on empty grams) within distance 40. Unique blocks take (a) else (b);
// duplicated leaves take (a) globally by rank (an original beats its copy), under the parent's
// ledger id first; innermost first, a block with child blocks takes the ledger block most (> 1/2)
// of them came from; the rest take (a) else (b). An anonymous block (empty own text, a hash shared
// by every container whose children are all stamped) needs the same non-empty signature for (a),
// or, childless and unsigned, its exact aligned position. Leftovers get new ids in document order
// (when mint). Mutates blocks[i].id and returns the counts.
export function matchBlocksToLedger(blocks, ledgerBlocks = [], options = {}) {
	const mint = options.mint !== false;
	const random = options.random || createRandom(options.seed);
	const taken = options.taken || new Set();
	const ledgerById = new Map(ledgerBlocks.map(block => [block.id, block]));
	for (const block of ledgerBlocks) taken.add(block.id);
	const claimed = new Set();
	const stats = { kept: 0, carried: 0, minted: 0, reided: 0, unmatched: 0 };
	const listIn = (map, key) => map.get(key) || map.set(key, []).get(key);
	const groups = new Map();
	blocks.forEach((block, order) => {
		block.order = order;
		block.id = null;
		if (block.existing) listIn(groups, block.existing).push(block);
	});
	for (const [id, group] of groups) {
		const known = ledgerById.get(id);
		const keeper = (known && (group.find(block => block.hash === known.hash && block.sig === known.sig) || group.find(block => block.hash === known.hash))) || group[0];
		taken.add(id);
		claimed.add((keeper.id = id));
		stats.kept++;
		for (const block of group) if (block !== keeper) Object.assign(block, { existing: null, reided: true });
	}
	const anonymous = hashText("");
	const keyOf = block => `${block.tag}|${block.hash}`;
	const [byTag, byKey, blockKeys, children] = [new Map(), new Map(), new Map(), new Map()];
	for (const block of ledgerBlocks) {
		listIn(byTag, block.tag).push(block);
		listIn(byKey, keyOf(block)).push(block);
	}
	for (const block of blocks) {
		listIn(blockKeys, keyOf(block)).push(block);
		if (block.parentBlock) listIn(children, block.parentBlock).push(block);
	}
	const unique = block =>block.hash !== anonymous && (byKey.get(keyOf(block)) || []).length <= 1 && blockKeys.get(keyOf(block)).length === 1;
	const anchors = [];
	for (const block of blocks) {
		const known = block.id ? ledgerById.get(block.id) : unique(block) && byKey.has(keyOf(block)) ? byKey.get(keyOf(block))[0] : null;
		if (known) anchors.push([block.order, known.order]);
	}
	let next = 0;
	for (const block of blocks) {
		while (next < anchors.length && anchors[next][0] < block.order) next++;
		const [before, after] = [anchors[next - 1], anchors[next]];
		const near = !before || (after && after[0] - block.order < block.order - before[0]) ? after : before;
		block.expected = near ? near[1] + block.order - near[0] : block.order;
	}
	const gap = (block, candidate) => Math.abs(candidate.order - block.expected);
	const grams = new Map();
	const gramsOf = block => grams.get(block) || grams.set(block, wordBigrams(block.sig)).get(block);
	// Rank functions (lower is better, Infinity rejects): (a) with `context`, the parent's ledger id.
	const alike = (block, context) => (candidate, distance) => {
		if (candidate.hash !== block.hash || (block.hash === anonymous && (!block.sig || candidate.sig !== block.sig))) return Infinity;
		return (candidate.sig === block.sig ? 0 : 2e9) + (context && candidate.parent === context ? 0 : 1e9) + distance;
	};
	const samePlace = block => (candidate, distance) => (!block.sig && !candidate.sig && candidate.hash === block.hash && distance === 0 && !children.has(block) ? 0 : Infinity);
	const similar = block => (candidate, distance) => {
		const score = gramsOf(block).length && distance <= 40 ? diceSimilarity(gramsOf(block), gramsOf(candidate)) : 0;
		return score >= 0.6 ? distance - score / 2 : Infinity;
	};
	// Takes the best candidate under the first rank function that accepts one.
	const take = (block, ...ranks) => {
		for (const rank of ranks) {
			let match = null;
			let low = Infinity;
			for (const candidate of byTag.get(block.tag) || []) {
				const value = claimed.has(candidate.id) ? Infinity : rank(candidate, gap(block, candidate));
				if (value < low) [match, low] = [candidate, value];
			}
			if (!match) continue;
			claimed.add((block.id = match.id));
			return void stats.carried++;
		}
	};
	// [ledger parent id, count] for the block's identified child blocks, most first.
	const votesOf = block => {
		const votes = new Map();
		for (const kid of children.get(block) || []) {
			const from = kid.id ? ledgerById.get(kid.id) : null;
			if (from && from.parent) votes.set(from.parent, (votes.get(from.parent) || 0) + 1);
		}
		return [...votes].sort((a, b) => b[1] - a[1]);
	};
	const contextOf = block => (block.parentBlock ? block.parentBlock.id || (votesOf(block.parentBlock)[0] || [])[0] : null);
	for (const block of blocks) if (!block.id && unique(block)) take(block, alike(block, null), similar(block));
	const pairs = [];
	for (const block of blocks) {
		if (block.id || unique(block) || block.hash === anonymous || children.has(block)) continue;
		const rank = alike(block, contextOf(block));
		for (const candidate of byKey.get(keyOf(block)) || []) pairs.push([rank(candidate, gap(block, candidate)), block, candidate]);
	}
	pairs.sort((a, b) => a[0] - b[0] || a[1].order - b[1].order);
	for (const [, block, candidate] of pairs) if (!block.id && !claimed.has(candidate.id)) take(block, other => (other === candidate ? 0 : Infinity));
	for (const block of blocks.filter(item => !item.id && children.has(item)).reverse()) {
		const [top] = votesOf(block);
		if (top && top[1] * 2 > children.get(block).length) take(block, candidate => (candidate.id === top[0] ? 0 : Infinity));
	}
	for (const block of blocks.filter(item => !item.id).reverse()) take(block, alike(block, contextOf(block)), samePlace(block), similar(block));
	for (const block of blocks) {
		if (block.reided) stats.reided++;
		if (block.id) continue;
		if (mint) taken.add((block.id = createBlockId(random, taken)));
		stats[mint ? "minted" : "unmatched"]++;
	}
	return stats;
}

// Stamps data-vpk-id on every candidate block inside main and returns
// { html, blocks (ledger records in document order), islands, stats }.
// Options: ledger (carry-over source), random | seed, mint (default true).
export function stampBlocks(html, options = {}) {
	const ledger = options.ledger || null;
	const random = options.random || createRandom(options.seed);
	const tokens = scanStartTags(html).filter(token => token.inMain && !token.inTemplate && !token.inSvg);
	const document = parseDocument(applyEdits(html, tokens.map((token, key) => ({ start: token.insertAt, end: token.insertAt, text: ` data-vpk-tmp="${key}"` }))));
	const byKey = new Map();
	for (const el of document.querySelectorAll("[data-vpk-tmp]")) byKey.set(Number(el.getAttribute("data-vpk-tmp")), el);
	const excluded = new Set([...document.querySelectorAll(STAMP_EXCLUSION_SELECTOR)].flatMap(root => [root, ...root.querySelectorAll("*")]));
	const candidates = new Set(document.querySelectorAll(reviewBlockSelector()));
	const hasDirectText = el => [...el.childNodes].some(child => (child.nodeType === 3 || child.nodeType === 4) && /\S/.test(child.nodeValue || ""));
	const blocks = [];
	tokens.forEach((token, key) => {
		const el = byKey.get(key);
		if (!el || excluded.has(el)) return;
		const raw = el.getAttribute("data-vpk-id");
		const tag = String(el.localName || el.tagName).toLowerCase();
		const candidate = candidates.has(el) || (tag === "div" && hasDirectText(el));
		if (!candidate && (raw === null || !isBlockId(raw))) return;
		blocks.push({ token, el, tag, existing: raw !== null && isBlockId(raw) ? raw : null });
	});
	// Ids anywhere in the document (inside or outside main) are never minted again.
	const taken = new Set([...document.querySelectorAll("[data-vpk-id]")].map(el => el.getAttribute("data-vpk-id")).filter(isBlockId));
	for (const [position, block] of blocks.entries()) if (!block.existing) block.el.setAttribute("data-vpk-id", `__vpk_tmp_${position}`);
	const textExclusions = new Set(document.querySelectorAll(anchorExclusionSelector()));
	const blockOf = new Map(blocks.map(block => [block.el, block]));
	for (const block of blocks) {
		const own = ownText(block.el, textExclusions);
		block.sig = blockSignature(block.el, own).slice(0, 400);
		block.hash = blockContentHash(block.el, own);
		for (let parent = block.el.parentElement; parent && !block.parentBlock; parent = parent.parentElement) block.parentBlock = blockOf.get(parent);
	}
	const stats = matchBlocksToLedger(blocks, ledger ? ledger.blocks : [], { random, mint: options.mint !== false, taken });
	const edits = [];
	for (const block of blocks) {
		if (!block.id || block.id === block.existing) continue;
		const attr = block.token.attrs.find(item => item.name === "data-vpk-id");
		if (!attr) edits.push({ start: block.token.insertAt, end: block.token.insertAt, text: ` data-vpk-id="${block.id}"` });
		else if (attr.quote === "\"" || attr.quote === "'") edits.push({ start: attr.valueStart, end: attr.valueEnd, text: block.id });
		else edits.push({ start: attr.start, end: attr.end, text: `data-vpk-id="${block.id}"` });
	}
	const records = [];
	for (const block of blocks) {
		if (!block.id) continue;
		const record = { id: block.id, tag: block.tag, order: records.length, hash: block.hash, sig: block.sig };
		let parent = block.parentBlock;
		while (parent && !parent.id) parent = parent.parentBlock;
		if (parent) record.parent = parent.id;
		records.push(record);
	}
	const islands = {};
	for (const script of document.querySelectorAll("script[data-vpk-content]")) {
		if (String(script.getAttribute("type") || "").trim().toLowerCase() !== "application/json") continue;
		const base = `data-vpk-content=${script.getAttribute("data-vpk-content")}`;
		let key = base;
		for (let count = 2; Object.prototype.hasOwnProperty.call(islands, key); count++) key = `${base}:${count}`;
		islands[key] = hashText(script.textContent);
	}
	return { html: applyEdits(html, edits), blocks: records, islands, stats: { blocks: records.length, ...stats } };
}

// The stamped blocks and islands of a file, without minting or editing.
export function collectBlocks(html) {
	const { blocks, islands } = stampBlocks(html, { mint: false });
	return { blocks, islands };
}

function findMetaTags(html) {
	const headOpen = /<head\b(?:[^"'>]|"[^"]*"|'[^']*')*>/i.exec(html);
	if (!headOpen) return null;
	const headEnd = html.toLowerCase().indexOf("</head>", headOpen.index);
	const limit = headEnd < 0 ? html.length : headEnd;
	const pattern = /<meta\b(?:[^"'>]|"[^"]*"|'[^']*')*>/gi;
	pattern.lastIndex = headOpen.index + headOpen[0].length;
	const metas = [];
	let match = pattern.exec(html);
	while (match && match.index < limit) {
		const token = scanStartTags(match[0])[0];
		const attrs = {};
		for (const attr of token ? token.attrs : []) {
			if (!(attr.name in attrs)) attrs[attr.name] = { value: match[0].slice(attr.valueStart, attr.valueEnd), start: match.index + attr.valueStart, end: match.index + attr.valueEnd, quote: attr.quote, attrEnd: match.index + attr.end };
		}
		metas.push({ start: match.index, end: match.index + match[0].length, attrs });
		match = pattern.exec(html);
	}
	return { head: { start: headOpen.index, end: headOpen.index + headOpen[0].length }, metas };
}

function lineIndent(html, offset) {
	const lineStart = html.lastIndexOf("\n", offset - 1) + 1;
	const prefix = html.slice(lineStart, offset);
	return /^[ \t]*$/.test(prefix) ? prefix : "";
}

// Upserts <meta name="vpk-doc-id"> and <meta name="vpk-doc-revision"> (ws1 4.2):
// after the vpk-html generator meta, else after the charset meta, else first in
// head; the revision meta follows the doc-id meta. Existing metas are updated in
// place. A document without a head throws ReviewError (exit 2).
export function ensureDocMetas(html, values = {}) {
	let out = html;
	for (const [name, value] of [["vpk-doc-id", values.docId], ["vpk-doc-revision", values.revision]]) {
		if (value === undefined || value === null) continue;
		const found = findMetaTags(out);
		if (!found) throw new ReviewError("no <head>: add a head element before making the file reviewable", 2);
		const existing = found.metas.find(meta => meta.attrs.name && meta.attrs.name.value === name);
		if (existing) {
			const content = existing.attrs.content;
			if (content && content.value === value) continue;
			if (content && content.quote) out = `${out.slice(0, content.start)}${value}${out.slice(content.end)}`;
			else if (content && content.quote === "") out = `${out.slice(0, content.start)}"${value}"${out.slice(content.end)}`;
			else if (content) out = `${out.slice(0, content.end)}="${value}"${out.slice(content.end)}`;
			else {
				const insertAt = out[existing.end - 2] === "/" ? existing.end - 2 : existing.end - 1;
				out = `${out.slice(0, insertAt)} content="${value}"${out.slice(insertAt)}`;
			}
			continue;
		}
		const isGenerator = meta => meta.attrs.name && meta.attrs.name.value.toLowerCase() === "generator" && meta.attrs.content && meta.attrs.content.value === "vpk-html";
		let anchor = null;
		if (name === "vpk-doc-revision") anchor = found.metas.find(meta => meta.attrs.name && meta.attrs.name.value === "vpk-doc-id") || null;
		if (!anchor) anchor = found.metas.find(isGenerator) || found.metas.find(meta => meta.attrs.charset) || null;
		const tag = `<meta name="${name}" content="${value}">`;
		if (anchor) {
			out = `${out.slice(0, anchor.end)}\n${lineIndent(out, anchor.start)}${tag}${out.slice(anchor.end)}`;
		} else {
			const following = /^\r?\n([ \t]*)/.exec(out.slice(found.head.end));
			out = `${out.slice(0, found.head.end)}\n${following ? following[1] : ""}${tag}${out.slice(found.head.end)}`;
		}
	}
	return out;
}

// Sets data-vpk-revision="<revision>" on the start tags of `ids` and removes
// marks whose revision is in `dropRevisions`. `kinds` (id -> "added" | "changed") also writes
// data-vpk-revision-kind beside each mark, so the reveal chip can name what the mark means.
export function setRevisionMarks(html, ids, revision, dropRevisions = new Set(), kinds = null) {
	const attrValue = (source, attr) => (attr ? source.slice(attr.valueStart, attr.valueEnd) : null);
	const quoted = attr => attr && (attr.quote === "\"" || attr.quote === "'");
	const edits = [];
	for (const token of scanStartTags(html)) {
		if (!token.inMain || token.inTemplate) continue;
		const idAttr = token.attrs.find(attr => attr.name === "data-vpk-id");
		const revisionAttr = token.attrs.find(attr => attr.name === "data-vpk-revision");
		const kindAttr = token.attrs.find(attr => attr.name === "data-vpk-revision-kind");
		const id = idAttr && idAttr.quote !== null ? attrValue(html, idAttr) : null;
		if (id && ids.has(id) && revision) {
			let insert = "";
			if (quoted(revisionAttr)) {
				if (attrValue(html, revisionAttr) !== revision) edits.push({ start: revisionAttr.valueStart, end: revisionAttr.valueEnd, text: revision });
			} else if (revisionAttr) edits.push({ start: revisionAttr.start, end: revisionAttr.end, text: `data-vpk-revision="${revision}"` });
			else insert += ` data-vpk-revision="${revision}"`;
			const kind = kinds ? kinds.get(id) : null;
			if (kind) {
				if (quoted(kindAttr)) {
					if (attrValue(html, kindAttr) !== kind) edits.push({ start: kindAttr.valueStart, end: kindAttr.valueEnd, text: kind });
				} else if (kindAttr) edits.push({ start: kindAttr.start, end: kindAttr.end, text: `data-vpk-revision-kind="${kind}"` });
				else insert += ` data-vpk-revision-kind="${kind}"`;
			}
			if (insert) {
				const at = revisionAttr ? revisionAttr.end : idAttr.end;
				edits.push({ start: at, end: at, text: insert });
			}
		} else if (revisionAttr && dropRevisions.has(attrValue(html, revisionAttr))) {
			for (const attr of [revisionAttr, kindAttr]) {
				if (!attr) continue;
				let from = attr.start;
				while (from > token.start && isSpaceChar(html[from - 1])) from--;
				edits.push({ start: from, end: attr.end, text: "" });
			}
		}
	}
	return applyEdits(html, edits);
}

// The document's normalized revision registry ({ registry, issues, rejected });
// an island that is not valid JSON throws ReviewError (exit 2).
export function readRegistry(html) {
	let raw = null;
	try {
		raw = readIslandJson(html, "data-vpk-revisions");
	} catch (error) {
		throw new ReviewError(`revisions island: ${error.message}`, 2);
	}
	return normalizeRegistry(raw);
}

// Records a revision (ws1 4.4): diffs the stamped blocks against the ledger by
// id, marks changed and added start tags, appends the registry entry, updates
// the revision meta and caps the registry at 20 entries (dropping stale marks).
// The first stamp (no ledger, no registry) creates r1 "Initial version" without
// marks. With nothing changed and no addresses the file is returned
// byte-identical. When a full rebuild dropped the registry block, the ledger's
// copy (ledger.registry) and revision restore it, so numbering continues.
export function stampRevision(html, options = {}) {
	const limits = reviewLimits();
	const ledger = options.ledger || null;
	const timestamp = options.timestamp || nowIso();
	const current = options.blocks ? { blocks: options.blocks, islands: options.islands || {} } : collectBlocks(html);
	const fromHtml = readRegistry(html);
	const issues = fromHtml.issues.slice();
	let registry = fromHtml.registry;
	const restored = registry.entries.length === 0 && !!ledger;
	if (restored && ledger.registry) {
		const fromLedger = normalizeRegistry(ledger.registry);
		issues.push(...fromLedger.issues);
		registry = fromLedger.registry;
	}
	const addresses = [...new Set((options.addresses || []).filter(isCommentId))].slice(0, limits.addresses);
	const diff = { changed: [], added: [], removed: [], contentChanged: false };
	if (ledger) {
		const previous = new Map(ledger.blocks.map(block => [block.id, block]));
		const present = new Set();
		for (const block of current.blocks) {
			present.add(block.id);
			const before = previous.get(block.id);
			if (!before) diff.added.push(block.id);
			else if (before.hash !== block.hash) diff.changed.push(block.id);
		}
		for (const block of ledger.blocks) {
			if (!present.has(block.id) && diff.removed.length < limits.removed) diff.removed.push({ id: block.id, tag: block.tag, excerpt: excerpt(block.sig, limits.removedExcerpt) });
		}
		const before = ledger.islands || {};
		const after = current.islands || {};
		const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
		diff.contentChanged = [...keys].some(key => before[key] !== after[key]);
	}
	const entryFor = (id, label, marks) => {
		const entry = { id, label: String(label).slice(0, limits.label), timestamp };
		if (options.summary) entry.summary = String(options.summary).slice(0, limits.summary);
		entry.addresses = addresses;
		entry.changed = marks ? diff.changed.length : 0;
		entry.added = marks ? diff.added.length : 0;
		if (marks && diff.contentChanged) entry.contentChanged = true;
		entry.removed = marks ? diff.removed : [];
		return entry;
	};
	if (registry.entries.length === 0 && !ledger) {
		const entry = entryFor("r1", options.label || "Initial version", false);
		const next = { schema: REGISTRY_SCHEMA, entries: [entry] };
		const out = ensureDocMetas(setRegistryText(html, next), { revision: "r1" });
		return { html: out, entry, registry: next, changed: true, diff, issues };
	}
	const meta = readMetaContent(html, "vpk-doc-revision");
	const numberOf = value => (isRevisionId(value) ? Number(value.slice(1)) : 0);
	const lastId = registry.entries.length ? registry.entries[registry.entries.length - 1].id : null;
	const latest = Math.max(numberOf(lastId), numberOf(meta), numberOf(ledger && ledger.revision));
	const nothing = !diff.changed.length && !diff.added.length && !diff.removed.length && !diff.contentChanged && !addresses.length;
	if (nothing) {
		if (!restored && isRevisionId(meta)) return { html, entry: null, registry, changed: false, diff, issues };
		let out = registry.entries.length ? setRegistryText(html, registry) : html;
		out = ensureDocMetas(out, { revision: `r${Math.max(1, latest)}` });
		return { html: out, entry: null, registry, changed: out !== html, diff, issues };
	}
	const number = latest + 1;
	const id = `r${number}`;
	const entry = entryFor(id, options.label || `Revision ${number}`, true);
	let entries = [...registry.entries, entry];
	const dropped = new Set();
	while (entries.length > limits.registryEntries) dropped.add(entries.shift().id);
	const next = { schema: REGISTRY_SCHEMA, entries };
	const kinds = new Map([...diff.changed.map(block => [block, "changed"]), ...diff.added.map(block => [block, "added"])]);
	let out = setRevisionMarks(html, new Set(kinds.keys()), id, dropped, kinds);
	out = setRegistryText(out, next);
	out = ensureDocMetas(out, { revision: id });
	return { html: out, entry, registry: next, changed: true, diff, issues };
}

export function ledgerPathFor(htmlPath) {
	const dir = path.dirname(htmlPath);
	const base = path.basename(htmlPath).replace(/\.html?$/i, "");
	return path.join(dir, `${base}.vpk-blocks.json`);
}

// Validates a vpk-blocks/1 ledger; throws ReviewError (exit 2) on a bad shape.
export function normalizeLedger(raw) {
	if (!raw || typeof raw !== "object" || raw.schema !== LEDGER_SCHEMA) throw new ReviewError(`not a ${LEDGER_SCHEMA} ledger`, 2);
	if (!isDocId(raw.docId)) throw new ReviewError("ledger: invalid docId", 2);
	if (!Array.isArray(raw.blocks)) throw new ReviewError("ledger: blocks is not an array", 2);
	const blocks = [];
	const seen = new Set();
	for (const block of raw.blocks) {
		if (!block || !isBlockId(block.id) || seen.has(block.id) || typeof block.tag !== "string" || typeof block.hash !== "string") continue;
		seen.add(block.id);
		const record = { id: block.id, tag: block.tag, order: Number.isInteger(block.order) ? block.order : blocks.length, hash: block.hash, sig: typeof block.sig === "string" ? block.sig.slice(0, 400) : "" };
		if (isBlockId(block.parent)) record.parent = block.parent;
		blocks.push(record);
	}
	const ledger = {
		schema: LEDGER_SCHEMA,
		docId: raw.docId,
		revision: isRevisionId(raw.revision) ? raw.revision : "r1",
		reviewable: raw.reviewable === true,
		updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
		blocks,
	};
	if (raw.islands && typeof raw.islands === "object") {
		ledger.islands = {};
		for (const [key, value] of Object.entries(raw.islands)) if (typeof value === "string") ledger.islands[key] = value;
	}
	if (raw.registry && typeof raw.registry === "object") {
		const { registry } = normalizeRegistry(raw.registry);
		if (registry.entries.length) ledger.registry = registry;
	}
	return ledger;
}

export function serializeLedger(ledger) {
	return `${JSON.stringify(ledger, null, "\t")}\n`;
}

// Doc metas + block ids + revision for --inject-review and --stamp. Returns
// { html, ledger, docId, revision, stats, entry, diff }. Options: ledger,
// random | seed, label, summary, addresses, timestamp, newDocId, forceDoc,
// reviewable, revision (false skips the revision step), mint, seedScope.
// A seeded doc id is scoped to the document (seedScope, e.g. the file name, plus the source
// text), so one --seed never gives two documents the same id; block ids keep the plain seed.
export function stampDocument(html, options = {}) {
	const random = options.random || createRandom(options.seed);
	const seeded = !options.random && options.seed !== undefined && options.seed !== null && options.seed !== "";
	const docRandom = seeded ? createRandom(`${options.seed}\u0000${options.seedScope || ""}\u0000${hashText(html)}`) : random;
	const ledger = options.ledger ? normalizeLedger(options.ledger) : null;
	const timestamp = options.timestamp || nowIso();
	const metaDocId = readMetaContent(html, "vpk-doc-id");
	if (ledger && isDocId(metaDocId) && ledger.docId !== metaDocId && !options.forceDoc && !options.newDocId) {
		throw new ReviewError(`doc id mismatch: the ledger is for ${ledger.docId}, the file is ${metaDocId} (use --force-doc to override)`, 3);
	}
	const docId = options.newDocId ? createDocId(docRandom) : isDocId(metaDocId) ? metaDocId : ledger ? ledger.docId : createDocId(docRandom);
	let out = ensureDocMetas(html, { docId });
	const stamped = stampBlocks(out, { ledger, random, mint: options.mint !== false });
	out = stamped.html;
	let result = null;
	if (options.revision !== false) {
		result = stampRevision(out, { ledger, blocks: stamped.blocks, islands: stamped.islands, label: options.label, summary: options.summary, addresses: options.addresses, timestamp });
		out = result.html;
	} else if (!isRevisionId(readMetaContent(out, "vpk-doc-revision"))) {
		out = ensureDocMetas(out, { revision: ledger ? ledger.revision : "r1" });
	}
	const revision = readMetaContent(out, "vpk-doc-revision");
	const reviewable = options.reviewable === undefined ? (ledger ? ledger.reviewable : false) : options.reviewable === true;
	const next = { schema: LEDGER_SCHEMA, docId, revision, reviewable, updatedAt: timestamp, blocks: stamped.blocks, islands: stamped.islands };
	const registry = result ? result.registry : readRegistry(out).registry;
	if (registry.entries.length) next.registry = registry;
	else if (ledger && ledger.registry) next.registry = ledger.registry;
	if (ledger) {
		const before = [ledger.docId, ledger.revision, ledger.reviewable, ledger.blocks, ledger.islands || {}, ledger.registry || null];
		const after = [docId, revision, reviewable, stamped.blocks, stamped.islands, next.registry || null];
		if (JSON.stringify(before) === JSON.stringify(after)) next.updatedAt = ledger.updatedAt;
	}
	return { html: out, ledger: next, docId, revision, stats: stamped.stats, entry: result ? result.entry : null, diff: result ? result.diff : null };
}

// Lite-variant sync (ws1 4.4, ws4a C5, R21): copies the doc metas and the
// revisions, review and review-content blocks from the full file; copies
// review-data only when the lite copy already carries one; then stamps ids
// against the full file's ledger without minting (lite-only blocks stay
// unstamped). A lite file with another doc id throws ReviewError (exit 3)
// unless options.forceDoc.
export function syncLiteVariant(fullHtml, liteHtml, options = {}) {
	const docId = readMetaContent(fullHtml, "vpk-doc-id");
	if (!isDocId(docId)) throw new ReviewError("the full file has no vpk-doc-id meta; stamp it first", 2);
	const liteDocId = readMetaContent(liteHtml, "vpk-doc-id");
	if (liteDocId && liteDocId !== docId && !options.forceDoc) {
		throw new ReviewError(`doc id mismatch: the lite file is ${liteDocId}, the full file is ${docId} (use --force-doc to override)`, 3);
	}
	const revision = readMetaContent(fullHtml, "vpk-doc-revision");
	let lite = ensureDocMetas(liteHtml, { docId, revision: isRevisionId(revision) ? revision : undefined });
	for (const id of ["revisions", "review", "review-content"]) lite = setMarkedBlockText(lite, id, readMarkedBlockText(fullHtml, id));
	const liteData = readMarkedBlockText(lite, "review-data");
	const fullData = readMarkedBlockText(fullHtml, "review-data");
	if (liteData !== null && fullData !== null) lite = setMarkedBlockText(lite, "review-data", fullData);
	const stamped = stampBlocks(lite, { ledger: options.ledger ? normalizeLedger(options.ledger) : null, mint: false });
	return { html: stamped.html, stats: stamped.stats };
}
