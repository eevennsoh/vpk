export const REASONING_LABELS = {
	trigger: {
		thinking: "Thinking",
		preloadShimmer: "Thinking",
		awaitingUserResponse: "Awaiting user response",
		questionsAnswered: "Questions answered",
		working: "Working",
		generatingResults: "Generating results",
	},
	section: {
		thinking: "Reasoning",
		stream: "Response",
		steps: "Steps",
		agents: "Agents",
		tools: "Tools",
	},
	completed: {
		completed: "Completed",
	},
} as const;

/**
 * Pool of interchangeable "working" synonyms used for the collapsed thinking
 * header on scripted, multi-step traces (e.g. Studio agent creation). The
 * header stays generic (it never echoes the exact step name) but cycles through
 * these as the flow advances, so it never sits stale on a single persistent
 * word. Keep these short, present-continuous, and tonally neutral.
 */
export const WORKING_HEADER_LABELS = [
	"Working",
	"Cooking",
	"Crafting",
	"Building",
	"Shaping",
	"Assembling",
] as const;

export function getDefaultThinkingLabel(): string {
	return REASONING_LABELS.trigger.thinking;
}

/**
 * Deterministically pick a working-header label from {@link WORKING_HEADER_LABELS}.
 *
 * The choice is keyed off `seed` (typically the current step label) so the same
 * step always resolves to the same word — stable across re-renders and SSR —
 * while different steps surface different words as the trace progresses.
 */
export function getCyclingWorkingLabel(seed: string): string {
	const labels = WORKING_HEADER_LABELS;
	const normalized = seed.trim().toLowerCase();
	if (!normalized) {
		return labels[0];
	}

	let hash = 0;
	for (let index = 0; index < normalized.length; index += 1) {
		hash = (hash * 31 + normalized.charCodeAt(index)) | 0;
	}

	return labels[Math.abs(hash) % labels.length];
}

export function getPreloadShimmerLabel(): string {
	return REASONING_LABELS.trigger.preloadShimmer;
}

export function getAwaitingUserResponseLabel(): string {
	return REASONING_LABELS.trigger.awaitingUserResponse;
}

export function getQuestionsAnsweredLabel(): string {
	return REASONING_LABELS.trigger.questionsAnswered;
}

export function getReasoningSectionTitle(
	kind: keyof typeof REASONING_LABELS.section
): string {
	return REASONING_LABELS.section[kind];
}

export function getReasoningCompletedLabel(duration?: number): string {
	if (duration === undefined) {
		return REASONING_LABELS.completed.completed;
	}

	return `Thought for ${duration}s`;
}
