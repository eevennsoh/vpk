/*
 * review/markup: pure string operations on review blocks, metas and islands,
 * shared by Save reviewed copy (runtime) and the CLI (ws1 4.2, 4.6).
 *
 * Serialized module: the source never contains HTML-structural text. Every
 * marker and tag is assembled from String.fromCharCode inside reviewMarkers(),
 * so the emitted runtime cannot match REVIEW_RUNTIME_FORBIDDEN and no HTML
 * parser can end a script early. Markers equal ws0 markerPair(id).
 *
 * Block placement (insertion rule, ws1 4.2): `review-content` goes before the
 * head end tag; `revisions`, `review-data` and `review` sit at body end in that
 * order, immediately before the vpkh-enhance block when present, otherwise
 * before the last body end tag. (Comments here avoid literal tags too, so a
 * raw-source scan agrees with the minified runtime scan.)
 */

import { findJsonIslands, parseJsonIsland, serializeJsonIsland } from "../json-island.mjs";

export function reviewMarkers() {
	const ch = String.fromCharCode;
	const lt = ch(60);
	const gt = ch(62);
	const pair = (id) => ({ start: lt + "!-- vpk-" + id + ":start --" + gt, end: lt + "!-- vpk-" + id + ":end --" + gt });
	const island = (attr) => lt + "script type=\"application/json\" " + attr + gt;
	return {
		review: pair("review"),
		reviewData: pair("review-data"),
		revisions: pair("revisions"),
		reviewContent: pair("review-content"),
		blocks: { review: pair("review"), "review-data": pair("review-data"), revisions: pair("revisions"), "review-content": pair("review-content") },
		bodyOrder: ["revisions", "review-data", "review"],
		enhanceBegin: lt + "!-- vpkh-enhance:begin --" + gt,
		headEnd: lt + "/head" + gt,
		bodyEnd: lt + "/body" + gt,
		htmlEnd: lt + "/html" + gt,
		scriptClose: lt + "/script" + gt,
		metaOpen: lt + "meta",
		reviewIslandOpen: island("data-vpk-review"),
		revisionsIslandOpen: island("data-vpk-revisions"),
	};
}

// Offsets { start, end } of the start and end markers of block `id`: the first
// end marker with a start marker before it, paired with the nearest such start.
// A stray start marker earlier in the file (or a marker-looking string) never
// swallows the bytes between it and the real block. null when absent.
export function findMarkedBlock(html, id) {
	const pair = reviewMarkers().blocks[id];
	if (!pair) throw new TypeError("findMarkedBlock: unknown block " + String(id));
	const source = String(html);
	for (let end = source.indexOf(pair.end); end >= 0; end = source.indexOf(pair.end, end + 1)) {
		const start = end - pair.start.length < 0 ? -1 : source.lastIndexOf(pair.start, end - pair.start.length);
		if (start >= 0) return { start, end };
	}
	return null;
}

// The inner text of a marked block (between the markers, without the padding
// newlines setMarkedBlockText writes), or null when the block is absent.
export function readMarkedBlockText(html, id) {
	const pair = reviewMarkers().blocks[id];
	const found = findMarkedBlock(html, id);
	if (!found) return null;
	let inner = String(html).slice(found.start + pair.start.length, found.end);
	if (inner.startsWith("\n")) inner = inner.slice(1);
	if (inner.endsWith("\n")) inner = inner.slice(0, -1);
	return inner;
}

// Upserts block `id` with `inner` (null removes it plus one trailing newline).
// In place when present, otherwise at its placement position; bytes outside the
// block never change, and an identical inner text returns identical bytes.
export function setMarkedBlockText(html, id, inner) {
	const markers = reviewMarkers();
	const pair = markers.blocks[id];
	if (!pair) throw new TypeError("setMarkedBlockText: unknown block " + String(id));
	const source = String(html);
	const found = findMarkedBlock(source, id);
	const [start, end] = found ? [found.start, found.end] : [-1, -1];
	if (inner === null || inner === undefined) {
		if (start < 0 || end < 0) return source;
		let stop = end + pair.end.length;
		if (source[stop] === "\n") stop++;
		return source.slice(0, start) + source.slice(stop);
	}
	const block = pair.start + "\n" + inner + "\n" + pair.end;
	if (start >= 0 && end >= 0) return source.slice(0, start) + block + source.slice(end + pair.end.length);
	const insertAt = (index) => source.slice(0, index) + block + "\n" + source.slice(index);
	if (id === "review-content") {
		const headEnd = source.toLowerCase().indexOf(markers.headEnd);
		if (headEnd < 0) throw new Error("missing " + "head end tag");
		return insertAt(headEnd);
	}
	const later = markers.bodyOrder.slice(markers.bodyOrder.indexOf(id) + 1);
	for (const next of later) {
		const nextStart = source.indexOf(markers.blocks[next].start);
		if (nextStart >= 0) return insertAt(nextStart);
	}
	const enhance = source.indexOf(markers.enhanceBegin);
	if (enhance >= 0) return insertAt(enhance);
	const lower = source.toLowerCase();
	const bodyEnd = lower.lastIndexOf(markers.bodyEnd);
	if (bodyEnd >= 0) return insertAt(bodyEnd);
	const htmlEnd = lower.lastIndexOf(markers.htmlEnd);
	if (htmlEnd >= 0) return insertAt(htmlEnd);
	return source + (source.endsWith("\n") || source.length === 0 ? "" : "\n") + block + "\n";
}

// Embeds (or with null removes) the vpk-review/1 island in the review-data block.
export function setEmbeddedReviewText(html, review) {
	const markers = reviewMarkers();
	if (review === null || review === undefined) return setMarkedBlockText(html, "review-data", null);
	return setMarkedBlockText(html, "review-data", markers.reviewIslandOpen + serializeJsonIsland(review) + markers.scriptClose);
}

// Writes (or with null removes) the vpk-revisions/1 registry in the revisions block.
export function setRegistryText(html, registry) {
	const markers = reviewMarkers();
	if (registry === null || registry === undefined) return setMarkedBlockText(html, "revisions", null);
	return setMarkedBlockText(html, "revisions", markers.revisionsIslandOpen + serializeJsonIsland(registry) + markers.scriptClose);
}

// The content attribute of the first meta whose name equals `name`, or null.
export function readMetaContent(html, name) {
	const markers = reviewMarkers();
	const tag = new RegExp(markers.metaOpen + "\\b((?:[^\"'>]|\"[^\"]*\"|'[^']*')*)" + String.fromCharCode(62), "gi");
	const attr = (attrs, wanted) => {
		const pattern = new RegExp("(?:^|\\s)" + wanted + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=`]+))", "i");
		const match = pattern.exec(attrs);
		return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
	};
	let match = tag.exec(String(html));
	while (match !== null) {
		if (attr(match[1], "name") === name) return attr(match[1], "content");
		match = tag.exec(String(html));
	}
	return null;
}

// Finds the JSON island whose script carries exactly `attrName` (default
// data-vpk-review; never data-vpk-review-runtime, other prefixed names or the
// name inside another attribute's value). The scan is ws6 findJsonIslands
// (C15); this adds the preference for the island inside its own marker block.
// Returns { text, start, end } (offsets of the JSON text) or null.
export function findReviewIsland(html, attrName = "data-vpk-review") {
	const source = String(html);
	const blockId = attrName === "data-vpk-revisions" ? "revisions" : attrName === "data-vpk-review" ? "review-data" : null;
	const block = blockId ? findMarkedBlock(source, blockId) : null;
	const islands = findJsonIslands(source, attrName);
	const inside = block ? islands.find((island) => island.start >= block.start && island.contentEnd <= block.end) : null;
	const found = inside || islands[0];
	return found ? { text: found.raw, start: found.contentStart, end: found.contentEnd } : null;
}

// The parsed value of findReviewIsland(html, attrName), or null when absent.
// Invalid JSON throws "invalid JSON island: ..." (ws6 parseJsonIsland).
export function readIslandJson(html, attrName = "data-vpk-review") {
	const found = findReviewIsland(html, attrName);
	return found ? parseJsonIsland(found.text) : null;
}
