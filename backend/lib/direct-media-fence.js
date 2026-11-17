"use strict";

const { scanJsonObject } = require("./json-object-end");

const DIRECT_MEDIA_FENCE_OPENER = /```(image|audio)\s*\n/giu;
const DIRECT_MEDIA_FENCE_OPENER_BY_KIND = {
	audio: /```(audio)\s*\n/giu,
	image: /```(image)\s*\n/giu,
};

/**
 * Where an image or audio block ends. Every reader applies this rule: the streaming splitter, the
 * stripper, the generation body, and a copy in
 * `components/projects/rovo-core/lib/rovo-app-message-display.ts` that its test compares with this one.
 *
 * 1. The block closes at the first run of three or more backticks after its opener that starts its
 *    line (spaces or tabs before it are allowed), ends its line (only spaces, tabs or a carriage
 *    return after it, up to a newline or the end of the text), or directly follows, after spaces or
 *    tabs, the end of a JSON object that opens the body.
 * 2. When the complete text has no such run for the block, it closes at the first three backticks
 *    after its opener, wherever they are, as every reader did before rule 1.
 * 3. A block with neither stays open to the end of the text.
 *
 * A block closes at its run's first three backticks. While the text may still grow (`complete`
 * false), rule 2 waits, so backticks with text on both sides of them on their line leave the block
 * open, and the end of the text counts as the end of a line: backticks there close the block until
 * more text says otherwise. The streaming controller holds both until the text decides or ends.
 */
const LINE_EDGE_FENCE = /(?<!`)```(?:(?<=(?:^|\n)[ \t]*```)|(?=`*[ \t\r]*(?:\n|$)))/gu;

/**
 * Reads the JSON object that may open a body, up to `limit`: whitespace, then the object, then the
 * spaces or tabs after it. Returns where backticks right after the object start, or -1.
 */
function findBacktickAfterBodyJson(text, bodyStart, limit) {
	let at = bodyStart;
	while (at < limit && /\s/u.test(text[at])) {
		at += 1;
	}
	if (text[at] !== "{" || at >= limit) {
		return -1;
	}
	const { end } = scanJsonObject(text, { at, depth: 0, end: -1, inString: false }, limit);
	if (end < 0) {
		return -1;
	}
	at = end;
	while (at < limit && /[ \t\r]/u.test(text[at])) {
		at += 1;
	}
	return at + 3 <= limit && text.startsWith("```", at) ? at : -1;
}

/**
 * Where the closing fence of the block whose body starts at `bodyStart` starts (-1 while it is open).
 * Work is linear in the text up to the close.
 */
function findDirectMediaFenceClose(text, bodyStart, complete) {
	LINE_EDGE_FENCE.lastIndex = bodyStart;
	const lineEdge = LINE_EDGE_FENCE.exec(text);
	const limit = lineEdge ? lineEdge.index : text.length;
	const afterJson = findBacktickAfterBodyJson(text, bodyStart, limit);
	if (afterJson >= 0 || lineEdge) {
		return afterJson >= 0 ? afterJson : limit;
	}
	return complete ? text.indexOf("```", bodyStart) : -1;
}

/**
 * The blocks that `opener` starts in `text`, in order: where each starts, its kind, where its body
 * starts and ends, and where the block ends. A block that never closes runs to the end of the text
 * (`closed` false) and is the last one. `complete` says the text will not grow.
 */
function scanDirectMediaFences(text, opener, complete) {
	const fences = [];
	if (typeof text !== "string") {
		return fences;
	}
	opener.lastIndex = 0;
	for (let match = opener.exec(text); match; match = opener.exec(text)) {
		const bodyStart = match.index + match[0].length;
		const closeStart = findDirectMediaFenceClose(text, bodyStart, complete);
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

/** The image and audio blocks in the complete `text`, in order (see `scanDirectMediaFences`). */
function findDirectMediaFences(text) {
	return scanDirectMediaFences(text, DIRECT_MEDIA_FENCE_OPENER, true);
}

/**
 * The body of the first closed block of `kind` ("image" or "audio") in the complete `text`, or null.
 * Each kind is read on its own, so the backticks that close a block of one kind may also open one of
 * the other.
 */
function findDirectMediaFenceBody(text, kind) {
	const value = String(text);
	const fence = scanDirectMediaFences(value, DIRECT_MEDIA_FENCE_OPENER_BY_KIND[kind], true)[0];
	return fence?.closed ? value.slice(fence.bodyStart, fence.bodyEnd) : null;
}

/**
 * `text` with each closed block replaced by a paragraph break, split at the first block opener in
 * the result: the visible text before it, and the open block from there to the end ("" if none).
 * Text that ends in a partial opener ("```image ") right before a closed block becomes an opener
 * with that break, and opens a block, as it always has. `complete` says the text will not grow.
 */
function removeClosedDirectMediaFences(text, complete) {
	const fences = scanDirectMediaFences(text, DIRECT_MEDIA_FENCE_OPENER, complete);
	if (!fences[0]?.closed) {
		// Nothing replaced: the first opener in the text, if any, starts the open block.
		const pendingStart = fences[0]?.start ?? text.length;
		return { pendingText: text.slice(pendingStart), visibleText: text.slice(0, pendingStart) };
	}
	let replacedText = "";
	let at = 0;
	for (const fence of fences) {
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

/**
 * `text` split into what may be shown and the open block from its opener on. `complete` says the
 * text has ended, so a block with no close under rule 1 closes under rule 2; while it may still grow,
 * that block stays open.
 */
function splitDirectMediaTextForStreaming(text, { complete = false } = {}) {
	if (typeof text !== "string" || text.length === 0) {
		return {
			pendingText: "",
			visibleText: "",
		};
	}

	const { pendingText, visibleText } = removeClosedDirectMediaFences(text, complete);
	return {
		pendingText,
		visibleText: collapseDirectMediaFenceNewlines(visibleText),
	};
}

function stripDirectMediaFences(text) {
	if (typeof text !== "string" || text.length === 0) {
		return "";
	}

	const { pendingText, visibleText } = removeClosedDirectMediaFences(text, true);
	return normalizeDirectMediaFenceWhitespace(pendingText ? `${visibleText}\n\n` : visibleText);
}

module.exports = {
	findDirectMediaFenceBody,
	findDirectMediaFences,
	splitDirectMediaTextForStreaming,
	stripDirectMediaFences,
};
