import type { RovoChatTurnState } from "@/app/contexts/rovo-chat-turn-machine";

export interface RovoChatRequestGate {
	readonly turnRef: { readonly current: RovoChatTurnState };
	readonly waitForTurn: (ready: (state: RovoChatTurnState) => boolean) => Promise<void>;
}

/**
 * Request preparation belongs to a transcript, not a selection operation.
 * A failed/superseded selection releases it; a committed replacement drops it.
 * Recheck after every await, including creation and stop, before touching SDK
 * messages. Callers claim their dispatch synchronously in `send`.
 */
export async function sendForTranscript(
	gate: RovoChatRequestGate,
	isCurrent: (state: RovoChatTurnState) => boolean,
	preparations: ReadonlyArray<() => Promise<unknown>>,
	send: () => Promise<void>,
): Promise<void> {
	const version = gate.turnRef.current.transcriptVersion;
	const current = (state: RovoChatTurnState) => state.transcriptVersion === version && isCurrent(state);
	const blocked = (state: RovoChatTurnState) => state.transitionId !== null || state.suspended;
	preparation: while (current(gate.turnRef.current)) {
		await gate.waitForTurn((state) => !current(state) || !blocked(state));
		if (!current(gate.turnRef.current)) return;
		if (blocked(gate.turnRef.current)) continue;
		for (const prepare of preparations) {
			try {
				await prepare();
			} catch (error) {
				if (!current(gate.turnRef.current)) return;
				// Starting a selection invalidates creation. If its transcript stays,
				// retain the prompt and create its thread again after that selection.
				if (error instanceof DOMException && error.name === "AbortError") continue preparation;
				throw error;
			}
			if (!current(gate.turnRef.current)) return;
			if (blocked(gate.turnRef.current)) continue preparation;
		}
		await send();
		return;
	}
}
