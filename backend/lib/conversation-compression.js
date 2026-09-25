/**
 * Context compression for conversation history.
 *
 * Auto-summarizes older conversation turns into a structured summary when
 * the total character count exceeds a configurable threshold. Preserves
 * system messages and the most recent N messages (tail) verbatim.
 *
 * Used by this repository's backend to keep conversation context within limits
 * when injecting history into Rovo Serve prompts.
 */

const SUMMARY_HEADER = "# Conversation Summary";

const FILE_PATH_PATTERN = /(?:^|\s)((?:[\w.-]+\/)+[\w.-]+\.[a-zA-Z]{1,6})/gu;

/**
 * Extract file paths from text using heuristics.
 *
 * @param {string} text
 * @returns {Set<string>} Unique file paths found.
 */
function extractFilePaths(text) {
	const paths = new Set();
	if (typeof text !== "string") {
		return paths;
	}

	FILE_PATH_PATTERN.lastIndex = 0;
	let match;
	while ((match = FILE_PATH_PATTERN.exec(text)) !== null) {
		const candidate = match[1];
		// Skip URLs
		if (text.slice(Math.max(0, match.index - 10), match.index).includes("://")) {
			continue;
		}
		paths.add(candidate);
	}

	return paths;
}

/**
 * Build a structured summary from conversation messages.
 *
 * @param {{ role: string, content: string }[]} messages
 * @returns {string} Structured summary with Goal/Progress/Decisions/Files/Next Steps.
 */
function buildConversationSummary(messages) {
	const goalHints = [];
	const progressHints = [];
	const filePaths = new Set();

	for (const msg of messages) {
		const content = typeof msg.content === "string" ? msg.content : "";
		if (!content) {
			continue;
		}

		// First user message often states the goal
		if (msg.role === "user" && goalHints.length === 0 && content.length > 10) {
			goalHints.push(content.slice(0, 300).trim());
		}

		// Extract file paths
		for (const fp of extractFilePaths(content)) {
			filePaths.add(fp);
		}

		// Track progress from assistant responses
		if (msg.role === "assistant" && content.length > 50 && progressHints.length < 10) {
			const firstSentence = content.split(/[.!?\n]/u)[0].trim();
			if (firstSentence.length > 20) {
				progressHints.push(firstSentence.slice(0, 200));
			}
		}
	}

	const goal = goalHints.length > 0
		? goalHints[0]
		: "Not explicitly stated in compressed turns.";
	const progress = progressHints.length > 0
		? progressHints.map((h) => `- ${h}`).join("\n")
		: "- No significant progress captured.";
	const files = filePaths.size > 0
		? [...filePaths].sort().slice(0, 20).map((f) => `- ${f}`).join("\n")
		: "- No files identified.";

	return `${SUMMARY_HEADER}

The following is a summary of the earlier conversation that has been compressed
to save context space. The most recent messages follow after this summary.

## Goal
${goal}

## Progress
${progress}

## Key Decisions
- Refer to recent messages for decision context.

## Files Referenced
${files}

## Next Steps
Refer to the recent messages below for current context.`;
}

/**
 * Compress a conversation by replacing older messages with a structured summary.
 *
 * @param {{ role: string, content: string }[]} messages - Full conversation history.
 * @param {{ thresholdChars: number, tailCount: number }} options
 * @returns {{ messages: Array, compressed: boolean, length: number }}
 */
function compressConversation(messages, options) {
	const { thresholdChars = 50_000, tailCount = 6 } = options || {};

	if (!messages || messages.length === 0) {
		return { messages: [], compressed: false, length: 0 };
	}

	// Count total chars
	const totalChars = messages.reduce(
		(sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0),
		0,
	);

	if (totalChars <= thresholdChars) {
		return { messages, compressed: false, length: messages.length };
	}

	// Separate system messages (head) from conversation body
	const head = [];
	const body = [];
	for (const msg of messages) {
		if (msg.role === "system" && !String(msg.content).includes(SUMMARY_HEADER)) {
			head.push(msg);
		} else {
			body.push(msg);
		}
	}

	if (body.length <= tailCount) {
		return { messages, compressed: false, length: messages.length };
	}

	// Split body into compressible and tail
	const tailStart = Math.max(0, body.length - tailCount);
	const compressible = body.slice(0, tailStart);
	const tail = body.slice(tailStart);

	// Filter out any existing summary from compressible messages
	const messagesToSummarize = compressible.filter(
		(m) => !(m.role === "system" && String(m.content).includes(SUMMARY_HEADER)),
	);

	const summaryText = buildConversationSummary(messagesToSummarize);
	const summaryMessage = { role: "system", content: summaryText };
	const result = [...head, summaryMessage, ...tail];

	return { messages: result, compressed: true, length: result.length };
}

module.exports = {
	SUMMARY_HEADER,
	buildConversationSummary,
	compressConversation,
	extractFilePaths,
};
