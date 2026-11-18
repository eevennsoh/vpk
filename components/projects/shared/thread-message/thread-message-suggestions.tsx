"use client";

import { use, type ReactNode } from "react";
import { ThreadMessageContext } from "./thread-message-context";
import { AssistantSuggestionsSection } from "../components/assistant-suggestions-section";

interface ThreadMessageSuggestionsProps {
	onSuggestionClick?: (question: string) => void;
}

export function ThreadMessageSuggestions({
	onSuggestionClick,
}: Readonly<ThreadMessageSuggestionsProps>): ReactNode {
	const {
		message,
		isStreaming,
		suggestedQuestions,
		hasRenderedWidget,
	} = use(ThreadMessageContext)!;

	if (isStreaming || suggestedQuestions.length === 0 || hasRenderedWidget) {
		return null;
	}

	return (
		<AssistantSuggestionsSection
			className="-ms-2"
			messageId={message.id}
			suggestedQuestions={suggestedQuestions}
			onSuggestionClick={onSuggestionClick}
		/>
	);
}
