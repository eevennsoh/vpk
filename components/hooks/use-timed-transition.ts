"use client";

import { useEffect, useEffectEvent } from "react";

/** One timed edge: after `delayMs` in a state, advance to `next`. */
export interface TimedTransitionStep<S extends string> {
	readonly next: S;
	readonly delayMs: number;
}

/** States with a row advance on a timer; a state without a row is where the sequence rests. */
export type TimedTransitionTable<S extends string> = Readonly<Partial<Record<S, TimedTransitionStep<S>>>>;

/** What the hook does in a state: nothing, wait for a timer, or (reduced motion) jump at once. */
export type TimedTransitionPlan<S extends string> =
	| { readonly kind: "rest" }
	| { readonly kind: "wait"; readonly next: S; readonly delayMs: number }
	| { readonly kind: "jump"; readonly next: S };

export interface TimedTransitionOptions<S extends string> {
	/** Called with the state to move to. Timers and reduced-motion jumps both arrive here. */
	readonly onAdvance: (next: S) => void;
	/** Durations collapse: the sequence jumps straight to its resting state and no timer runs. */
	readonly reducedMotion: boolean;
	/** Changing it restarts the current step's timer even when the state is unchanged (a replay). */
	readonly restartKey?: unknown;
}

const REST: TimedTransitionPlan<never> = { kind: "rest" };

/**
 * The state the sequence rests in when every timer from `state` has fired, or `null` when
 * the table loops and never rests.
 */
export function resolveTimedTransitionEnd<S extends string>(
	state: S,
	table: TimedTransitionTable<S>,
): S | null {
	const visited = new Set<S>();
	let current = state;
	for (let step = table[current]; step !== undefined; step = table[current]) {
		visited.add(current);
		current = step.next;
		if (visited.has(current)) {
			return null;
		}
	}
	return current;
}

/**
 * Pure plan for one state. `null` pauses the sequence. Under reduced motion a looping table
 * holds still instead of spinning through its states.
 */
export function resolveTimedTransition<S extends string>(
	state: S | null,
	table: TimedTransitionTable<S>,
	reducedMotion: boolean,
): TimedTransitionPlan<S> {
	const step = state === null ? undefined : table[state];
	if (state === null || step === undefined) {
		return REST;
	}
	if (!reducedMotion) {
		return { kind: "wait", next: step.next, delayMs: step.delayMs };
	}
	const end = resolveTimedTransitionEnd(state, table);
	return end === null ? REST : { kind: "jump", next: end };
}

/**
 * Advances a caller-owned state through `table` on timers. The caller keeps the state (a
 * `useState` or a reducer) and moves it in `onAdvance`; pass `null` to pause. Each state change
 * clears the previous timer, and unmounting clears the last one.
 */
export function useTimedTransition<S extends string>(
	state: S | null,
	table: TimedTransitionTable<S>,
	{ onAdvance, reducedMotion, restartKey }: TimedTransitionOptions<S>,
): void {
	const advance = useEffectEvent(onAdvance);
	const plan = resolveTimedTransition(state, table, reducedMotion);
	const next = plan.kind === "rest" ? null : plan.next;
	const delayMs = plan.kind === "wait" ? plan.delayMs : null;

	useEffect(() => {
		if (next === null) {
			return undefined;
		}
		if (delayMs === null) {
			advance(next);
			return undefined;
		}
		const timeoutId = setTimeout(() => advance(next), delayMs);
		return () => clearTimeout(timeoutId);
	}, [delayMs, next, restartKey, state]);
}
