/**
 * Pure reasoning lifecycle for `useReasoningPhase`. No React and no clock: every timestamp
 * arrives in an event, so the `node:test` transition table drives it directly.
 */

export type ReasoningPhase = "preload" | "thinking" | "completed" | "idle";

export type ReasoningLifecycle =
	| { readonly kind: "idle" }
	| { readonly kind: "streaming"; readonly startedAt: number }
	| { readonly kind: "completed" };

/** The minimum-preload hold. `generation` changes on every re-arm so a stale timer is ignored. */
export type ReasoningPreloadLock =
	| { readonly locked: false; readonly generation: number }
	| { readonly locked: true; readonly generation: number; readonly holdMs: number };

export interface ReasoningMachineState {
	readonly lifecycle: ReasoningLifecycle;
	/** Last completed duration in whole seconds. It survives auto idle. */
	readonly duration: number | undefined;
	readonly preload: ReasoningPreloadLock;
	/** The response the state belongs to; a different key resets it. */
	readonly responseKey: string;
}

export interface ReasoningSyncInput {
	readonly responseKey: string;
	readonly isStreaming: boolean;
	readonly persistedStartMs: number | null;
	readonly persistedDuration: number | undefined;
	readonly minPreloadMs: number;
}

export type ReasoningEvent =
	/** The hook's inputs changed; `now` is when the effect saw it. */
	| { readonly type: "sync"; readonly input: ReasoningSyncInput; readonly now: number }
	| { readonly type: "preload-elapsed"; readonly generation: number }
	| { readonly type: "auto-idle" };

const MS_IN_S = 1000;
const IDLE: ReasoningLifecycle = { kind: "idle" };
const COMPLETED: ReasoningLifecycle = { kind: "completed" };

/** State before the first sync: a persisted, finished window shows as completed at once. */
export function createReasoningPhaseState(input: ReasoningSyncInput): ReasoningMachineState {
	const persistedDone = !input.isStreaming && input.persistedDuration !== undefined;
	return {
		lifecycle: persistedDone ? COMPLETED : IDLE,
		duration: input.isStreaming ? undefined : input.persistedDuration,
		preload: { locked: false, generation: 0 },
		responseKey: input.responseKey,
	};
}

function armPreload(preload: ReasoningPreloadLock, minPreloadMs: number): ReasoningPreloadLock {
	if (minPreloadMs > 0) {
		return { locked: true, generation: preload.generation + 1, holdMs: minPreloadMs };
	}
	return preload.locked ? { locked: false, generation: preload.generation + 1 } : preload;
}

function releasePreload(preload: ReasoningPreloadLock): ReasoningPreloadLock {
	return preload.locked ? { locked: false, generation: preload.generation + 1 } : preload;
}

function sync(state: ReasoningMachineState, input: ReasoningSyncInput, now: number): ReasoningMachineState {
	const startedAt = input.persistedStartMs ?? now;

	if (state.responseKey !== input.responseKey) {
		if (input.isStreaming) {
			return {
				lifecycle: { kind: "streaming", startedAt },
				duration: undefined,
				preload: armPreload(state.preload, input.minPreloadMs),
				responseKey: input.responseKey,
			};
		}
		return {
			lifecycle: input.persistedDuration === undefined ? IDLE : COMPLETED,
			duration: input.persistedDuration,
			preload: releasePreload(state.preload),
			responseKey: input.responseKey,
		};
	}

	const wasStreaming = state.lifecycle.kind === "streaming";
	if (input.isStreaming && !wasStreaming) {
		return {
			...state,
			lifecycle: { kind: "streaming", startedAt },
			duration: undefined,
			preload: armPreload(state.preload, input.minPreloadMs),
		};
	}
	if (!input.isStreaming && state.lifecycle.kind === "streaming") {
		// The preload hold is left running: it may outlast the stream.
		return {
			...state,
			lifecycle: COMPLETED,
			duration: Math.ceil((now - state.lifecycle.startedAt) / MS_IN_S),
		};
	}
	if (
		!input.isStreaming
		&& input.persistedDuration !== undefined
		&& (state.duration !== input.persistedDuration || state.lifecycle.kind !== "completed")
	) {
		// Persisted timestamps (from the server) win over a locally measured duration.
		return { ...state, lifecycle: COMPLETED, duration: input.persistedDuration };
	}
	return state;
}

/** Transition table. Returns the identical object when nothing changes. */
export function reasoningPhaseReducer(
	state: ReasoningMachineState,
	event: ReasoningEvent,
): ReasoningMachineState {
	switch (event.type) {
		case "sync":
			return sync(state, event.input, event.now);
		case "preload-elapsed":
			if (!state.preload.locked || state.preload.generation !== event.generation) {
				return state;
			}
			return { ...state, preload: { locked: false, generation: state.preload.generation } };
		case "auto-idle":
			return state.lifecycle.kind === "completed" ? { ...state, lifecycle: IDLE } : state;
		default: {
			const _exhaustive: never = event;
			void _exhaustive;
			return state;
		}
	}
}

/** The visible phase. A live stream reads from the props so text arriving needs no event. */
export function selectReasoningPhase(
	state: ReasoningMachineState,
	{ hasMessageText, isStreaming }: { readonly hasMessageText: boolean; readonly isStreaming: boolean },
): ReasoningPhase {
	if (state.preload.locked) {
		return "preload";
	}
	if (isStreaming) {
		return hasMessageText ? "thinking" : "preload";
	}
	return state.lifecycle.kind === "completed" ? "completed" : "idle";
}
