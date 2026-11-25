"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

import { Shimmer } from "@/components/ui/shimmer";
import { motionEase } from "@/lib/motion";

/** One turn of the head while loading, matching the shared spinner's pace. */
const TURN_SECONDS = 1.2;
/** How long the head takes to reach 12 o'clock, with the tail chasing it, once the recommendation lands. */
const FINISH_SECONDS = 0.6;

/**
 * A spinner that can finish. Head and tail are positions in turns from 12 o'clock, clockwise. While loading the head
 * turns steadily and the arc breathes; once `done`, no new arc starts: the head runs on to the next 12 o'clock and the
 * tail catches it there, the arc closing to nothing, and then `onDone` fires.
 */
function FinishingSpinner({ done, onDone }: Readonly<{ done: boolean; onDone: () => void }>) {
	const reduced = useReducedMotion() ?? false;
	const head = useMotionValue(0);
	const length = useMotionValue(0.12);
	const opacity = useMotionValue(1);
	const tail = useTransform(() => head.get() - length.get());
	const pathOffset = useTransform(() => ((tail.get() % 1) + 1) % 1);
	const finished = useRef(onDone);
	useEffect(() => { finished.current = onDone; });

	useEffect(() => {
		if (!done) {
			const start = head.get();
			const turn = animate(head, [start, start + 1], { duration: TURN_SECONDS, ease: motionEase.linear, repeat: Infinity });
			const breathe = reduced ? null : animate(length, [0.12, 0.62], { duration: TURN_SECONDS * 0.9, ease: motionEase.inOut, repeat: Infinity, repeatType: "mirror" });
			return () => { turn.stop(); breathe?.stop(); };
		}
		if (reduced) {
			finished.current();
			return undefined;
		}
		// The next 12 o'clock at least a quarter turn ahead, so the head always visibly carries on into it. A spring that
		// starts at the head's own speed (an eased tween would lurch forward first) brings it to rest there.
		const target = Math.ceil(head.get() + 0.25);
		const velocity = Math.min(Math.max(head.getVelocity(), 0), 2) || 1 / TURN_SECONDS;
		const run = animate(head, target, { type: "spring", velocity, visualDuration: FINISH_SECONDS, bounce: 0 });
		const close = animate(length, 0, { duration: FINISH_SECONDS, ease: motionEase.inOut });
		// The round caps leave a dot at zero length; let it go as the tail lands.
		const fade = animate(opacity, 0, { duration: FINISH_SECONDS * 0.3, delay: FINISH_SECONDS * 0.7, ease: motionEase.in });
		// Hand over once the arc has closed and faded; the spring's last imperceptible settling need not hold the slot.
		void Promise.all([close, fade]).then(() => finished.current());
		return () => { run.stop(); close.stop(); fade.stop(); };
	}, [done, reduced, head, length, opacity]);

	return (
		<svg aria-hidden className="size-4 -rotate-90" fill="none" viewBox="0 0 16 16">
			<motion.circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" style={{ pathLength: length, pathOffset, opacity }} />
		</svg>
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
				{/* The same sweep as an agent's Working label (JiraIssueAgentRowLabel), so in-progress states read alike. */}
				<Shimmer as="span" className="menu-row-title block min-w-0 flex-1 truncate text-text" duration={1.4} spread={2}>Recommending agent</Shimmer>
			</div>
		</div>
	);
}
