"use client";

import { useCallback, useEffect } from "react";
import type { RovoChatCutShortMediaWait, RovoChatTurnEvent } from "@/app/contexts/rovo-chat-turn-machine";
import { readCutShortFinish } from "@/app/contexts/rovo-chat-turn-errors";
import { CUT_SHORT_MEDIA_WAIT_MS } from "@/app/contexts/use-rovo-chat-media-generation";

type FinishInput = Parameters<typeof readCutShortFinish>[0];

/**
 * Turns a request that finished without turn-complete into a cut-short turn,
 * from the request's finish snapshot rather than committed React state, which
 * can lag a response that arrived before React rendered it. When the snapshot
 * left a media widget loading, the turn records when its CUT_SHORT_MEDIA_WAIT_MS
 * wait ends, and finalizes with the notice once it has.
 *
 * The timer follows `wait` (the turn's own record), not the callback that
 * started it: an effect cleanup (a provider hidden through <Activity>, or
 * StrictMode) cancels it and the next setup arms it again for the time left,
 * or ends the wait at once when that has passed. The wait is keyed by prompt,
 * and every reset clears it, so a wait never outlives its turn.
 */
export function useRovoChatCutShortTurn(
	dispatchTurn: (event: RovoChatTurnEvent) => void,
	queueTick: () => void,
	wait: RovoChatCutShortMediaWait | null,
) {
	const waitPromptId = wait?.promptId ?? null;
	const waitEndsAt = wait?.endsAt ?? null;

	useEffect(() => {
		if (waitPromptId === null || waitEndsAt === null) {
			return;
		}

		const timer = setTimeout(() => {
			dispatchTurn({ type: "cutShortMediaWaitElapsed", promptId: waitPromptId });
			queueTick();
		}, Math.max(0, waitEndsAt - Date.now()));
		return () => clearTimeout(timer);
	}, [dispatchTurn, queueTick, waitEndsAt, waitPromptId]);

	return useCallback((input: FinishInput) => {
		const finish = readCutShortFinish(input);
		if (!finish || !input.activePrompt) {
			return;
		}

		dispatchTurn({
			type: "turnCutShort",
			promptId: input.activePrompt.id,
			finish,
			mediaWaitEndsAt: finish.mediaLoading ? Date.now() + CUT_SHORT_MEDIA_WAIT_MS : null,
		});
		queueTick();
	}, [dispatchTurn, queueTick]);
}
