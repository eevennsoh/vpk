import type { QueuedPromptItem } from "@/app/contexts";
import {
	hasTurnCompleteSignal,
	type RovoRenderableUIMessage,
} from "@/lib/rovo-ui-messages";

const COMPACT_USER_MESSAGE_ID_PREFIX = "compact-user";

export function getCompactPromptMessageId(promptId: string): string {
	return `${COMPACT_USER_MESSAGE_ID_PREFIX}-${promptId}`;
}

/**
 * Whether the SDK user message for `prompt` has landed. The provider tags it
 * with the prompt id, so this needs no text or clock comparison.
 */
function hasMatchingSubmittedUserMessage(
	messages: ReadonlyArray<RovoRenderableUIMessage>,
	prompt: QueuedPromptItem,
	messageId: string
): boolean {
	return messages.some((message) =>
		message.role === "user" &&
		(message.id === messageId || message.metadata?.promptId === prompt.id)
	);
}

function getOptimisticPromptInsertIndex(
	messages: ReadonlyArray<RovoRenderableUIMessage>
): number {
	let insertIndex = messages.length;

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "assistant") {
			break;
		}

		if (hasTurnCompleteSignal(message)) {
			return messages.length;
		}

		insertIndex = index;
	}

	return insertIndex;
}

export function createOptimisticCompactUserMessage(
	prompt: QueuedPromptItem
): RovoRenderableUIMessage | null {
	if (prompt.options?.messageMetadata?.visibility === "hidden") {
		return null;
	}

	const createdAt = new Date(prompt.createdAt).toISOString();

	return {
		id: getCompactPromptMessageId(prompt.id),
		role: "user",
		metadata: {
			createdAt,
			updatedAt: createdAt,
			...(prompt.options?.messageMetadata ?? {}),
		},
		parts: [
			...prompt.files,
			...(prompt.text
				? [
						{
							type: "text" as const,
							text: prompt.text,
							state: "done" as const,
						},
					]
				: []),
		],
	};
}

export function appendOptimisticCompactUserMessage(
	messages: ReadonlyArray<RovoRenderableUIMessage>,
	prompt: QueuedPromptItem | null
): ReadonlyArray<RovoRenderableUIMessage> {
	if (!prompt) {
		return messages;
	}

	const optimisticMessage = createOptimisticCompactUserMessage(prompt);
	if (!optimisticMessage) {
		return messages;
	}

	if (
		hasMatchingSubmittedUserMessage(
			messages,
			prompt,
			optimisticMessage.id
		)
	) {
		return messages;
	}

	const insertIndex = getOptimisticPromptInsertIndex(messages);
	return [
		...messages.slice(0, insertIndex),
		optimisticMessage,
		...messages.slice(insertIndex),
	];
}
