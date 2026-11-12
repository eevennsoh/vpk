"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import {
	animate,
	useMotionValue,
	useReducedMotion,
	type AnimationPlaybackControls,
	type MotionValue,
} from "motion/react";

const DEFAULT_CYCLE_DURATION_MS = 6000;

export interface AutoCyclePauseHandlers {
	onMouseEnter: () => void;
	onMouseLeave: () => void;
	onFocus: () => void;
	onBlur: (event: FocusEvent<HTMLElement>) => void;
}

export interface UseAutoCycleResult {
	activeIndex: number;
	setActiveIndex: (index: number) => void;
	/** Return to the first index and start a fresh tick, clearing paused interaction state. */
	restart: () => void;
	/** 0 → 1 progress of the current tick; drive an active-indicator `scaleX`. */
	progress: MotionValue<number>;
	/** True while the timer is allowed to run (false under reduced motion). */
	cycleRunning: boolean;
	/** Spread onto the wrapper whose hover/focus should pause the cycle. */
	pauseHandlers: AutoCyclePauseHandlers;
	/** Pause for an interactive surface rendered outside the wrapper, such as a portal. */
	setExternalInteractionActive: (active: boolean) => void;
}

/**
 * Auto-advance an index on a fixed interval, pausing while the user hovers or
 * focuses within the wrapper the returned handlers are spread onto. Mirrors the
 * auto-cycling category bar in `components/blocks/agent-bento`: a linear
 * `progress` MotionValue (0 → 1) drives an active-indicator fill, and each tick
 * completion advances the index and restarts the timer. Selecting an index
 * manually restarts the tick from that index. No-ops under reduced motion.
 */
export function useAutoCycle(count: number, durationMs = DEFAULT_CYCLE_DURATION_MS): UseAutoCycleResult {
	const shouldReduceMotion = useReducedMotion();
	const cycleRunning = !shouldReduceMotion && count > 1;
	const [activeIndex, setActiveIndex] = useState(0);
	const [interacting, setInteracting] = useState(false);
	const [restartKey, setRestartKey] = useState(0);
	const wrapperInteractingRef = useRef(false);
	const externalInteractingRef = useRef(false);
	const interactingRef = useRef(false);
	const progress = useMotionValue(0);
	const controlsRef = useRef<AnimationPlaybackControls | null>(null);

	const updateInteracting = useCallback(() => {
		const next = wrapperInteractingRef.current || externalInteractingRef.current;
		interactingRef.current = next;
		setInteracting(next);
	}, []);

	const setWrapperInteractionActive = useCallback((active: boolean) => {
		wrapperInteractingRef.current = active;
		updateInteracting();
	}, [updateInteracting]);

	const setExternalInteractionActive = useCallback((active: boolean) => {
		externalInteractingRef.current = active;
		updateInteracting();
	}, [updateInteracting]);

	const restart = useCallback(() => {
		controlsRef.current?.stop();
		controlsRef.current = null;
		wrapperInteractingRef.current = false;
		externalInteractingRef.current = false;
		interactingRef.current = false;
		setInteracting(false);
		progress.set(0);
		setActiveIndex(0);
		setRestartKey((current) => current + 1);
	}, [progress]);

	useEffect(() => {
		if (!cycleRunning) {
			progress.set(0);
			return;
		}

		progress.set(0);
		const controls = animate(progress, 1, {
			duration: durationMs / 1000,
			ease: "linear",
			onComplete: () => {
				progress.set(0);
				setActiveIndex((prev) => (prev + 1) % count);
			},
		});
		// Start paused when the user is already interacting so a fresh tick does
		// not briefly run before the pause effect below catches up.
		if (interactingRef.current) {
			controls.pause();
		}
		controlsRef.current = controls;

		return () => {
			controls.stop();
			controlsRef.current = null;
		};
	}, [activeIndex, cycleRunning, count, durationMs, progress, restartKey]);

	useEffect(() => {
		const controls = controlsRef.current;
		if (!controls) {
			return;
		}
		if (interacting) {
			controls.pause();
		} else {
			controls.play();
		}
	}, [interacting]);

	return {
		activeIndex,
		setActiveIndex,
		restart,
		progress,
		cycleRunning,
		pauseHandlers: {
			onMouseEnter: () => setWrapperInteractionActive(true),
			onMouseLeave: () => setWrapperInteractionActive(false),
			onFocus: () => setWrapperInteractionActive(true),
			onBlur: (event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					setWrapperInteractionActive(false);
				}
			},
		},
		setExternalInteractionActive,
	};
}
