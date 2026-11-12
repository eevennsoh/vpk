"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import {
	applyBoardEvent,
	createInitialTerminalDemoState,
	createTerminalDemoReducer,
	getOrderedItemKeys,
	type TerminalBeatStep,
	type TerminalDemoState,
	type TerminalWorkItem,
} from "../lib/terminal-demo-state";
import {
	getJiraIssueUrl,
	TERMINAL_DEMO_BEATS,
	TERMINAL_INITIAL_HINT,
} from "../data/terminal-demo-script";

// ---------------------------------------------------------------------------
// useTerminalDemo — presenter-paced controller for the ASX Terminal stage.
//
// The reducer (owned by ../lib/terminal-demo-state) only ever applies a
// step's *final* effect via `commit-step`. Everything in-between — chars
// typed, lines revealed, board events staggering in — is hook-local view
// state (`revealCount`) that this file animates with plain timers, then
// commits once the animation completes. This keeps fast-forward and the
// reduced-motion path trivial: both just skip straight to `finish-beat`.
// ---------------------------------------------------------------------------

const TYPE_MS_PER_CHAR = 28;
const OUTPUT_MS_PER_LINE = 120;
const OUTPUT_LEAD_IN_MS = 300;
const BOARD_MS_PER_EVENT = 350;

type TimerHandle = number;

export interface TerminalDemoController {
	state: TerminalDemoState;
	activeStep: TerminalBeatStep | null;
	revealCount: number;
	beatCount: number;
	awaitingClick: boolean;
	statusHint: string;
	/** Key of the highlighted Jira row (up/down navigation), or null when nothing is selected. */
	selectedKey: string | null;
	advance: () => void;
	stepBack: () => void;
	handleFrameClick: () => void;
	restart: () => void;
}

const terminalDemoReducer = createTerminalDemoReducer(TERMINAL_DEMO_BEATS);

// The demo's window-level key handler must not steal keys from a focused
// interactive control: Space/Enter on a focused button (top-bar Restart, the
// gallery tiles, theme/reset controls) must still activate it, not advance the
// demo. So bail whenever focus is within any editable field or activatable
// control, not just text inputs.
function isInteractiveTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	return Boolean(
		target.closest(
			'input, textarea, select, button, a[href], [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="switch"], [role="option"]',
		),
	);
}

/**
 * Fold a "board" step's events over `items` up to `revealCount`, so the Jira
 * pane can render partially-applied board mutations while a board step is
 * mid-animation (staggered reveal). Outside a "board" step this is a no-op.
 */
export function foldBoardPreview(
	items: readonly TerminalWorkItem[],
	step: TerminalBeatStep | null,
	revealCount: number,
): readonly TerminalWorkItem[] {
	if (!step || step.kind !== "board") return items;
	let next = items;
	const count = Math.min(revealCount, step.events.length);
	for (let index = 0; index < count; index += 1) {
		next = applyBoardEvent(next, step.events[index]);
	}
	return next;
}

export function useTerminalDemo(enabled: boolean): TerminalDemoController {
	const shouldReduceMotion = useReducedMotion();
	const [state, dispatch] = useReducer(terminalDemoReducer, undefined, createInitialTerminalDemoState);
	const [revealCount, setRevealCount] = useState(0);
	const [rawSelectedKey, setRawSelectedKey] = useState<string | null>(null);
	const timersRef = useRef<Set<TimerHandle>>(new Set());

	// A row highlight is only meaningful while it points at an item that still
	// exists (items are added over the story, and rollback can remove them).
	const selectedKey =
		rawSelectedKey !== null && state.items.some((item) => item.key === rawSelectedKey) ? rawSelectedKey : null;

	const clearAllTimers = useCallback(() => {
		for (const timer of timersRef.current) window.clearTimeout(timer);
		timersRef.current.clear();
	}, []);

	const scheduleTimer = useCallback((callback: () => void, delayMs: number): void => {
		const timer = window.setTimeout(() => {
			timersRef.current.delete(timer);
			callback();
		}, delayMs);
		timersRef.current.add(timer);
	}, []);

	const activeStep = useMemo<TerminalBeatStep | null>(() => {
		if (state.settled || state.finished) return null;
		return TERMINAL_DEMO_BEATS[state.beatIndex]?.steps[state.stepIndex] ?? null;
	}, [state.settled, state.finished, state.beatIndex, state.stepIndex]);

	// Step driver: animates the CURRENT step (revealCount 0 → N), then
	// commits it. Keyed on (beatIndex, stepIndex, settled) so it re-runs once
	// per step and stops entirely once a beat settles.
	useEffect(() => {
		if (!enabled || shouldReduceMotion || state.settled || state.finished) return;
		const step = TERMINAL_DEMO_BEATS[state.beatIndex]?.steps[state.stepIndex];
		if (!step) return;

		setRevealCount(0);

		// Time-based reveal: progress derives from elapsed time, not from tick
		// count, so throttled timers (hidden tabs, busy main thread) drop
		// frames instead of stretching the animation out.
		const scheduleReveal = (total: number, perUnitMs: number, startedAt: number): void => {
			const elapsed = performance.now() - startedAt;
			const revealTo = Math.min(total, Math.max(1, Math.ceil(elapsed / perUnitMs)));
			setRevealCount(revealTo);
			if (revealTo >= total) {
				scheduleTimer(() => dispatch({ type: "commit-step" }), 0);
				return;
			}
			scheduleTimer(() => scheduleReveal(total, perUnitMs, startedAt), perUnitMs);
		};
		const startReveal = (total: number, perUnitMs: number): void => {
			scheduleReveal(total, perUnitMs, performance.now());
		};

		if (step.kind === "split" || step.kind === "show-dashboard" || step.kind === "submit") {
			scheduleTimer(() => dispatch({ type: "commit-step" }), 0);
		} else if (step.kind === "pause") {
			scheduleTimer(() => dispatch({ type: "commit-step" }), step.ms);
		} else if (step.kind === "type") {
			if (step.text.length === 0) {
				scheduleTimer(() => dispatch({ type: "commit-step" }), 0);
			} else {
				startReveal(step.text.length, TYPE_MS_PER_CHAR);
			}
		} else if (step.kind === "output") {
			const leadIn = step.pane === "right" ? OUTPUT_LEAD_IN_MS : 0;
			if (step.lines.length === 0) {
				scheduleTimer(() => dispatch({ type: "commit-step" }), leadIn);
			} else {
				scheduleTimer(() => startReveal(step.lines.length, OUTPUT_MS_PER_LINE), leadIn);
			}
		} else if (step.kind === "board") {
			if (step.events.length === 0) {
				scheduleTimer(() => dispatch({ type: "commit-step" }), 0);
			} else {
				startReveal(step.events.length, BOARD_MS_PER_EVENT);
			}
		}

		return () => clearAllTimers();
	}, [
		enabled,
		shouldReduceMotion,
		state.beatIndex,
		state.stepIndex,
		state.settled,
		state.finished,
		scheduleTimer,
		clearAllTimers,
	]);

	const restart = useCallback(() => {
		clearAllTimers();
		setRevealCount(0);
		setRawSelectedKey(null);
		dispatch({ type: "restart" });
	}, [clearAllTimers]);

	// Backspace: instant rollback to the previous beat's settled state. Clears any
	// in-flight animation timers so the current beat's partial reveal is discarded.
	const stepBack = useCallback(() => {
		if (!enabled) return;
		clearAllTimers();
		setRevealCount(0);
		dispatch({ type: "step-back" });
	}, [enabled, clearAllTimers]);

	// Row navigation over the on-screen order. With nothing selected, ↓ picks the
	// first row and ↑ the last; otherwise move by one and clamp at the ends.
	const moveSelection = useCallback(
		(delta: 1 | -1) => {
			const keys = getOrderedItemKeys(state.items);
			if (keys.length === 0) return;
			setRawSelectedKey((current) => {
				const index = current === null ? -1 : keys.indexOf(current);
				if (index === -1) return delta === 1 ? keys[0] : keys[keys.length - 1];
				const next = Math.min(keys.length - 1, Math.max(0, index + delta));
				return keys[next];
			});
		},
		[state.items],
	);

	const advance = useCallback(() => {
		if (!enabled) return;
		if (shouldReduceMotion) {
			if (state.finished) return;
			clearAllTimers();
			dispatch({ type: "begin-beat" });
			dispatch({ type: "finish-beat" });
			return;
		}
		if (state.settled) {
			if (state.finished) return;
			dispatch({ type: "begin-beat" });
			return;
		}
		clearAllTimers();
		dispatch({ type: "finish-beat" });
	}, [enabled, shouldReduceMotion, state.settled, state.finished, clearAllTimers]);

	const awaitingClick = useMemo(() => {
		if (!enabled || state.finished || !state.settled) return false;
		// `beatIndex` only advances on `begin-beat`, so while settled it still
		// points at the beat that just finished (-1 before anything has run).
		// The trigger that gates a click affordance belongs to the NEXT beat.
		return TERMINAL_DEMO_BEATS[state.beatIndex + 1]?.trigger === "click";
	}, [enabled, state.finished, state.settled, state.beatIndex]);

	const handleFrameClick = useCallback(() => {
		if (!awaitingClick) return;
		advance();
	}, [awaitingClick, advance]);

	// Keyboard while this stage is active:
	//   →/Space       advance a beat        ←/Backspace  roll back a beat
	//   ↑/↓      move the Jira row     Enter      open the row in Jira
	//   r/R      restart
	useEffect(() => {
		if (!enabled) return;
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isInteractiveTarget(event.target)) return;
			if (event.key === "ArrowRight" || event.key === " " || event.key === "Spacebar") {
				event.preventDefault();
				advance();
				return;
			}
			if (event.key === "ArrowLeft" || event.key === "Backspace") {
				event.preventDefault();
				stepBack();
				return;
			}
			if (event.key === "ArrowDown" && state.dashboardVisible) {
				event.preventDefault();
				moveSelection(1);
				return;
			}
			if (event.key === "ArrowUp" && state.dashboardVisible) {
				event.preventDefault();
				moveSelection(-1);
				return;
			}
			if (event.key === "Enter" && state.dashboardVisible && selectedKey !== null) {
				event.preventDefault();
				window.open(getJiraIssueUrl(selectedKey), "_blank", "noopener,noreferrer");
				return;
			}
			if (event.key === "r" || event.key === "R") {
				restart();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [enabled, advance, stepBack, restart, moveSelection, state.dashboardVisible, selectedKey]);

	// Disabling the stage (card switched away) must stop every pending timer.
	useEffect(() => {
		if (!enabled) clearAllTimers();
	}, [enabled, clearAllTimers]);

	useEffect(() => () => clearAllTimers(), [clearAllTimers]);

	const statusHint = useMemo(() => {
		if (state.finished) return "demo complete · R to restart";
		if (!state.settled) return "✽ running…";
		// `beatIndex` (still) points at the beat that just settled — its `hint`
		// is written forward-looking (e.g. "→ next: …"), so this reads as the
		// current status. Before anything has run (-1) fall back to the
		// pre-story hint.
		if (state.beatIndex < 0) return TERMINAL_INITIAL_HINT;
		return TERMINAL_DEMO_BEATS[state.beatIndex]?.hint ?? TERMINAL_INITIAL_HINT;
	}, [state.finished, state.settled, state.beatIndex]);

	return {
		state,
		activeStep,
		revealCount,
		beatCount: TERMINAL_DEMO_BEATS.length,
		awaitingClick,
		statusHint,
		selectedKey,
		advance,
		stepBack,
		handleFrameClick,
		restart,
	};
}
