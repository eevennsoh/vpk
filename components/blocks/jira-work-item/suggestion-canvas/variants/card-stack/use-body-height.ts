"use client";

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { animate, useMotionValue, useReducedMotion, type AnimationPlaybackControls, type Transition } from "motion/react";

import { MORPH_HEIGHT, MORPH_HEIGHT_GATHER, MORPH_HEIGHT_UNPACK, SETTLE } from "./constants";

export type BodyMode = "stack" | "list" | "caught-up";

/**
 * How the body overflows, derived from state so it is never stale. The list is a scroll container from the first frame
 * of the unpack, so a wheel over it always scrolls it (the canvas only hands the wheel to nested areas whose computed
 * overflow scrolls). The stack clips vertically only while its height eases (tilted sheets keep their corners) and is
 * unclipped at rest.
 */
function overflowOf(mode: BodyMode, easing: boolean): Pick<CSSProperties, "overflowX" | "overflowY"> {
	if (mode === "list") return { overflowX: "hidden", overflowY: "auto" };
	return easing ? { overflowX: "visible", overflowY: "clip" } : { overflowX: "visible", overflowY: "visible" };
}

/**
 * The popover body's height, which is also the list's scrollport. It eases between the stack's natural height and
 * the list's (capped at `maxHeight`) in step with the cards' morph, and follows content changes within a mode.
 * `settled` turns true once a mode's height has landed; `viewport` is the height the body is heading for, so the
 * list's depth can be laid out against where the scrollport lands rather than where it is mid-ease.
 */
export function useBodyHeight(content: RefObject<HTMLElement | null>, mode: BodyMode, maxHeight: number) {
	const height = useMotionValue<number | "auto">("auto");
	const reduced = useReducedMotion() ?? false;
	const easing = useRef<{ controls: AnimationPlaybackControls; target: number } | null>(null);
	const [settledMode, setSettledMode] = useState<BodyMode>(mode);
	const [isEasing, setIsEasing] = useState(false);
	const target = useRef(0);
	const latest = useRef({ mode, maxHeight, reduced });
	const viewport = useCallback(() => target.current, []);

	useLayoutEffect(() => {
		latest.current = { mode, maxHeight, reduced };
	});

	const rest = () => {
		easing.current = null;
		setIsEasing(false);
		setSettledMode(latest.current.mode);
	};

	const targetHeight = () => {
		const natural = content.current?.offsetHeight ?? 0;
		return latest.current.mode === "list" ? Math.min(natural, latest.current.maxHeight) : natural;
	};

	const ease = (to: number, transition: Transition) => {
		easing.current?.controls.stop();
		setIsEasing(true);
		const controls = animate(height, to, transition);
		easing.current = { controls, target: to };
		void controls.then(() => {
			if (easing.current?.controls === controls) rest();
		});
	};

	const follow = (transition: Transition) => {
		const to = targetHeight();
		target.current = to;
		const from = height.get();
		if (latest.current.reduced || typeof from !== "number") {
			easing.current?.controls.stop();
			height.set(to);
			rest();
			return;
		}
		if (from === to && !easing.current) {
			rest();
			return;
		}
		if (easing.current?.target === to) return;
		ease(to, transition);
	};

	// A mode change eases with the morph.
	useLayoutEffect(() => {
		const from = height.get();
		const shrinking = typeof from === "number" && targetHeight() < from;
		follow(shrinking ? MORPH_HEIGHT_GATHER : mode === "list" ? MORPH_HEIGHT_UNPACK : MORPH_HEIGHT);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- runs per mode; follow only reads refs and the motion value
	}, [mode, maxHeight]);

	// Content resizing within a mode (a decision, a fold, a re-run's arrivals) eases more briefly.
	useLayoutEffect(() => {
		const element = content.current;
		if (!element) return undefined;
		const observer = new ResizeObserver(() => follow(easing.current ? MORPH_HEIGHT : SETTLE));
		observer.observe(element);
		return () => observer.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- one observer for the component's life
	}, []);

	const settled = settledMode === mode;
	return { height, settled, overflow: overflowOf(mode, isEasing || !settled), viewport };
}
