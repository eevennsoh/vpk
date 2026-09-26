/**
 * Session search across Rovo threads.
 *
 * Provides substring/regex search across thread titles and message content.
 * Returns matches with snippets, match counts, and thread metadata.
 *
 * Used by this repository's backend to power the /api/sessions/search endpoint
 * and by the frontend to search within the Rovo sidebar.
 */

const SNIPPET_CONTEXT_CHARS = 80;
const DEFAULT_LIMIT = 20;

/**
 * Extract all searchable text from a thread's messages.
 * Handles both UI message format (parts array) and simple content strings.
 *
 * @param {Array} messages
 * @returns {string} Concatenated searchable text.
 */
function extractSearchableText(messages) {
	if (!Array.isArray(messages)) {
		return "";
	}

	const segments = [];
	for (const msg of messages) {
		if (!msg || typeof msg !== "object") {
			continue;
		}

		// Handle simple content field
		if (typeof msg.content === "string" && msg.content.trim()) {
			segments.push(msg.content);
		}

		// Handle parts array (UI message format)
		if (Array.isArray(msg.parts)) {
			for (const part of msg.parts) {
				if (part && typeof part.text === "string" && part.text.trim()) {
					segments.push(part.text);
				}
			}
		}
	}

	return segments.join("\n");
}

/**
 * Build a snippet around a known match occurrence.
 *
 * @param {string} text - Full text to extract snippet from.
 * @param {number} matchStart - First match start offset.
 * @param {number} matchLength - First match length.
 * @returns {string} Snippet with match context.
 */
function buildSnippetFromMatch(text, matchStart, matchLength) {
	if (matchStart < 0 || matchLength <= 0) {
		return text.slice(0, SNIPPET_CONTEXT_CHARS * 2).trim();
	}

	const matchEnd = matchStart + matchLength;
	const snippetStart = Math.max(0, matchStart - SNIPPET_CONTEXT_CHARS);
	const snippetEnd = Math.min(text.length, matchEnd + SNIPPET_CONTEXT_CHARS);

	let snippet = text.slice(snippetStart, snippetEnd).trim();
	if (snippetStart > 0) {
		snippet = `…${snippet}`;
	}
	if (snippetEnd < text.length) {
		snippet = `${snippet}…`;
	}

	// Collapse whitespace
	return snippet.replace(/\s+/gu, " ");
}

/**
 * Count non-overlapping matches of a pattern in text and retain first match.
 *
 * @param {string} text
 * @param {RegExp} pattern - Must have global flag.
 * @returns {{ count: number, firstMatchLength: number, firstMatchStart: number }}
 */
function collectMatchSummary(text, pattern) {
	pattern.lastIndex = 0;
	let count = 0;
	let firstMatchStart = -1;
	let firstMatchLength = 0;
	let match;
	while ((match = pattern.exec(text)) !== null) {
		if (count === 0) {
			firstMatchStart = match.index;
			firstMatchLength = match[0].length;
		}
		count += 1;
	}
	return { count, firstMatchLength, firstMatchStart };
}

/**
 * Search across threads by content and title.
 *
 * @param {Array<{ id: string, title: string, messages: Array, updatedAt: string }>} threads
 * @param {string} query - Search query string.
 * @param {{ limit?: number }} [options]
 * @returns {Array<{ threadId: string, title: string, snippet: string, matchCount: number, lastMessageAt: string }>}
 */
function searchThreads(threads, query, options) {
	if (!query || typeof query !== "string" || !query.trim()) {
		return [];
	}

	if (!Array.isArray(threads) || threads.length === 0) {
		return [];
	}

	const limit = options?.limit ?? DEFAULT_LIMIT;
	const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	const pattern = new RegExp(escapedQuery, "giu");

	const results = [];

	for (const thread of threads) {
		if (!thread || typeof thread !== "object" || !thread.id) {
			continue;
		}

		const title = typeof thread.title === "string" ? thread.title : "";
		const messageText = extractSearchableText(thread.messages);
		const fullText = `${title}\n${messageText}`;

		const matchSummary = collectMatchSummary(fullText, pattern);
		const matchCount = matchSummary.count;
		if (matchCount === 0) {
			continue;
		}

		const snippet = buildSnippetFromMatch(
			fullText,
			matchSummary.firstMatchStart,
			matchSummary.firstMatchLength,
		);

		const lastMessageAt = thread.updatedAt || new Date().toISOString();
		results.push({
			item: {
				threadId: thread.id,
				title: title || "Untitled",
				snippet,
				matchCount,
				lastMessageAt,
			},
			lastMessageAtMs: Date.parse(lastMessageAt),
		});
	}

	// Sort by match count desc, then recency desc
	results.sort((a, b) => {
		if (b.item.matchCount !== a.item.matchCount) {
			return b.item.matchCount - a.item.matchCount;
		}
		return b.lastMessageAtMs - a.lastMessageAtMs;
	});

	return results.slice(0, limit).map((result) => result.item);
}

module.exports = {
	extractSearchableText,
	searchThreads,
};
