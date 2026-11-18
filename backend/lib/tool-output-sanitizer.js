const { isPlainObject } = require("./shared-utils");

const MAX_TOOL_PREVIEW_CHARS = 1200;
const MAX_TOOL_PREVIEW_LINES = 20;
const MAX_INLINE_ASSISTANT_JSON_CHARS = 2000;
const ASSISTANT_JSON_SUPPRESSION_TEXT =
	"Tool results were large and are omitted for performance. Open Tools for details.";
const COMPLETE_SPEC_FENCE_PATTERN = /```spec\s*\n[\s\S]*?```/giu;
// Open from an opener whose whole language is `spec` (only whitespace after it on its line, as the
// complete pattern and the post-stream extractor require), or one still undecided at the end of the
// text. "```specs-not" or "```specification" opens an ordinary code fence.
const PENDING_SPEC_FENCE_PATTERN = /```spec(?=[^\S\n]*(?:\n|$))[\s\S]*$/iu;

/**
 * Matches a line that looks like an RFC 6902 JSON Patch targeting a spec tree.
 * Catches unfenced JSONL patches that json-render emits inline (e.g. when
 * Rovo outputs patches without wrapping in a ```spec fence).
 */
const SPEC_PATCH_LINE_PATTERN = /^\s*\{"op"\s*:\s*"(?:add|replace|remove)"\s*,\s*"path"\s*:\s*"\/(?:root|elements|state)\b/;

const MAX_SERIALIZE_DEPTH = 4;
const MAX_SERIALIZE_ARRAY_ITEMS = 50;
const MAX_SERIALIZE_OBJECT_KEYS = 50;

function truncateByLines(value, maxLines) {
	if (maxLines <= 0) {
		return { text: "", truncated: value.length > 0 };
	}

	const lines = value.split(/\r?\n/u);
	if (lines.length <= maxLines) {
		return { text: value, truncated: false };
	}

	return {
		text: lines.slice(0, maxLines).join("\n"),
		truncated: true,
	};
}

function truncateByChars(value, maxChars) {
	if (maxChars <= 0) {
		return { text: "", truncated: value.length > 0 };
	}

	if (value.length <= maxChars) {
		return { text: value, truncated: false };
	}

	const slicedText = value.slice(0, Math.max(0, maxChars - 1));
	return { text: `${slicedText}…`, truncated: true };
}

function toBoundedSerializableValue(value, depth, seen) {
	if (value === null || value === undefined) {
		return value;
	}

	if (typeof value !== "object") {
		return value;
	}

	if (seen.has(value)) {
		return "[Circular]";
	}

	if (depth >= MAX_SERIALIZE_DEPTH) {
		if (Array.isArray(value)) {
			return `[Array(${value.length})]`;
		}
		return "[Object]";
	}

	seen.add(value);
	try {
		if (Array.isArray(value)) {
			const truncatedArray = value
				.slice(0, MAX_SERIALIZE_ARRAY_ITEMS)
				.map((item) =>
					toBoundedSerializableValue(item, depth + 1, seen)
				);
			if (value.length > MAX_SERIALIZE_ARRAY_ITEMS) {
				truncatedArray.push(
					`[+${value.length - MAX_SERIALIZE_ARRAY_ITEMS} more items]`
				);
			}
			return truncatedArray;
		}

		if (isPlainObject(value)) {
			const entries = Object.entries(value);
			const boundedObject = {};
			for (const [key, entryValue] of entries.slice(0, MAX_SERIALIZE_OBJECT_KEYS)) {
				boundedObject[key] = toBoundedSerializableValue(
					entryValue,
					depth + 1,
					seen
				);
			}
			if (entries.length > MAX_SERIALIZE_OBJECT_KEYS) {
				boundedObject.__truncated__ = `+${entries.length - MAX_SERIALIZE_OBJECT_KEYS} more keys`;
			}
			return boundedObject;
		}

		return String(value);
	} finally {
		seen.delete(value);
	}
}

function stringifyValue(value) {
	if (typeof value === "string") {
		return value;
	}
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	try {
		const boundedValue = toBoundedSerializableValue(value, 0, new WeakSet());
		return JSON.stringify(boundedValue, null, 2);
	} catch {
		return String(value);
	}
}

function toPreview(
	value,
	{
		maxChars = MAX_TOOL_PREVIEW_CHARS,
		maxLines = MAX_TOOL_PREVIEW_LINES,
	} = {}
) {
	const rawText = stringifyValue(value);
	const bytes = Buffer.byteLength(rawText, "utf8");

	let previewText = rawText;
	let truncated = false;

	const lineResult = truncateByLines(previewText, maxLines);
	previewText = lineResult.text;
	truncated = truncated || lineResult.truncated;

	const charResult = truncateByChars(previewText, maxChars);
	previewText = charResult.text;
	truncated = truncated || charResult.truncated;

	return {
		text: previewText,
		truncated,
		bytes,
	};
}

function collapseFenceNewlines(text) {
	return text.replace(/\n{3,}/g, "\n\n");
}

/**
 * Strip JSONL spec patch lines that appear outside ```spec fences.
 * Returns the text with patch lines removed and collapsed whitespace.
 */
function stripUnfencedSpecPatchLines(text) {
	if (typeof text !== "string" || text.length === 0) {
		return text;
	}

	const lines = text.split("\n");
	let hasPatches = false;

	const filtered = lines.filter((line) => {
		if (SPEC_PATCH_LINE_PATTERN.test(line)) {
			hasPatches = true;
			return false;
		}
		return true;
	});

	if (!hasPatches) {
		return text;
	}

	return filtered.join("\n");
}

function splitTrailingUnfencedSpecPatchFragment(text) {
	if (typeof text !== "string" || text.length === 0 || text.endsWith("\n")) {
		return {
			stableText: text,
			pendingText: "",
		};
	}

	const lastNewlineIndex = text.lastIndexOf("\n");
	const trailingLine =
		lastNewlineIndex >= 0 ? text.slice(lastNewlineIndex + 1) : text;
	if (!SPEC_PATCH_LINE_PATTERN.test(trailingLine)) {
		return {
			stableText: text,
			pendingText: "",
		};
	}

	return {
		stableText: lastNewlineIndex >= 0 ? text.slice(0, lastNewlineIndex + 1) : "",
		pendingText: trailingLine,
	};
}

function splitSpecFenceTextForStreaming(text) {
	if (typeof text !== "string" || text.length === 0) {
		return {
			pendingText: "",
			visibleText: "",
		};
	}

	// Step 1: Remove completed ```spec fences
	const textWithCompletedSpecFencesRemoved = text.replace(
		COMPLETE_SPEC_FENCE_PATTERN,
		"\n\n"
	);

	// Step 2: Check for pending (still-open) ```spec fence
	const pendingFenceMatch = textWithCompletedSpecFencesRemoved.match(
		PENDING_SPEC_FENCE_PATTERN
	);

	if (!pendingFenceMatch || pendingFenceMatch.index === undefined) {
		// Step 3: No pending fence — keep a trailing partial patch line buffered
		// so the next chunk can't leak the remainder as plain assistant text.
		const {
			stableText,
			pendingText,
		} = splitTrailingUnfencedSpecPatchFragment(
			textWithCompletedSpecFencesRemoved
		);

		// Step 4: Strip complete unfenced JSONL patch lines from the visible text.
		const withoutUnfencedPatches = stripUnfencedSpecPatchLines(
			stableText
		);
		return {
			pendingText,
			visibleText: collapseFenceNewlines(withoutUnfencedPatches),
		};
	}

	return {
		pendingText: textWithCompletedSpecFencesRemoved.slice(pendingFenceMatch.index),
		visibleText: collapseFenceNewlines(
			textWithCompletedSpecFencesRemoved.slice(0, pendingFenceMatch.index)
		),
	};
}

function hasPendingSpecFence(text) {
	if (typeof text !== "string" || text.length === 0) {
		return false;
	}

	// Check for an open ```spec fence
	if (splitSpecFenceTextForStreaming(text).pendingText.length > 0) {
		return true;
	}

	// Also treat trailing unfenced JSONL patch lines as "pending" so the
	// JSON dump detector doesn't suppress them before we can extract a spec.
	const lines = text.split("\n");
	const lastLine = lines[lines.length - 1] || "";
	return SPEC_PATCH_LINE_PATTERN.test(lastLine);
}

function stripSpecFences(text) {
	if (typeof text !== "string" || text.length === 0) {
		return "";
	}

	const withoutCompletedFences = text.replace(
		COMPLETE_SPEC_FENCE_PATTERN,
		"\n\n"
	);
	const withoutPendingFence = withoutCompletedFences.replace(
		PENDING_SPEC_FENCE_PATTERN,
		"\n\n"
	);
	const withoutUnfencedPatches = stripUnfencedSpecPatchLines(withoutPendingFence);

	return collapseFenceNewlines(withoutUnfencedPatches).trim();
}

function countMatches(value, regex) {
	const matches = value.match(regex);
	return Array.isArray(matches) ? matches.length : 0;
}

function isLikelyLargeJsonDump(
	value,
	{ minChars = MAX_INLINE_ASSISTANT_JSON_CHARS } = {}
) {
	if (typeof value !== "string") {
		return false;
	}

	const text = value.trim();
	if (text.length < minChars) {
		return false;
	}

	const keyPairCount = countMatches(text, /"[^"\n]{1,80}"\s*:/gu);
	const braceCount = countMatches(text, /[{}\[\]]/gu);
	const commaCount = countMatches(text, /,/gu);
	const startsAsJson = text.startsWith("{") || text.startsWith("[");

	if (startsAsJson) {
		return keyPairCount >= 5 || braceCount >= 18;
	}

	return keyPairCount >= 10 && braceCount >= 25 && commaCount >= 20;
}

function getLikelyJsonStartIndex(value) {
	if (typeof value !== "string" || value.length === 0) {
		return -1;
	}

	const objectIndex = value.indexOf("{");
	const arrayIndex = value.indexOf("[");
	if (objectIndex === -1) {
		return arrayIndex;
	}
	if (arrayIndex === -1) {
		return objectIndex;
	}
	return Math.min(objectIndex, arrayIndex);
}

function sanitizeAssistantNarrative(
	value,
	{
		maxChars = MAX_INLINE_ASSISTANT_JSON_CHARS,
		replacement = ASSISTANT_JSON_SUPPRESSION_TEXT,
	} = {}
) {
	if (typeof value !== "string" || value.length === 0) {
		return { text: "", replaced: false };
	}

	const textWithoutSpecFences = stripSpecFences(value);
	const textForDetection =
		textWithoutSpecFences.length > 0 ? textWithoutSpecFences : value;

	if (!isLikelyLargeJsonDump(textForDetection, { minChars: maxChars })) {
		return { text: value, replaced: false };
	}

	const jsonStartIndex = getLikelyJsonStartIndex(textForDetection);
	const prefixCandidate =
		jsonStartIndex > -1 ? textForDetection.slice(0, jsonStartIndex).trim() : "";
	const boundedPrefix =
		prefixCandidate.length > 600
			? `${prefixCandidate.slice(0, 599)}…`
			: prefixCandidate;
	const replacementText = boundedPrefix
		? `${boundedPrefix}\n\n${replacement}`
		: replacement;

	return { text: replacementText, replaced: true };
}

function stripLargeJsonFromNarrative(value, options) {
	return sanitizeAssistantNarrative(value, options);
}

module.exports = {
	MAX_TOOL_PREVIEW_CHARS,
	MAX_TOOL_PREVIEW_LINES,
	MAX_INLINE_ASSISTANT_JSON_CHARS,
	ASSISTANT_JSON_SUPPRESSION_TEXT,
	toPreview,
	splitSpecFenceTextForStreaming,
	hasPendingSpecFence,
	stripSpecFences,
	isLikelyLargeJsonDump,
	sanitizeAssistantNarrative,
	stripLargeJsonFromNarrative,
};
