"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RovoChatTurnEvent } from "@/app/contexts/rovo-chat-turn-machine";
import { readCutShortFinish } from "@/app/contexts/rovo-chat-turn-errors";
import { CUT_SHORT_MEDIA_WAIT_MS } from "@/app/contexts/use-rovo-chat-media-generation";

type FinishInput = Parameters<typeof readCutShortFinish>[0];

/**
 * Turns a request that finished without turn-complete into a cut-short turn,
 * from the request's finish snapshot rather than committed React state, which
 * can lag a response that arrived before React rendered it. When the snapshot
 * left a media widget loading, the turn waits CUT_SHORT_MEDIA_WAIT_MS before it
 * finalizes with the notice. That wait is keyed by prompt: the turn machine
 * ignores it once the prompt is no longer waiting (Stop, reset, a thread
 * change), so a wait that outlives its turn does nothing.
 */
export function useRovoChatCutShortTurn(dispatchTurn: (event: RovoChatTurnEvent) => void, queueTick: () => void) {
	const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>());

	useEffect(() => {
		const timers = timersRef.current;
		return () => {
			for (const timer of timers) {
				clearTimeout(timer);
			}
			timers.clear();
		};
	}, []);

	return useCallback((input: FinishInput) => {
		const finish = readCutShortFinish(input);
		if (!finish || !input.activePrompt) {
			return;
		}

		dispatchTurn({ type: "turnCutShort", finish });
		if (finish.mediaLoading) {
			const promptId = input.activePrompt.id;
			const timer = setTimeout(() => {
				timersRef.current.delete(timer);
				dispatchTurn({ type: "cutShortMediaWaitElapsed", promptId });
				queueTick();
			}, CUT_SHORT_MEDIA_WAIT_MS);
			timersRef.current.add(timer);
		}
		queueTick();
	}, [dispatchTurn, queueTick]);
}
