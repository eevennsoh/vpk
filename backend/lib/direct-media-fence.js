"use strict";

const { jsonObjectEnd } = require("./json-object-end");

const DIRECT_MEDIA_FENCE_OPENER = /```(image|audio)\s*\n/giu;
const DIRECT_MEDIA_FENCE_OPENER_BY_KIND = {
	audio: /```(audio)\s*\n/giu,
	image: /```(image)\s*\n/giu,
};

/**
 * A run of backticks, matched at its first three, that starts its line (after spaces or tabs) or
 * ends it (only spaces, tabs or a carriage return after it, up to a newline or the end of the text).
 * Backticks with other text on both sides of them on their line are part of the body.
 */
const LINE_EDGE_FENCE = /(?<!`)```(?:(?<=(?:^|\n)[ \t]*```)|(?=`*[ \t\r]*(?:\n|$)))/gu;

/**
 * Where the closing fence of the media block whose body starts at `bodyStart` starts (-1 while the
 * block is open): the first run of three or more backticks that starts or ends its line, or that
 * directly follows, after spaces or tabs, the end of a JSON object that opens the body. Backticks
 * inside the body's text or JSON strings do not close it. "The end of the text" counts as the end
 * of a line, so backticks at the end of streamed text are undecided until more text arrives.
 * Work is linear in the text up to the closing fence.
 */
function findDirectMediaFenceClose(text, bodyStart) {
	LINE_EDGE_FENCE.lastIndex = bodyStart;
	const lineEdge = LINE_EDGE_FENCE.exec(text);
	const lineEdgeStart = lineEdge ? lineEdge.index : -1;
	const body = text.slice(bodyStart, lineEdge ? lineEdgeStart : text.length);
	if (/^\s*\{/u.test(body)) {
		const objectEnd = jsonObjectEnd(body);
		if (objectEnd >= 0) {
			const at = objectEnd + /^[ \t\r]*/u.exec(body.slice(objectEnd))[0].length;
			if (body.startsWith("```", at)) {
				return bodyStart + at;
			}
		}
	}
	return lineEdgeStart;
}

/**
 * The blocks that `opener` starts in `text`, in order: where each starts, its kind, where its body
 * starts and ends, and where the block ends. A block that never closes runs to the end of the text
 * (`closed` false) and is the last one.
 */
function scanDirectMediaFences(text, opener) {
	const fences = [];
	if (typeof text !== "string") {
		return fences;
	}
	opener.lastIndex = 0;
	for (let match = opener.exec(text); match; match = opener.exec(text)) {
		const bodyStart = match.index + match[0].length;
		const closeStart = findDirectMediaFenceClose(text, bodyStart);
		const closed = closeStart >= 0;
		fences.push({
			bodyEnd: closed ? closeStart : text.length,
			bodyStart,
			closed,
			end: closed ? closeStart + 3 : text.length,
			kind: match[1].toLowerCase(),
			start: match.index,
		});
		if (!closed) {
			break;
		}
		opener.lastIndex = closeStart + 3;
	}
	return fences;
}

/** The image and audio blocks in `text`, in order (see `scanDirectMediaFences`). */
function findDirectMediaFences(text) {
	return scanDirectMediaFences(text, DIRECT_MEDIA_FENCE_OPENER);
}

/**
 * The body of the first closed block of `kind` ("image" or "audio") in `text`, or null. Each kind is
 * read on its own, so the backticks that close a block of one kind may also open one of the other.
 */
function findDirectMediaFenceBody(text, kind) {
	const value = String(text);
	const fence = scanDirectMediaFences(value, DIRECT_MEDIA_FENCE_OPENER_BY_KIND[kind])[0];
	return fence?.closed ? value.slice(fence.bodyStart, fence.bodyEnd) : null;
}

/**
 * `text` with each closed block replaced by a paragraph break, split at the first block opener in
 * the result: the visible text before it, and the open block from there to the end ("" if none).
 * Text that ends in a partial opener ("```image ") right before a closed block becomes an opener
 * with that break, and opens a block, as it always has.
 */
function removeClosedDirectMediaFences(text) {
	let replacedText = "";
	let at = 0;
	for (const fence of findDirectMediaFences(text)) {
		replacedText += text.slice(at, fence.start);
		if (!fence.closed) {
			at = fence.start;
			break;
		}
		replacedText += "\n\n";
		at = fence.end;
	}
	replacedText += text.slice(at);
	DIRECT_MEDIA_FENCE_OPENER.lastIndex = 0;
	const pendingStart = DIRECT_MEDIA_FENCE_OPENER.exec(replacedText)?.index ?? replacedText.length;
	return { pendingText: replacedText.slice(pendingStart), visibleText: replacedText.slice(0, pendingStart) };
}

function normalizeDirectMediaFenceWhitespace(text) {
	return text
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function collapseDirectMediaFenceNewlines(text) {
	return text.replace(/\n{3,}/g, "\n\n");
}

function splitDirectMediaTextForStreaming(text) {
	if (typeof text !== "string" || text.length === 0) {
		return {
			pendingText: "",
			visibleText: "",
		};
	}

	const { pendingText, visibleText } = removeClosedDirectMediaFences(text);
	return {
		pendingText,
		visibleText: collapseDirectMediaFenceNewlines(visibleText),
	};
}

function stripDirectMediaFences(text) {
	if (typeof text !== "string" || text.length === 0) {
		return "";
	}

	const { pendingText, visibleText } = removeClosedDirectMediaFences(text);
	return normalizeDirectMediaFenceWhitespace(pendingText ? `${visibleText}\n\n` : visibleText);
}

module.exports = {
	findDirectMediaFenceBody,
	findDirectMediaFences,
	splitDirectMediaTextForStreaming,
	stripDirectMediaFences,
};
