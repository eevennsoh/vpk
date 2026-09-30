import type { RovoUIMessage } from "@/lib/rovo-ui-messages";
import {
	getMessageInterruption,
	getMessageText,
	hasTurnCompleteSignal,
	isRequestUserInputToolName,
} from "@/lib/rovo-ui-messages";

export type RovoAppPendingAssistantDisplayState =
	| "idle"
	| "user-turn-pending"
	| "assistant-awaiting-output";

export function appendTurnCompleteToLastAssistantMessage(
	messages: ReadonlyArray<RovoUIMessage>,
	timestamp = new Date().toISOString(),
): {
	messageId: string | null;
	messages: RovoUIMessage[];
} {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "assistant") {
			continue;
		}

		if (hasTurnCompleteSignal(message)) {
			return {
				messageId: message.id,
				messages: [...messages],
			};
		}

		const nextMessages = [...messages];
		nextMessages[index] = {
			...message,
			parts: [
				...message.parts,
				{
					type: "data-turn-complete",
					data: { timestamp },
				},
			],
		};
		return {
			messageId: message.id,
			messages: nextMessages,
		};
	}

	return {
		messageId: null,
		messages: [...messages],
	};
}

/**
 * Appends a synthetic `phase: "result"` thinking event for any
 * `ask_user_questions` tool call on the last assistant message that is
 * still in `"awaiting-input"` state.  This causes
 * `getThinkingToolCallSummaries` to derive its state as `"completed"`
 * so the tool badge transitions from "Pending" → "Completed".
 */
export function markClarificationToolResolved(
	messages: ReadonlyArray<RovoUIMessage>,
	outputText = "Answers received.",
): RovoUIMessage[] {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "assistant") {
			continue;
		}

		// Find ask_user_questions thinking events that only have a "start"
		// phase (no matching "result" or "error").
		const startOnlyToolCallIds: Array<{
			eventId: string;
			toolCallId: string;
			toolName: string;
		}> = [];
		const resolvedToolCallIds = new Set<string>();

		for (const part of message.parts) {
			if (part.type !== "data-thinking-event") {
				continue;
			}

			const event = part.data as {
				eventId?: string;
				toolCallId?: string;
				toolName?: string;
				phase?: string;
			};
			const toolName = typeof event.toolName === "string" ? event.toolName.trim() : "";
			const toolCallId = typeof event.toolCallId === "string" ? event.toolCallId.trim() : "";
			if (!toolCallId || !isRequestUserInputToolName(toolName)) {
				continue;
			}

			if (event.phase === "result" || event.phase === "error") {
				resolvedToolCallIds.add(toolCallId);
			} else if (event.phase === "start") {
				startOnlyToolCallIds.push({
					eventId: typeof event.eventId === "string" ? event.eventId : `resolve-${toolCallId}`,
					toolCallId,
					toolName,
				});
			}
		}

		const unresolvedCalls = startOnlyToolCallIds.filter(
			(call) => !resolvedToolCallIds.has(call.toolCallId),
		);
		if (unresolvedCalls.length === 0) {
			return [...messages];
		}

		const timestamp = new Date().toISOString();
		const syntheticResultParts = unresolvedCalls.map((call) => ({
			type: "data-thinking-event" as const,
			data: {
				eventId: `${call.eventId}-resolved`,
				phase: "result" as const,
				toolName: call.toolName,
				toolCallId: call.toolCallId,
				output: outputText,
				outputPreview: outputText,
				timestamp,
			},
		}));

		const nextMessages = [...messages];
		nextMessages[index] = {
			...message,
			parts: [...message.parts, ...syntheticResultParts],
		};
		return nextMessages;
	}

	return [...messages];
}

function hasDataPart<PartType extends string>(
	message: Pick<RovoUIMessage, "parts">,
	partType: PartType,
): boolean {
	return message.parts.some((part) => part.type === partType);
}

function hasThinkingToolCalls(message: Pick<RovoUIMessage, "parts">): boolean {
	return hasDataPart(message, "data-thinking-event");
}

export function resolveRovoAppStreamingAssistantMessageId(
	messages: ReadonlyArray<RovoUIMessage>,
): string | null {
	let latestAssistantMessage: RovoUIMessage | null = null;
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].role === "assistant") {
			latestAssistantMessage = messages[i];
			break;
		}
	}
	if (!latestAssistantMessage) {
		return null;
	}

	if (
		hasTurnCompleteSignal(latestAssistantMessage)
		|| getMessageInterruption(latestAssistantMessage) !== null
	) {
		return null;
	}

	return latestAssistantMessage.id;
}

export function resolveRovoAppPendingAssistantDisplayState({
	isStreaming,
	messages,
}: Readonly<{
	isStreaming: boolean;
	messages: ReadonlyArray<RovoUIMessage>;
}>): RovoAppPendingAssistantDisplayState {
	if (!isStreaming) {
		return "idle";
	}

	let latestVisibleMessage: RovoUIMessage | null = null;
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i];
		if (message.role === "user" || message.role === "assistant") {
			latestVisibleMessage = message;
			break;
		}
	}
	if (!latestVisibleMessage) {
		return "idle";
	}

	if (latestVisibleMessage.role === "user") {
		return "user-turn-pending";
	}

	const hasText = getMessageText(latestVisibleMessage).trim().length > 0;
	const hasThinkingActivity =
		hasDataPart(latestVisibleMessage, "data-thinking-status") ||
		hasDataPart(latestVisibleMessage, "data-thinking-event") ||
		hasThinkingToolCalls(latestVisibleMessage);
	const hasWidget =
		hasDataPart(latestVisibleMessage, "data-widget-data") ||
		hasDataPart(latestVisibleMessage, "data-widget-loading") ||
		hasDataPart(latestVisibleMessage, "data-widget-error");
	const hasArtifact = hasDataPart(latestVisibleMessage, "data-artifact-result");

	if (!hasText && !hasThinkingActivity && !hasWidget && !hasArtifact) {
		return "assistant-awaiting-output";
	}

	return "idle";
}
