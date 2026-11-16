"use client";

import { useCallback, useRef, useState } from "react";
import type { QueuedPromptItem } from "@/app/contexts/rovo-chat-helpers";
import {
	ROVO_CHAT_TURN_INITIAL_STATE,
	rovoChatTurnReducer,
	type RovoChatTurnEvent,
	type RovoChatTurnState,
} from "@/app/contexts/rovo-chat-turn-machine";

/**
 * Holds the chat turn machine for RovoChatProvider. The provider's async flows
 * (request callbacks, retry timers, stop and edit) read the turn synchronously
 * between awaits, so the current state lives in a ref that every dispatch
 * updates at once. The queue and active prompt, which consumers render, are
 * mirrored into React state whenever a transition changes them.
 */
export function useRovoChatTurnMachine() {
	const turnRef = useRef<RovoChatTurnState>(ROVO_CHAT_TURN_INITIAL_STATE);
	const [queuedPrompts, setQueuedPrompts] = useState<ReadonlyArray<QueuedPromptItem>>(ROVO_CHAT_TURN_INITIAL_STATE.queue);
	const [activePrompt, setActivePrompt] = useState<QueuedPromptItem | null>(null);

	const dispatchTurn = useCallback((event: RovoChatTurnEvent) => {
		const previous = turnRef.current;
		const next = rovoChatTurnReducer(previous, event);
		if (next === previous) {
			return;
		}

		turnRef.current = next;
		if (next.queue !== previous.queue) {
			setQueuedPrompts(next.queue);
		}
		if (next.activePrompt !== previous.activePrompt) {
			setActivePrompt(next.activePrompt);
		}
	}, []);

	return { turnRef, dispatchTurn, queuedPrompts, activePrompt };
}
