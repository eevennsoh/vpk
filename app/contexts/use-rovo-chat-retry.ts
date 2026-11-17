"use client";

import { useCallback, useEffect } from "react";
import { createRetryCountdownMessage, type RovoChatRetryWait, type RovoChatTurnEvent } from "@/app/contexts/rovo-chat-turn-machine";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";

/** Effect cleanup suspends the clocks, not the retry recorded by the turn. */
export function useRovoChatRetry(
	retry: RovoChatRetryWait | null,
	showCountdown: (message: RovoUIMessage) => void,
	retryActivePromptRef: { readonly current: (retry: RovoChatRetryWait) => Promise<void> },
	dispatchTurn: (event: RovoChatTurnEvent) => void,
) {
	useEffect(() => {
		if (!retry) return;
		// A backwards wall-clock jump cannot arm more than the original delay.
		const timeLeft = Math.max(0, Math.min(retry.delayMs, retry.dueAt - Date.now(), retry.monotonicDueAt - performance.now()));
		const endsAt = performance.now() + timeLeft;
		const update = () => showCountdown(createRetryCountdownMessage(
			retry.reason, retry.messageId, Math.max(1, Math.ceil((endsAt - performance.now()) / 1000)),
		));
		update();
		const countdown = setInterval(update, 1000);
		const timer = setTimeout(() => {
			clearInterval(countdown);
			void retryActivePromptRef.current(retry);
		}, timeLeft);
		return () => {
			clearTimeout(timer);
			clearInterval(countdown);
		};
	}, [retry, retryActivePromptRef, showCountdown]);

	return useCallback((wait: Omit<RovoChatRetryWait, "dueAt" | "monotonicDueAt">) => {
		const startedAt = Date.now();
		dispatchTurn({ type: "retryScheduled", retry: {
			...wait, dueAt: startedAt + wait.delayMs, monotonicDueAt: performance.now() + wait.delayMs,
		} });
		showCountdown(createRetryCountdownMessage(wait.reason, wait.messageId, Math.ceil(wait.delayMs / 1000)));
		return startedAt;
	}, [dispatchTurn, showCountdown]);
}
