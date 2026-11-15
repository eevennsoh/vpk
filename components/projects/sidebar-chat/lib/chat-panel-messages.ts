import {
	getMessageAgentResult,
	getMessageArtifactResult,
	hasTurnCompleteSignal,
	type RovoDataParts,
	type RovoRenderableUIMessage,
	type RovoUIMessage,
} from "@/lib/rovo-ui-messages";
import { isGeneratedAgentResult } from "../components/agent-result-card";
import type { ChatPanelCardsProps, ChatPanelGeneratedResult } from "./chat-panel-types";

type ChatPanelMessage = Pick<RovoUIMessage, "id" | "role">;

export function getLastAssistantMessageId(messages: ReadonlyArray<ChatPanelMessage>): string | null {
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].role === "assistant") {
			return messages[i].id;
		}
	}
	return null;
}

/**
 * Assistant messages followed by a later user message have had their
 * clarification answered, so their thinking trace should read "Questions
 * answered" instead of "Awaiting user response".
 */
export function getAnsweredTraceMessageIds(
	messages: ReadonlyArray<ChatPanelMessage>,
	enabled: boolean,
): Set<string> {
	const ids = new Set<string>();
	if (!enabled) {
		return ids;
	}
	let sawLaterUser = false;
	for (let i = messages.length - 1; i >= 0; i--) {
		const candidate = messages[i];
		if (candidate.role === "assistant" && sawLaterUser) {
			ids.add(candidate.id);
		}
		if (candidate.role === "user") {
			sawLaterUser = true;
		}
	}
	return ids;
}

/**
 * The host-provided generated-agent card renders as a fallback only until a
 * completed message in the thread carries the same generated agent result.
 */
export function shouldRenderGeneratedAgentFallbackCard(
	generatedAgentResult: RovoDataParts["agent-result"] | null | undefined,
	messages: ReadonlyArray<Pick<RovoUIMessage, "parts">>,
): boolean {
	if (!isGeneratedAgentResult(generatedAgentResult)) {
		return false;
	}

	const cardAgentId = generatedAgentResult.agentId;
	const cardAction = generatedAgentResult.action;
	return !messages.some((message) => {
		if (!hasTurnCompleteSignal(message)) {
			return false;
		}

		const messageAgentResult = getMessageAgentResult(message);
		return (
			isGeneratedAgentResult(messageAgentResult) &&
			messageAgentResult.agentId === cardAgentId &&
			messageAgentResult.action === cardAction
		);
	});
}

export function getTurnGeneratedResults(
	turn: ReadonlyArray<RovoRenderableUIMessage>,
	shouldRenderGeneratedAgentResult: ChatPanelCardsProps["shouldRenderGeneratedAgentResult"],
): ChatPanelGeneratedResult[] {
	return turn.flatMap((message): ChatPanelGeneratedResult[] => {
		const artifactResult = getMessageArtifactResult(message);
		const agentResult = getMessageAgentResult(message);
		const generatedAgentResult =
			isGeneratedAgentResult(agentResult) &&
			hasTurnCompleteSignal(message) &&
			(shouldRenderGeneratedAgentResult?.({ agent: agentResult, message }) ?? true)
				? agentResult
				: null;
		const results: ChatPanelGeneratedResult[] = [];

		if (artifactResult && !generatedAgentResult) {
			results.push({ type: "artifact", result: artifactResult });
		}
		if (generatedAgentResult) {
			results.push({ type: "agent", result: generatedAgentResult });
		}

		return results;
	});
}
