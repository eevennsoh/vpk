/*
 * review/text: text normalization, hashing and similarity shared by the Node
 * stamper/CLI and the in-page review runtime (ws1 sections 4.4-4.5).
 *
 * Serialized module (ws1 4.6): the top level holds only export function
 * declarations, there is no module-level state, and the source is plain ASCII
 * without HTML-structural text, so review/inject.mjs can ship every function
 * inside a document. Node and the browser run the exact same code, which keeps
 * block hashes and the text index equal on both sides (S14, T-AN10).
 */

export function normalizeWhitespace(value) {
	return String(value ?? "").replace(/\s+/g, " ").trim();
}

// Folds case, curly quotes, dashes, soft hyphens and zero-width characters, and
// collapses whitespace. `map[i]` is the source offset of folded character i, so
// a match in folded text maps back to source offsets (anchor resolution step 3).
// With keepEdges, leading and trailing spaces survive (quote prefix/suffix context).
// Identifiers here avoid tag names: whitespace minification prints `i < x` as
// `i<x`, and a name like `source` would then read as a tag to validators.
export function foldTextMap(value, keepEdges = false) {
	const chars = String(value ?? "");
	let text = "";
	const map = [];
	let lastSpace = !keepEdges;
	for (let index = 0; index < chars.length; index++) {
		const code = chars.charCodeAt(index);
		if (code === 0xad || (code >= 0x200b && code <= 0x200d) || code === 0x2060 || code === 0xfeff) continue;
		let char = chars[index];
		if (code === 32 || (code >= 9 && code <= 13) || (code > 127 && /\s/.test(char))) {
			if (lastSpace) continue;
			text += " ";
			map.push(index);
			lastSpace = true;
			continue;
		}
		if (code === 0x2018 || code === 0x2019 || code === 0x201a || code === 0x201b || code === 0x2032 || code === 0x02bc) char = "'";
		else if (code === 0x201c || code === 0x201d || code === 0x201e || code === 0x201f || code === 0x2033 || code === 0x00ab || code === 0x00bb) char = "\"";
		else if ((code >= 0x2010 && code <= 0x2015) || code === 0x2212 || code === 0xfe58 || code === 0xfe63 || code === 0xff0d) char = "-";
		else if (code === 0x2026) char = "...";
		const lower = char.toLowerCase();
		for (let part = 0; part < lower.length; part++) {
			text += lower[part];
			map.push(index);
		}
		lastSpace = false;
	}
	while (!keepEdges && text.endsWith(" ")) {
		text = text.slice(0, -1);
		map.pop();
	}
	return { text, map };
}

export function foldForMatch(value) {
	return foldTextMap(value).text;
}

// 32-bit FNV-1a over UTF-16 code units (unsigned).
export function fnv1a32(value) {
	const text = String(value ?? "");
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

// Content hash used by the ledger, anchors and resolution: base36 of fnv1a32 over
// whitespace-normalized text, zero-padded to 7 characters.
export function hashText(value) {
	return fnv1a32(normalizeWhitespace(value)).toString(36).padStart(7, "0");
}

// Word bigrams over folded text; a single word yields itself so short headings compare.
export function wordBigrams(value) {
	const words = foldForMatch(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
	if (words.length < 2) return words;
	const grams = [];
	for (let index = 0; index < words.length - 1; index++) grams.push(words[index] + " " + words[index + 1]);
	return grams;
}

// Sorensen-Dice coefficient over word-bigram multisets, in [0, 1]. Either argument
// may be text or a precomputed wordBigrams() array.
export function diceSimilarity(left, right) {
	const a = Array.isArray(left) ? left : wordBigrams(left);
	const b = Array.isArray(right) ? right : wordBigrams(right);
	if (a.length === 0 || b.length === 0) return a.length === b.length ? 1 : 0;
	const counts = new Map();
	for (const gram of a) counts.set(gram, (counts.get(gram) || 0) + 1);
	let shared = 0;
	for (const gram of b) {
		const count = counts.get(gram) || 0;
		if (count > 0) {
			shared++;
			counts.set(gram, count - 1);
		}
	}
	return (2 * shared) / (a.length + b.length);
}

// Whitespace-normalized text cut to `max` characters, preferring a word boundary,
// with a trailing ellipsis when cut. The result never exceeds `max`.
export function excerpt(value, max = 120) {
	const text = normalizeWhitespace(value);
	const limit = Math.max(1, Math.floor(max));
	if (text.length <= limit) return text;
	const ellipsis = String.fromCharCode(8230);
	let cut = text.slice(0, limit - 1);
	const space = cut.lastIndexOf(" ");
	if (space >= Math.floor(limit * 0.6)) cut = cut.slice(0, space);
	return cut.replace(/\s+$/, "") + ellipsis;
}

// Makes C0/C1 control characters (except tab and newline) and bidi controls
// visible as [U+XXXX], so reviewer text cannot reorder or hide agent-facing lines.
export function escapeUnsafeChars(value) {
	const text = String(value ?? "");
	let out = "";
	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index);
		const control = (code < 0x20 && code !== 0x09 && code !== 0x0a) || (code >= 0x7f && code <= 0x9f);
		const bidi = code === 0x061c || code === 0x200e || code === 0x200f || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
		out += control || bidi ? "[U+" + code.toString(16).toUpperCase().padStart(4, "0") + "]" : text[index];
	}
	return out;
}

// Deterministic PRNG (returns floats in [0, 1)); used with --seed for stable ids.
export function mulberry32(seed) {
	let state = seed >>> 0;
	return function next() {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}
