"use strict";

const { jsonObjectEnd } = require("../lib/json-object-end");

/**
 * The break that starts a new paragraph after `text`: none when nothing visible came before it or
 * it already ends a paragraph. A caller that keeps only the end of the text says whether anything
 * visible came before.
 */
function paragraphSeparatorAfter(text, hasVisibleText = text.trim().length > 0) {
	if (!hasVisibleText || text.endsWith("\n\n")) {
		return "";
	}
	return text.endsWith("\n") ? "\n" : "\n\n";
}

/** Whole blank lines at the start of `text`; the first line with text keeps its indentation. */
const LEADING_BLANK_LINES = /^(?:[ \t]*\r?\n)+/u;

/**
 * An end of shown text that the next delta may turn into the opener of a fence the splitters hide:
 * one to three backticks, or three and the start of `spec`, or of `image` or `audio` up to the
 * newline that opens a media fence. Matched case-insensitively, as the splitters match openers.
 */
const PARTIAL_HIDDEN_FENCE_OPENER = /`{1,3}$|```(?:s|sp|spe|i|im|ima|imag|a|au|aud|audi|(?:image|audio)[^\S\n]*)$/iu;

/** An end of shown text that a paragraph break after it turns into a media fence's opener. */
const PARTIAL_MEDIA_OPENER_END = /```(?:image|audio)[^\S\n]*$/iu;

/** The start of a fence the splitters hide, as their pending patterns read an opener. */
const HIDDEN_FENCE_OPENER_START = /^```(?:spec(?=[^\S\n]*(?:\n|$))|(?:image|audio)\s*\n)/iu;

/**
 * The run of three or more backticks at the end of `text`, however long, and what follows it on its
 * line so far: only whitespace other than a newline ("spaces", as the media rule reads a line), the
 * start of a spec opener ("spec"), or nothing ("run"). Inside a media fence the next text decides
 * whether the run closes the fence (a newline after it) or not (other text after it, or a spec opener
 * that leaves the fence open, as spec fences are split first). Once the text has ended (`ended`),
 * spaces after the run no longer count: only a spec opener's start, or nothing, may follow it. Returns
 * where the run ends and where the backticks and spaces just before it start (`regionStart`): without
 * the run they would end the text and read as a close there. Null when there is none. Read from the
 * end of the text, so the work is the tail's length.
 */
function mediaFenceEndTail(text, { ended }) {
	const tailBefore = (end, kind) => {
		let start = end;
		while (start > 0 && text[start - 1] === "`") {
			start -= 1;
		}
		if (end - start < 3) {
			return null;
		}
		while (start > 0 && /`|[^\S\n]/u.test(text[start - 1])) {
			start -= 1;
		}
		return { kind, regionStart: start, runEnd: end };
	};
	let specEnd = text.length;
	while (specEnd > 0 && /[^\S\n]/u.test(text[specEnd - 1])) {
		specEnd -= 1;
	}
	for (const partial of ["spec", "spe", "sp", "s"]) {
		const start = specEnd - partial.length;
		const tail = (partial === "spec" || specEnd === text.length) && text.slice(start, specEnd).toLowerCase() === partial ? tailBefore(start, "spec") : null;
		if (tail) {
			return tail;
		}
	}
	if (ended && specEnd < text.length) {
		return null;
	}
	let spacesStart = text.length;
	while (!ended && spacesStart > 0 && /[^\S\n]/u.test(text[spacesStart - 1])) {
		spacesStart -= 1;
	}
	return spacesStart < text.length ? tailBefore(spacesStart, "spaces") : tailBefore(text.length, "run");
}

/**
 * Whether `text` opens a hidden fence, or is all a partial opener of one. A longer run of backticks
 * counts by its last three, as the splitters find an opener inside it.
 */
const isHiddenOpenerStart = (text) => {
	const opener = text.replace(/^`+(?=```)/u, "");
	return HIDDEN_FENCE_OPENER_START.test(opener) || opener.match(PARTIAL_HIDDEN_FENCE_OPENER)?.[0] === opener;
};

const firstLine = (text) => text.split("\n", 1)[0];
const lastLine = (text) => text.slice(text.lastIndexOf("\n") + 1);

/**
 * Where, in a patch line, backticks start right after its whole JSON object ends (`line.length`
 * when none do): a fence opener that follows the patch on its line, after JSON whitespace. Backticks
 * inside a JSON string leave the object unfinished, so they stay part of the patch. Work is linear
 * in the line: one scan and at most one parse.
 */
function backticksAfterJsonObject(line) {
	const end = jsonObjectEnd(line);
	const at = end < 0 ? -1 : end + /^[ \t\r]*/u.exec(line.slice(end))[0].length;
	if (at < 0 || !line.startsWith("```", at)) {
		return line.length;
	}
	try {
		JSON.parse(line.slice(0, at));
		return at;
	} catch {
		return line.length;
	}
}

/** Whether `raw`, past its leading newlines, opens with a fence that its split `visible` hides. */
function startsWithHiddenFence(raw, visible) {
	const rawRest = raw.replace(/^\n+/u, "");
	const head = firstLine(visible.replace(/^\n+/u, ""));
	return rawRest.startsWith("```") && (!head || !rawRest.startsWith(head));
}

/** Whether `raw`, before its trailing newlines, closes a fence that its split `visible` hides. */
function endsWithHiddenFence(raw, visible) {
	const rawRest = raw.replace(/\n+$/u, "");
	const tail = lastLine(visible.replace(/\n+$/u, ""));
	return rawRest.endsWith("```") && (!tail || !rawRest.endsWith(tail));
}

function createRovoTextOutputController({
	classifierJsonBufferMaxChars = 0,
	isClassifierIntentLeakCandidate = () => false,
	parseClassifierIntentPayload = () => null,
	shouldDeferToolFirstText = false,
	splitDirectMediaTextForStreaming = (text) => ({
		pendingText: "",
		visibleText: text,
	}),
	splitSpecFenceTextForStreaming = (text) => ({
		pendingText: "",
		visibleText: text,
	}),
	stripToolFirstFailureNarrative = (text) => ({
		replaced: false,
		text,
	}),
	suppressStreamingTextForCardFirstGenui = false,
	textId,
	toolFirstFailureNarrativeEnabled = false,
	writer,
} = {}) {
	let textStarted = false;
	let assistantText = "";
	let unsuppressedAssistantText = "";
	// Text held because it may be a classifier payload; none of it has reached the splitters yet.
	let bufferedAssistantText = "";
	// The end of the turn's text the splitters let through none of yet, because it may still change
	// how the text after it splits: an open spec or media fence, or a media fence whose closing
	// backticks the text so far leaves undecided ("fence"), a partial patch line ("patch"), or an
	// end that may still open a hidden fence ("opener"). The next text is split after it; everything
	// before it was split and went out, so work per delta stays bounded by it.
	let heldText = "";
	let heldKind = "";
	// How much of a held patch line came with the delta that started it, and whether the text being
	// split continues that line. Each delta split alone dropped that start whole, backticks included.
	let patchStartLength = 0;
	let continuesHeldPatch = false;
	// The newlines that end the text the splitters let through, and whether a hidden fence stands
	// just before them. A fence's paragraph break joins them as it would in one chunk.
	let streamedNewlineRun = 0;
	let streamedEndsAtFence = false;
	let deferredToolFirstText = "";
	let hasSuppressedLargeAssistantJson = false;
	// Set after a notice paragraph; the next text starts a new paragraph.
	let paragraphBreakPending = false;
	// Set when a rerun keeps the text already shown; its first shown text starts a new paragraph.
	// The break goes on the wire only: the rerun's own text is what the turn hands on.
	let shownParagraphBreakPending = false;
	// Whether any visible (non-whitespace) text has gone on the wire, and the last two characters
	// written. Together they tell where the next paragraph starts.
	let hasShownVisibleText = false;
	let shownTextEnd = "";
	// The rerun's leading whitespace, held until its first visible text decides the break.
	let heldWhitespace = "";
	// Where the end of the turn's text that ending the held text kept off the wire (an open fence, a
	// partial patch line, a classifier payload) starts, in each stored text; null when nothing is. A
	// notice drops that end; text let through after it makes it part of the middle, and it stays.
	let withheldStart = null;
	// A failure notice ends card-first suppression: the text goes out, then the notice.
	let suppressingStreamingText = suppressStreamingTextForCardFirstGenui;

	const afterPendingParagraphBreak = (delta) => {
		if (!paragraphBreakPending) {
			return delta;
		}
		paragraphBreakPending = false;
		return delta.startsWith("\n") ? delta : `\n\n${delta}`;
	};

	const startTextIfNeeded = () => {
		if (textStarted) {
			return;
		}

		writer.write({ type: "text-start", id: textId });
		textStarted = true;
	};

	const writeShownTextDelta = (nextDelta) => {
		let delta = nextDelta;
		if (shownParagraphBreakPending) {
			if (nextDelta.trim().length === 0) {
				heldWhitespace += nextDelta;
				return;
			}
			// The rerun's leading blank lines are part of the break, not added on top of it.
			shownParagraphBreakPending = false;
			delta = `${paragraphSeparatorAfter(shownTextEnd, hasShownVisibleText)}${`${heldWhitespace}${nextDelta}`.replace(LEADING_BLANK_LINES, "")}`;
			heldWhitespace = "";
		}
		if (delta.trim().length > 0) {
			hasShownVisibleText = true;
		}
		shownTextEnd = `${shownTextEnd}${delta}`.slice(-2);
		startTextIfNeeded();
		writer.write({ type: "text-delta", id: textId, delta });
	};

	const emitTextDeltaRaw = (delta) => {
		if (!delta) {
			return;
		}

		if (shouldDeferToolFirstText) {
			deferredToolFirstText += delta;
			return;
		}
		if (suppressingStreamingText) {
			return;
		}

		writeShownTextDelta(delta);
	};

	/**
	 * Held text split into what may be shown and what an open spec or media fence, or a partial patch
	 * line, still holds back. `holdsFence` says an open fence is among what is held back,
	 * `holdsMediaFence` that only an open media fence is. `complete` says the text has ended, so a
	 * media fence the media rule leaves undecided closes (see `backend/lib/direct-media-fence.js`).
	 */
	const splitHeldAssistantText = (text, complete = false) => {
		const spec = splitSpecFenceTextForStreaming(text);
		const media = splitDirectMediaTextForStreaming(spec.visibleText, { complete });
		return {
			holdsFence: Boolean(media.pendingText) || spec.pendingText.startsWith("```"),
			holdsMediaFence: Boolean(media.pendingText) && !spec.pendingText,
			pendingText: `${media.pendingText}${spec.pendingText}`,
			visibleText: media.visibleText,
		};
	};

	/**
	 * Where, in `heldText` as it was stored, the part `split` holds back starts (`heldText.length` when
	 * nothing is). The splitters rewrite text (completed fences, runs of blank lines), so the held-back
	 * text is not matched against the stored end: it starts where its first line occurs and the text
	 * from there, split on its own, is all held back and reads the same.
	 */
	const findWithheldOffset = (heldText, { pendingText, visibleText }, complete) => {
		if (!pendingText) {
			return heldText.length;
		}
		if (!visibleText) {
			return 0;
		}
		const firstLine = pendingText.split("\n", 1)[0];
		let offset = firstLine ? heldText.lastIndexOf(firstLine) : -1;
		while (offset >= 0) {
			const tail = splitHeldAssistantText(heldText.slice(offset), complete);
			if (!tail.visibleText && tail.pendingText === pendingText) {
				return offset;
			}
			offset = offset > 0 ? heldText.lastIndexOf(firstLine, offset - 1) : -1;
		}
		// Not found in the stored text: keep it there rather than cut text that may have gone out.
		return heldText.length;
	};

	/**
	 * Records the end of the turn's text that `heldText`, the stored text's end, leaves unreleased:
	 * from `offset` on. When none of `heldText` was let through, that end continues the earlier one.
	 */
	const recordWithheldEnd = (heldText, offset) => {
		if (offset >= heldText.length) {
			withheldStart = null;
			return;
		}
		if (offset === 0 && withheldStart) {
			return;
		}
		const withheldLength = heldText.length - offset;
		withheldStart = {
			assistant: assistantText.length - withheldLength,
			unsuppressed: unsuppressedAssistantText.length - withheldLength,
		};
	};

	/**
	 * Drops the end of the text the turn hands on that never reached the wire. A start outside a text
	 * (it was replaced after the cut-off) cuts nothing from it.
	 */
	const dropWithheldEnd = () => {
		const cutAt = (value, start) => (start >= 0 && start <= value.length ? value.slice(0, start) : value);
		if (withheldStart) {
			assistantText = cutAt(assistantText, withheldStart.assistant);
			unsuppressedAssistantText = cutAt(unsuppressedAssistantText, withheldStart.unsuppressed);
			withheldStart = null;
		}
	};

	/** Drops whitespace a rerun held at the wire from the end of the text the turn hands on. */
	const dropHeldWhitespace = () => {
		const cut = (value) => (heldWhitespace && value.endsWith(heldWhitespace) ? value.slice(0, -heldWhitespace.length) : value);
		assistantText = cut(assistantText);
		unsuppressedAssistantText = cut(unsuppressedAssistantText);
		heldWhitespace = "";
	};

	/**
	 * Writes text the splitters let through. Text after a hidden fence that stands in for it with a
	 * paragraph break, or before one, joins its newlines to those already written, as one chunk's
	 * run collapses to two. Any other text goes out exactly as split, as when each delta was split
	 * on its own.
	 */
	const writeSplitText = (visibleText, { atFenceStart, atFenceEnd }) => {
		if (!visibleText) {
			return;
		}
		let delta = visibleText;
		if (atFenceStart || streamedEndsAtFence) {
			const leadingNewlines = delta.length - delta.replace(/^\n+/u, "").length;
			if (streamedNewlineRun + leadingNewlines >= 3) {
				delta = `${"\n".repeat(Math.max(0, 2 - streamedNewlineRun))}${delta.slice(leadingNewlines)}`;
			}
		}
		const withoutTrailingNewlines = delta.replace(/\n+$/u, "");
		if (withoutTrailingNewlines) {
			streamedNewlineRun = delta.length - withoutTrailingNewlines.length;
			streamedEndsAtFence = atFenceEnd;
		} else {
			streamedNewlineRun += delta.length;
			streamedEndsAtFence = streamedEndsAtFence || atFenceEnd;
		}
		emitTextDeltaRaw(delta);
	};

	/**
	 * The text to split next: the held end, then `text`. Held backticks that `text` does not make the
	 * start of a hidden fence (or leave a partial opener) go out as written and `text` is split on its
	 * own, so they change nothing the splitters hide in it, as when each delta was split alone. A held
	 * patch line that `text` continues stays held until its line ends, and is then dropped with the
	 * rest of its line, up to backticks right after its JSON object that came after the line's first
	 * delta or open a hidden fence, which are split as the start of a fence; one that `text` turns into
	 * an ordinary line is dropped and `text` split on its own, as when each delta was.
	 */
	const continueHeldText = (text) => {
		if (heldKind === "opener") {
			const joined = `${heldText}${text}`;
			if (isHiddenOpenerStart(joined)) {
				return joined;
			}
			writeSplitText(heldText, { atFenceEnd: false, atFenceStart: false });
			return text;
		}
		if (heldKind !== "patch") {
			return `${heldText}${text}`;
		}
		const lineEnd = text.indexOf("\n");
		const line = `${heldText}${lineEnd >= 0 ? text.slice(0, lineEnd) : text}`;
		const jsonFenceStart = backticksAfterJsonObject(line);
		// Backticks that came with the line's start were dropped with it, unless they open a hidden fence.
		const opensHiddenFence = HIDDEN_FENCE_OPENER_START.test(`${line.slice(jsonFenceStart)}${lineEnd >= 0 ? text.slice(lineEnd) : ""}`);
		const fenceStart = jsonFenceStart >= patchStartLength || opensHiddenFence ? jsonFenceStart : line.length;
		const patchLine = line.slice(0, fenceStart);
		if (splitSpecFenceTextForStreaming(patchLine).pendingText !== patchLine) {
			return text;
		}
		if (lineEnd < 0 && fenceStart === line.length) {
			continuesHeldPatch = true;
			return line;
		}
		return `${line.slice(fenceStart)}${lineEnd >= 0 ? text.slice(lineEnd) : ""}`;
	};

	/**
	 * Splits `text` (the held end and the text after it) and writes what it lets through. Unless
	 * `final`, the end that may still open a hidden fence stays held as well. `ended` (implied by
	 * `final`) says the text will not grow, as at a rerun reset: the media rule closes what it left
	 * undecided, and only an end that may still open a hidden fence stays held. Returns where, in
	 * `text`, the end the splitters hold back starts (`text.length` when none is).
	 */
	const splitAndWriteText = (text, { final, ended = final }) => {
		let split = splitHeldAssistantText(text, ended);
		let splitText = text;
		// Backticks at the end that would close a media fence may be undecided: what follows them on
		// their line decides whether they end it, and spec fences are split first, so they may still
		// open a spec fence that leaves the media fence open. When text glued to the run would keep
		// the fence open, the whole run is undecided, with the backticks and whitespace on its line just
		// before it, which without it would end the text and close the fence there; they stay held with
		// the fence. Otherwise the run starts its line or follows the body's JSON object, and closes the
		// fence whatever follows except a spec opener: its last three backticks and a spec opener's
		// start after them stay held, and whitespace after them goes out, as before.
		const tail = final || split.pendingText ? null : mediaFenceEndTail(text, { ended });
		const heldTailStart = !tail
			? -1
			: !ended && splitHeldAssistantText(`${text}x`).holdsMediaFence
				? tail.regionStart
				: tail.kind === "spaces"
					? -1
					: tail.runEnd - 3;
		if (heldTailStart >= 0) {
			const head = text.slice(0, heldTailStart);
			const headSplit = splitHeldAssistantText(head, ended);
			if (headSplit.holdsMediaFence) {
				split = headSplit;
				splitText = head;
			}
		}
		let offset = findWithheldOffset(splitText, split, ended);
		// A partial media opener ("```image ") right before a media fence the text has not decided
		// becomes an opener once the fence closes (`removeClosedDirectMediaFences`), as it did when that
		// fence closed at once: it stays held with the fence until the fence closes or the text ends.
		const openerBeforeFence = !ended && split.holdsMediaFence ? (split.visibleText.match(PARTIAL_MEDIA_OPENER_END)?.[0] ?? "") : "";
		if (
			openerBeforeFence &&
			splitText.slice(offset - openerBeforeFence.length, offset) === openerBeforeFence &&
			splitHeldAssistantText(splitText, true).pendingText !== split.pendingText
		) {
			offset -= openerBeforeFence.length;
			split = { ...split, visibleText: split.visibleText.slice(0, -openerBeforeFence.length) };
		}
		const opener = final || split.pendingText ? "" : (split.visibleText.match(PARTIAL_HIDDEN_FENCE_OPENER)?.[0] ?? "");
		writeSplitText(split.visibleText.slice(0, split.visibleText.length - opener.length), {
			atFenceStart: startsWithHiddenFence(text, split.visibleText),
			atFenceEnd: !split.pendingText && endsWithHiddenFence(text, split.visibleText),
		});
		if (final) {
			heldText = "";
			heldKind = "";
		} else if (offset < text.length) {
			// What the splitters hold back decides the kind: held text that opens with a patch line the
			// splitters dropped may still end in an open fence.
			heldText = text.slice(offset);
			heldKind = split.holdsFence ? "fence" : "patch";
			if (!continuesHeldPatch) {
				patchStartLength = heldText.length;
			}
		} else {
			heldText = opener;
			heldKind = opener ? "opener" : "";
		}
		continuesHeldPatch = false;
		return offset;
	};

	/** Splits `text` after the held end and writes what may go out now. */
	const releaseText = (text) => {
		const nextText = continueHeldText(text);
		splitAndWriteText(nextText, { final: false });
		// Text let through after an end held back earlier puts that end in the middle of the turn's text.
		if (heldText.length < nextText.length) {
			withheldStart = null;
		}
	};

	/**
	 * Ends the held text and `text` after it: everything visible goes out, and the end the splitters
	 * hold back, then `withheldText` (the stored text after it that never reaches the wire), is
	 * recorded as withheld.
	 */
	const finishText = (text, withheldText = "") => {
		const nextText = continueHeldText(text);
		const offset = splitAndWriteText(nextText, { final: true });
		if (nextText || withheldText) {
			recordWithheldEnd(`${nextText}${withheldText}`, offset);
		}
	};

	/**
	 * Ends all held text: what may be shown goes out; an open fence and a held classifier payload
	 * that parses stay off the wire. Returns that payload, or null.
	 */
	const finishHeldText = () => {
		const classifierPayload = bufferedAssistantText ? parseClassifierIntentPayload(bufferedAssistantText) : null;
		const text = bufferedAssistantText;
		bufferedAssistantText = "";
		finishText(classifierPayload ? "" : text, classifierPayload ? text : "");
		return classifierPayload;
	};

	/**
	 * Ends the held text before a notice: what the user was meant to see goes out, and what never
	 * reached the wire at the end of the turn's text (an open fence, a classifier payload, a rerun's
	 * held whitespace) is dropped from it too, so the notice never lands inside it.
	 */
	const releaseHeldTextBeforeNotice = () => {
		finishHeldText();
		dropWithheldEnd();
		// The whitespace a rerun held at the wire comes after anything the rerun cut off.
		dropHeldWhitespace();
	};

	/** End of stream: returns a held classifier payload that parses, or ends the held text. */
	const finalizeBufferedAssistantText = () => finishHeldText();

	const emitTextDelta = (nextDelta) => {
		if (!nextDelta) {
			return;
		}
		const delta = afterPendingParagraphBreak(nextDelta);

		unsuppressedAssistantText += delta;

		if (hasSuppressedLargeAssistantJson) {
			return;
		}

		assistantText += delta;
		bufferedAssistantText += delta;

		// Held as a possible classifier payload as when each delta was split alone, whatever is held
		// before it: an open fence, a partial patch line or an opener.
		if (
			isClassifierIntentLeakCandidate(bufferedAssistantText) &&
			(bufferedAssistantText.length <= classifierJsonBufferMaxChars ||
				parseClassifierIntentPayload(bufferedAssistantText))
		) {
			return;
		}
		const releasedText = bufferedAssistantText;
		bufferedAssistantText = "";
		releaseText(releasedText);
	};

	const flushDeferredToolFirstText = () => {
		if (!shouldDeferToolFirstText || deferredToolFirstText.length === 0) {
			return;
		}

		writeShownTextDelta(deferredToolFirstText);
		deferredToolFirstText = "";
	};

	const emitForcedTextDelta = (nextDelta) => {
		if (typeof nextDelta !== "string" || nextDelta.length === 0) {
			return;
		}
		const delta = afterPendingParagraphBreak(nextDelta);

		assistantText += delta;
		unsuppressedAssistantText += delta;
		// Forced: shown now, with no wait for a classifier payload, a fence's close or more text.
		const forcedText = `${bufferedAssistantText}${delta}`;
		bufferedAssistantText = "";
		finishText(forcedText);
	};

	/**
	 * A notice as its own paragraph after the held text ends: a break before it after earlier text,
	 * and before any text after it. The break on the wire follows what went out there; the break in
	 * the turn's text follows that text. On a card-first turn the suppressed text goes out first
	 * through the text route's replay, so the notice always reaches the wire, once. The replay writes
	 * only what streaming would have shown: no completed spec or media fence, which the turn's text
	 * keeps for the post-stream pipeline, and nothing that may be a classifier payload. The turn's text
	 * drops a payload that parses, as it does one still held, and keeps text it cannot prove is one.
	 */
	const emitNoticeParagraph = (notice) => {
		const text = typeof notice === "string" ? notice.trim() : "";
		if (!text) {
			return;
		}
		releaseHeldTextBeforeNotice();
		if (suppressingStreamingText) {
			suppressingStreamingText = false;
			const replayedText = splitHeldAssistantText(assistantText, true).visibleText;
			if (!isClassifierIntentLeakCandidate(replayedText)) {
				replayTextForTextRoute(replayedText);
			} else if (parseClassifierIntentPayload(assistantText)) {
				recordWithheldEnd(assistantText, 0);
				dropWithheldEnd();
			}
		}
		paragraphBreakPending = false;
		const releasedTextEnd = `${shownTextEnd}${deferredToolFirstText}`;
		const hasReleasedVisibleText = hasShownVisibleText || deferredToolFirstText.trim().length > 0;
		assistantText += `${paragraphSeparatorAfter(assistantText)}${text}`;
		unsuppressedAssistantText += `${paragraphSeparatorAfter(unsuppressedAssistantText)}${text}`;
		emitTextDeltaRaw(`${paragraphSeparatorAfter(releasedTextEnd, hasReleasedVisibleText)}${text}`);
		paragraphBreakPending = true;
		streamedNewlineRun = 0;
		streamedEndsAtFence = false;
	};

	/** On a card-first turn whose text was suppressed and never started, writes `replayedText` once. */
	const replayTextForTextRoute = (replayedText) => {
		if (
			!suppressStreamingTextForCardFirstGenui ||
			textStarted ||
			replayedText.trim().length === 0
		) {
			return;
		}

		writeShownTextDelta(replayedText);
	};

	const emitBufferedAssistantTextForTextRoute = () => replayTextForTextRoute(assistantText);

	const removeToolFirstFailureNarrative = () => {
		if (!toolFirstFailureNarrativeEnabled) {
			return;
		}

		const sanitizedAssistant = stripToolFirstFailureNarrative(assistantText);
		if (sanitizedAssistant.replaced) {
			assistantText = sanitizedAssistant.text;
		}

		if (deferredToolFirstText.length > 0) {
			const sanitizedDeferred =
				stripToolFirstFailureNarrative(deferredToolFirstText);
			if (sanitizedDeferred.replaced) {
				deferredToolFirstText = sanitizedDeferred.text;
			}
		}
	};

	/**
	 * Clears the attempt's text for the next attempt. A rerun that keeps the text already shown
	 * (`continuesShownText`) starts its first shown text as a new paragraph.
	 */
	const resetAssistantTextForRetryAttempt = ({ continuesShownText = false } = {}) => {
		// The end of the attempt's text ends a held media fence the media rule left undecided, as the
		// end of a stream does: what the closed fence was holding back is split again, and only an end
		// that may still open a hidden fence stays held, for the rule below.
		if (heldKind === "fence") {
			splitAndWriteText(heldText, { ended: true, final: false });
		}
		// Held text that opened no hidden fence is ordinary text, shown as the attempt streamed it:
		// backticks alone, or an opener the text held after it as a possible classifier payload has
		// already disproved. Anything else held is dropped with the attempt: an open fence or patch
		// line, or a partial hidden opener ("```sp", "```image") the dropped attempt can no longer
		// complete.
		if (heldKind === "opener" && (/^`+$/u.test(heldText) || (bufferedAssistantText && !isHiddenOpenerStart(`${heldText}${bufferedAssistantText}`)))) {
			writeSplitText(heldText, { atFenceEnd: false, atFenceStart: false });
		}
		heldText = "";
		heldKind = "";
		streamedNewlineRun = 0;
		streamedEndsAtFence = false;
		if (continuesShownText && hasShownVisibleText) {
			shownParagraphBreakPending = true;
		}
		// Whitespace an attempt never showed is dropped with it.
		heldWhitespace = "";
		assistantText = "";
		unsuppressedAssistantText = "";
		bufferedAssistantText = "";
		withheldStart = null;
		hasSuppressedLargeAssistantJson = false;
		paragraphBreakPending = false;
		if (shouldDeferToolFirstText) {
			deferredToolFirstText = "";
		}
	};

	const writeTextEndIfStarted = () => {
		if (textStarted) {
			writer.write({ type: "text-end", id: textId });
		}
	};

	return {
		emitBufferedAssistantTextForTextRoute,
		emitForcedTextDelta,
		emitNoticeParagraph,
		emitTextDelta,
		emitTextDeltaRaw,
		finalizeBufferedAssistantText,
		flushDeferredToolFirstText,
		getAssistantText: () => assistantText,
		getHasSuppressedLargeAssistantJson: () => hasSuppressedLargeAssistantJson,
		getTextStarted: () => textStarted,
		getUnsuppressedAssistantText: () => unsuppressedAssistantText,
		removeToolFirstFailureNarrative,
		resetAssistantTextForRetryAttempt,
		setAssistantText: (nextAssistantText) => {
			assistantText =
				typeof nextAssistantText === "string" ? nextAssistantText : "";
			withheldStart = null;
		},
		writeTextEndIfStarted,
	};
}

module.exports = {
	createRovoTextOutputController,
};
