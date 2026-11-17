"use client";

import { useCallback, useEffect } from "react";
import { createRetryCountdownMessage, type RovoChatRetryWait, type RovoChatTurnEvent, type RovoChatTurnState } from "@/app/contexts/rovo-chat-turn-machine";
import type { RovoUIMessage } from "@/lib/rovo-ui-messages";

/** Effect cleanup suspends the clocks, not the retry recorded by the turn. */
export function useRovoChatRetry(
	retry: RovoChatRetryWait | null,
	showCountdown: (message: RovoUIMessage | null) => void,
	retryActivePromptRef: { readonly current: (retry: RovoChatRetryWait) => Promise<void> },
	dispatchTurn: (event: RovoChatTurnEvent) => void,
	turnRef: { readonly current: RovoChatTurnState },
) {
	useEffect(() => {
		dispatchTurn({ type: "retryResumed" });
		return () => dispatchTurn({ type: "retrySuspended" });
	}, [dispatchTurn]);

	useEffect(() => {
		if (!retry || turnRef.current.disposed || turnRef.current.retry !== retry) return;
		if (retry.phase === "ready") {
			void retryActivePromptRef.current(retry);
			return;
		}
		// A backwards wall-clock jump cannot arm more than the original delay.
		const timeLeft = Math.max(0, Math.min(retry.delayMs, retry.dueAt - Date.now(), retry.monotonicDueAt - performance.now()));
		const endsAt = performance.now() + timeLeft;
		const current = () => !turnRef.current.disposed && turnRef.current.retry === retry;
		const update = () => {
			if (current()) showCountdown(createRetryCountdownMessage(
				retry.reason, retry.messageId, Math.max(1, Math.ceil((endsAt - performance.now()) / 1000)),
			));
		};
		update();
		const countdown = setInterval(update, 1000);
		const timer = setTimeout(() => {
			clearInterval(countdown);
			if (!current()) return;
			showCountdown(null);
			dispatchTurn({ type: "retryElapsed", retry });
		}, timeLeft);
		return () => {
			clearTimeout(timer);
			clearInterval(countdown);
		};
	}, [dispatchTurn, retry, retryActivePromptRef, showCountdown, turnRef]);

	return useCallback((wait: Omit<RovoChatRetryWait, "dueAt" | "monotonicDueAt" | "phase">) => {
		const startedAt = Date.now();
		const scheduled: RovoChatRetryWait = {
			...wait, phase: "waiting", dueAt: startedAt + wait.delayMs, monotonicDueAt: performance.now() + wait.delayMs,
		};
		dispatchTurn({ type: "retryScheduled", retry: scheduled });
		if (turnRef.current.retry === scheduled) showCountdown(createRetryCountdownMessage(wait.reason, wait.messageId, Math.ceil(wait.delayMs / 1000)));
		return startedAt;
	}, [dispatchTurn, showCountdown, turnRef]);
}
