"use strict";

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
	// The end of the turn's text the wire follows: split as a whole, so an open fence keeps hiding
	// its later chunks. It restarts once nothing in it can change how later text splits.
	let streamedText = "";
	// The part of the visible text of `streamedText` that went out.
	let streamedVisibleText = "";
	// Whether `streamedText` ends in an open fence (or a partial patch line) the splitters hold back.
	let streamedTextHoldsPending = false;
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

	/** Held text split into what may be shown and what an open spec or media fence still holds back. */
	const splitHeldAssistantText = (text) => {
		const spec = splitSpecFenceTextForStreaming(text);
		const media = splitDirectMediaTextForStreaming(spec.visibleText);
		return { pendingText: `${media.pendingText}${spec.pendingText}`, visibleText: media.visibleText };
	};

	/**
	 * Where, in `heldText` as it was stored, the part `split` holds back starts (`heldText.length` when
	 * nothing is). The splitters rewrite text (completed fences, runs of blank lines), so the held-back
	 * text is not matched against the stored end: it starts where its first line occurs and the text
	 * from there, split on its own, is all held back and reads the same.
	 */
	const findWithheldOffset = (heldText, { pendingText, visibleText }) => {
		if (!pendingText) {
			return heldText.length;
		}
		if (!visibleText) {
			return 0;
		}
		const firstLine = pendingText.split("\n", 1)[0];
		let offset = firstLine ? heldText.lastIndexOf(firstLine) : -1;
		while (offset >= 0) {
			const tail = splitHeldAssistantText(heldText.slice(offset));
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
	 * Writes what `streamedText` newly lets through. Unless `final`, the end of it that may still open
	 * a hidden fence stays held too. Visible text only grows as the streamed text does (the splitters
	 * hide a fence from its opener on and collapse blank lines without shortening a run's start), so
	 * what went out is a prefix of it; if it ever is not, nothing more of the overlap goes out.
	 * Returns the split.
	 */
	const advanceStreamedText = ({ final }) => {
		const split = splitHeldAssistantText(streamedText);
		const heldOpener = final || split.pendingText ? "" : (split.visibleText.match(PARTIAL_HIDDEN_FENCE_OPENER)?.[0] ?? "");
		const visibleText = split.visibleText.slice(0, split.visibleText.length - heldOpener.length);
		if (visibleText.startsWith(streamedVisibleText)) {
			emitTextDeltaRaw(visibleText.slice(streamedVisibleText.length));
		}
		streamedVisibleText = visibleText;
		streamedTextHoldsPending = Boolean(split.pendingText);
		// Ending outside a fence, past any newline (in it or standing in for a completed fence) or
		// backtick, the text so far splits the same whatever follows it.
		if (!split.pendingText && !heldOpener && !streamedText.endsWith("\n") && !visibleText.endsWith("\n")) {
			streamedText = "";
			streamedVisibleText = "";
		}
		return split;
	};

	/**
	 * Ends the streamed text: everything visible goes out, and the end it holds back, then
	 * `withheldText` (the stored text after it that never reaches the wire), is recorded as withheld.
	 */
	const finishStreamedText = (withheldText = "") => {
		const heldText = streamedText;
		const offset = heldText ? findWithheldOffset(heldText, advanceStreamedText({ final: true })) : 0;
		streamedText = "";
		streamedVisibleText = "";
		streamedTextHoldsPending = false;
		if (heldText || withheldText) {
			recordWithheldEnd(`${heldText}${withheldText}`, offset);
		}
	};

	/**
	 * Ends all held text: what may be shown goes out; an open fence and a held classifier payload
	 * that parses stay off the wire. Returns that payload, or null.
	 */
	const finishHeldText = () => {
		const classifierPayload = bufferedAssistantText ? parseClassifierIntentPayload(bufferedAssistantText) : null;
		const withheldText = classifierPayload ? bufferedAssistantText : "";
		if (!classifierPayload) {
			streamedText += bufferedAssistantText;
		}
		bufferedAssistantText = "";
		finishStreamedText(withheldText);
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

	/** Hands the held classifier candidate on to the splitters and writes what they let through. */
	const releaseBufferedAssistantText = () => {
		streamedText += bufferedAssistantText;
		bufferedAssistantText = "";
		advanceStreamedText({ final: false });
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

		// Inside an open fence nothing is shown, so a classifier payload cannot start there.
		if (
			!streamedTextHoldsPending &&
			isClassifierIntentLeakCandidate(bufferedAssistantText) &&
			(bufferedAssistantText.length <= classifierJsonBufferMaxChars ||
				parseClassifierIntentPayload(bufferedAssistantText))
		) {
			return;
		}
		releaseBufferedAssistantText();
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
		streamedText += `${bufferedAssistantText}${delta}`;
		bufferedAssistantText = "";
		finishStreamedText();
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
			const replayedText = splitHeldAssistantText(assistantText).visibleText;
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
		if (continuesShownText && hasShownVisibleText) {
			shownParagraphBreakPending = true;
		}
		// Whitespace an attempt never showed is dropped with it.
		heldWhitespace = "";
		assistantText = "";
		unsuppressedAssistantText = "";
		bufferedAssistantText = "";
		streamedText = "";
		streamedVisibleText = "";
		streamedTextHoldsPending = false;
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
