import { useCallback, useEffect } from "react";
import { useClicky } from "@/components/projects/rovo-core/hooks/use-clicky";
import { useScreenAssistantRegion } from "./use-screen-assistant-region";

/**
 * Rovo AI cursor companion (Clicky) for the chat panel, plus the painted
 * screen-assistant region it can point into. `hideAiCursor` force-deactivates it.
 */
export function useChatPanelClicky(hideAiCursor: boolean) {
	const clicky = useClicky();
	const {
		activate: activateClicky,
		isActive: isClickyActive,
		deactivate: deactivateClicky,
		startSpeaking: clickyStartSpeaking,
	} = clicky;
	const streamClickyAssistantText = useCallback((text: string) => {
		if (!text.trim() || hideAiCursor) {
			return false;
		}

		if (!isClickyActive) {
			activateClicky();
		}
		clickyStartSpeaking(text);
		return true;
	}, [activateClicky, clickyStartSpeaking, hideAiCursor, isClickyActive]);
	const screenAssistantRegion = useScreenAssistantRegion(!hideAiCursor && isClickyActive);

	useEffect(() => {
		if (hideAiCursor && isClickyActive) {
			deactivateClicky();
		}
	}, [deactivateClicky, hideAiCursor, isClickyActive]);

	return { clicky, screenAssistantRegion, streamClickyAssistantText };
}

export type ChatPanelClicky = ReturnType<typeof useChatPanelClicky>;
