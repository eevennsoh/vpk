"use client";

import { useCallback, useRef, useState } from "react";
import type { QueuedPromptItem } from "@/app/contexts/rovo-chat-helpers";
import {
	ROVO_CHAT_TURN_INITIAL_STATE,
	findCutShortMediaWait,
	rovoChatTurnReducer,
	type RovoChatCutShortMediaWait,
	type RovoChatTurnEvent,
	type RovoChatTurnState,
	type RovoChatRetryWait,
} from "@/app/contexts/rovo-chat-turn-machine";

/**
 * Holds the chat turn machine for RovoChatProvider. The provider's async flows
 * (request callbacks, retry timers, stop and edit) read the turn synchronously
 * between awaits, so the current state lives in a ref that every dispatch
 * updates at once. The queue, the active prompt and its cut-short wait, which
 * consumers render or effects follow, are mirrored into React state whenever a
 * transition changes them.
 */
export function useRovoChatTurnMachine() {
	const turnRef = useRef<RovoChatTurnState>(ROVO_CHAT_TURN_INITIAL_STATE);
	const [queuedPrompts, setQueuedPrompts] = useState<ReadonlyArray<QueuedPromptItem>>(ROVO_CHAT_TURN_INITIAL_STATE.queue);
	const [activePrompt, setActivePrompt] = useState<QueuedPromptItem | null>(null);
	const [cutShortMediaWait, setCutShortMediaWait] = useState<RovoChatCutShortMediaWait | null>(null);
	const [retry, setRetry] = useState<RovoChatRetryWait | null>(null);
	const listeners = useRef(new Set<() => void>());
	// Async request preparation observes reducer transitions without waiting for
	// React to commit SDK status. No polling timer owns this lifecycle.
	const waitForTurn = useCallback((ready: (state: RovoChatTurnState) => boolean): Promise<void> => {
		if (ready(turnRef.current)) return Promise.resolve();
		return new Promise((resolve) => {
			const check = () => {
				if (!ready(turnRef.current)) return;
				listeners.current.delete(check);
				resolve();
			};
			listeners.current.add(check);
		});
	}, []);

	const dispatchTurn = useCallback((event: RovoChatTurnEvent) => {
		const previous = turnRef.current;
		const next = rovoChatTurnReducer(previous, event);
		if (next === previous) {
			return;
		}

		turnRef.current = next;
		for (const notify of listeners.current) notify();
		if (next.retry !== previous.retry) setRetry(next.retry);
		if (next.queue !== previous.queue) {
			setQueuedPrompts(next.queue);
		}
		if (next.activePrompt !== previous.activePrompt) {
			setActivePrompt(next.activePrompt);
		}
		if (next.cutShort !== previous.cutShort || next.activePrompt !== previous.activePrompt) {
			setCutShortMediaWait(findCutShortMediaWait(next));
		}
	}, []);

	return { turnRef, dispatchTurn, queuedPrompts, activePrompt, cutShortMediaWait, retry, waitForTurn };
}
