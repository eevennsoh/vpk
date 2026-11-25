"use client";

import { animate, motion, useMotionValue, useReducedMotion, type Transition } from "motion/react";
import { useEffect } from "react";

import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** The TextReview ring spans 270°, from 6 o'clock clockwise to 3 o'clock. */
const RING_LENGTH = 0.75;
const RING_REST_ANGLE = 90;
const SPIN_SECONDS = 0.9;
/** How long the done choreography runs, so callers can sequence what follows it. */
export const SUGGESTIONS_ICON_RESOLVE_MS = 1050;

const CHECK_PATH = "M4.25 8 6.75 11 11.75 5";
const SPARKLE_PATH = "M13.115 10.009a.75.75 0 0 1 .541.378l.05.106.4 1.102c.051.138.16.248.3.299l1.1.4a.75.75 0 0 1 0 1.411l-1.1.401a.5.5 0 0 0-.3.3l-.4 1.1a.75.75 0 0 1-1.411 0l-.401-1.1a.5.5 0 0 0-.3-.3l-1.1-.4a.75.75 0 0 1-.485-.59L10 13l.009-.116a.75.75 0 0 1 .484-.59l1.102-.4a.5.5 0 0 0 .299-.3l.4-1.1.05-.107a.75.75 0 0 1 .655-.387z";
/** Glints thrown off the sparkle as it lands, pointing away from the check. */
const GLINTS = [-70, -20, 30, 80, 130].map((degrees) => {
	const radians = (degrees * Math.PI) / 180;
	return { degrees, x: Math.cos(radians) * 3.6, y: Math.sin(radians) * 3.6 };
});

type Phase = "loading" | "done";

/**
 * The suggestions icon (ADS TextReview) rebuilt from animatable parts. While loading, its ring is a lone arc that
 * spins and breathes; on done the arc carries its momentum into place and unfurls into the ring, the check writes
 * itself, and the sparkle twists in with a few glints. Mounting straight into "done" renders the still icon.
 */
export function SuggestionsStatusIcon({ state }: Readonly<{ state: Phase }>) {
	const reduced = useReducedMotion() ?? false;
	const rotate = useMotionValue(state === "loading" ? 0 : RING_REST_ANGLE);
	const arc = useMotionValue(state === "loading" ? 0.28 : RING_LENGTH);

	useEffect(() => {
		if (state === "loading") {
			// The spin is the loading feedback itself, so it keeps turning under reduced motion; only the breathing stops.
			const start = rotate.get();
			const spin = animate(rotate, [start, start + 360], { duration: SPIN_SECONDS, ease: motionEase.linear, repeat: Infinity });
			const breathe = reduced ? null : animate(arc, [0.18, 0.5], { duration: 1.15, ease: motionEase.inOut, repeat: Infinity, repeatType: "mirror" });
			return () => {
				spin.stop();
				breathe?.stop();
			};
		}
		if (reduced) {
			rotate.set(RING_REST_ANGLE);
			arc.set(RING_LENGTH);
			return undefined;
		}
		// Coast at least half a turn further, then settle the arc's tail exactly on 6 o'clock with a soft click.
		const from = rotate.get();
		const to = RING_REST_ANGLE + 360 * Math.ceil((from + 180 - RING_REST_ANGLE) / 360);
		const velocity = Math.min(Math.max(rotate.getVelocity(), 0), 800) || 360 / SPIN_SECONDS;
		const settle = animate(rotate, to, { type: "spring", velocity, visualDuration: 0.62, bounce: 0.24 });
		const unfurl = animate(arc, RING_LENGTH, { type: "spring", visualDuration: 0.5, bounce: 0.12, delay: 0.08 });
		return () => {
			settle.stop();
			unfurl.stop();
		};
	}, [state, reduced, rotate, arc]);

	const still: Transition = { duration: 0 };
	// Going back to loading (a re-check), the check, sparkle and glints clear at once, before the arc starts turning
	// through where they sit; the done timings' delays would leave them on screen under the spinning ring.
	const clear: Transition = reduced ? still : { duration: motionDuration.fast, ease: motionEase.in };
	const loading = state === "loading";
	const transitions = {
		body: reduced ? still : { duration: 0.62, times: [0, 0.38, 0.72, 1], ease: motionEase.inOut, delay: 0.12 },
		check: loading ? clear : reduced ? still : { pathLength: { duration: 0.32, ease: motionEase.out, delay: 0.34 }, opacity: { duration: 0.05, delay: 0.34 } },
		sparkle: loading ? clear : reduced ? still : { type: "spring" as const, visualDuration: 0.42, bounce: 0.5, delay: 0.56 },
		glint: (index: number): Transition => loading ? clear : reduced ? still : { duration: 0.48, ease: motionEase.out, delay: 0.64 + index * 0.015 },
	};

	return (
		<svg
			aria-hidden="true"
			className={cn("block size-4 overflow-visible transition-colors duration-slow ease-out", state === "loading" ? "text-icon-subtlest" : null)}
			data-state={state}
			fill="none"
			viewBox="0 0 16 16"
		>
			<motion.g
				animate={state}
				initial={false}
				style={{ willChange: "transform" }}
				transition={transitions.body}
				variants={{ loading: { scale: 1 }, done: { scale: [1, 0.88, 1.07, 1] } }}
			>
				<motion.circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" style={{ rotate, pathLength: arc }} />
				<motion.path
					animate={state}
					d={CHECK_PATH}
					initial={false}
					stroke="currentColor"
					strokeLinejoin="round"
					strokeWidth="1.5"
					transition={transitions.check}
					variants={{ loading: { pathLength: 0, opacity: 0 }, done: { pathLength: 1, opacity: 1 } }}
				/>
				<motion.path
					animate={state}
					d={SPARKLE_PATH}
					fill="currentColor"
					initial={false}
					style={{ willChange: "transform, opacity" }}
					transition={transitions.sparkle}
					variants={{ loading: { scale: 0, rotate: -120, opacity: 0 }, done: { scale: 1, rotate: 0, opacity: 1 } }}
				/>
				{GLINTS.map((glint, index) => (
					<motion.circle
						animate={state}
						cx="13"
						cy="13"
						fill="currentColor"
						initial={false}
						key={glint.degrees}
						r="0.6"
						style={{ willChange: "transform, opacity" }}
						transition={transitions.glint(index)}
						variants={{
							loading: { x: 0, y: 0, scale: 0, opacity: 0 },
							done: { x: [0, glint.x], y: [0, glint.y], scale: [0.4, 1, 0.2], opacity: [0, 1, 0] },
						}}
					/>
				))}
			</motion.g>
		</svg>
	);
}
