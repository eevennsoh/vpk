"use client";

import { useEffect, useRef } from "react";
import { animate, cubicBezier, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

import { Shimmer } from "@/components/ui/shimmer";
import { motionDuration, motionEase } from "@/lib/motion";

/** One loop of the shared Spinner (components/ui/spinner.tsx): its dash animation and its rotation both last 1.2s. */
const LOOP_SECONDS = 1.2;
/** The shared Spinner's keySplines, 0.4 0 0 1. */
const SPLINE = cubicBezier(...motionEase.inOut);
const RADIUS = 20;

/** The shared Spinner's arc at a point in its loop: the dash grows over the first half, then the tail sweeps onto the head. */
function arcAt(phase: number) {
	if (phase < 0.5) {
		const eased = SPLINE(phase / 0.5);
		return { dash: 1 + 88 * eased, offset: -35 * eased };
	}
	return { dash: 89, offset: -35 - 89 * SPLINE((phase - 0.5) / 0.5) };
}

/**
 * The shared Spinner, redrawn so it can stop. `loop` counts loops; each loop ends with the tail meeting the head at
 * 12 o'clock. While loading it runs forever; once `done`, the loop in progress runs on at the same speed to its end,
 * no new arc starts, the meeting point fades, and `onDone` fires.
 */
function FinishingSpinner({ done, onDone }: Readonly<{ done: boolean; onDone: () => void }>) {
	const reduced = useReducedMotion() ?? false;
	const loop = useMotionValue(0);
	const opacity = useMotionValue(1);
	// At a whole loop the arc has just closed, so read it as the end of that loop, not the start of the next.
	const phase = useTransform(() => { const value = loop.get(); const whole = Math.floor(value); return value > 0 && value === whole ? 1 : value - whole; });
	const strokeDasharray = useTransform(() => `${arcAt(phase.get()).dash} 200`);
	const strokeDashoffset = useTransform(() => arcAt(phase.get()).offset);
	const rotate = useTransform(() => phase.get() * 360);
	const finished = useRef(onDone);
	useEffect(() => { finished.current = onDone; });

	useEffect(() => {
		if (!done) {
			const start = loop.get();
			const run = animate(loop, [start, start + 1], { duration: LOOP_SECONDS, ease: motionEase.linear, repeat: Infinity });
			return () => run.stop();
		}
		const from = loop.get();
		const end = Math.ceil(from) === from ? from : Math.ceil(from);
		const remaining = reduced ? 0 : (end - from) * LOOP_SECONDS;
		const run = animate(loop, end, { duration: remaining, ease: motionEase.linear });
		let fade: ReturnType<typeof animate> | null = null;
		void run.then(() => {
			fade = animate(opacity, 0, { duration: reduced ? 0 : motionDuration.fast, ease: motionEase.in });
			return fade.then(() => finished.current());
		});
		return () => { run.stop(); fade?.stop(); };
	}, [done, reduced, loop, opacity]);

	return (
		<motion.svg aria-hidden className="size-4" fill="none" style={{ rotate, opacity }} viewBox="0 0 50 50">
			<motion.circle cx="25" cy="25" r={RADIUS} stroke="currentColor" strokeLinecap="round" strokeWidth="4" style={{ strokeDasharray, strokeDashoffset }} transform="rotate(-90 25 25)" />
		</motion.svg>
	);
}

/**
 * Holds the recommended agent's slot while the recommendation is worked out: a spinner where the avatar will be and
 * a shimmering label where its name will be, in the same row geometry, so the agent replaces it without a jump.
 * Once `done`, the spinner finishes its turn before `onDone` hands the slot to the agent.
 */
export function RecommendingAgentRow({ done, onDone }: Readonly<{ done: boolean; onDone: () => void }>) {
	return (
		<div className="rounded-lg" data-menu-row="" role="status">
			<div className="flex items-center gap-3 py-1.5 pr-1.5 pl-2">
				<span className="grid size-6 shrink-0 place-items-center text-icon-subtle">
					<FinishingSpinner done={done} onDone={onDone} />
				</span>
				{/* The same sweep as an agent's Working label (JiraIssueAgentRowLabel), on subtle text: a placeholder, not an agent yet. */}
				<Shimmer as="span" className="menu-row-title block min-w-0 flex-1 truncate text-text-subtle" duration={1.4} spread={2}>Recommending agent</Shimmer>
			</div>
		</div>
	);
}
