"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from "motion/react";

import { cn } from "@/lib/utils";

import { SETTLE } from "./constants";

/**
 * A body that is always exactly as tall as its content. Within one mode it follows the content frame by frame
 * (the deck animates its own height); when the mode changes (deck, caught up, reviewed) it eases between the two
 * natural heights instead of jumping, clipping vertically only while it eases.
 */
export function AutoHeight({ mode, children, className }: Readonly<{ mode: string; children: ReactNode; className?: string }>) {
	const outer = useRef<HTMLDivElement>(null);
	const inner = useRef<HTMLDivElement>(null);
	const height = useMotionValue<number | "auto">("auto");
	const reduced = useReducedMotion() ?? false;
	const easing = useRef<{ controls: AnimationPlaybackControls; target: number } | null>(null);
	const reducedRef = useRef(reduced);

	useLayoutEffect(() => {
		reducedRef.current = reduced;
	}, [reduced]);

	const ease = (target: number) => {
		easing.current?.controls.stop();
		// Clip only while easing between modes; at rest a tilted or flying card must not be cut off.
		if (outer.current) outer.current.style.overflowY = "clip";
		const controls = animate(height, target, SETTLE);
		easing.current = { controls, target };
		controls.then(() => {
			if (easing.current?.controls !== controls) return;
			easing.current = null;
			if (outer.current) outer.current.style.overflowY = "";
		});
	};

	// Mode change: ease from the current height to the new content's.
	useLayoutEffect(() => {
		const element = inner.current;
		const from = height.get();
		if (!element) return;
		const next = element.offsetHeight;
		if (reducedRef.current || typeof from !== "number" || from === next) height.set(next);
		else ease(next);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- runs per mode; the ease helper only touches refs and the motion value
	}, [mode]);

	// Content resizing within a mode: follow directly, or retarget an ease that is still running.
	useLayoutEffect(() => {
		const element = inner.current;
		if (!element) return undefined;
		const observer = new ResizeObserver(() => {
			const next = element.offsetHeight;
			const running = easing.current;
			if (running) {
				if (running.target !== next) ease(next);
				return;
			}
			height.set(next);
		});
		observer.observe(element);
		return () => observer.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- one observer for the component's life
	}, []);

	return (
		<motion.div className={cn("shrink-0", className)} ref={outer} style={{ height }}>
			<div ref={inner}>{children}</div>
		</motion.div>
	);
}
