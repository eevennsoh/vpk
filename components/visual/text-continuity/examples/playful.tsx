"use client";

/**
 * Playful examples — a dial you flick, and a chip you pull. Ported from torph's
 * `playful.tsx` (https://github.com/lochie/torph, MIT). Upstream's haptics calls
 * are omitted; VPK does not take the `web-haptics` dependency.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import TextContinuity from "..";
import type { SpringEase } from "../data";
import { useMotionLoop } from "../hooks";
import { clamp, signed } from "../lib";
import { FOCUS_RING } from "./primitives";

// ── A dial you flick ──

const DIAL_MAX = 500;

const STEP_DEG = 7; // One unit of value per this much turn
const DIAL_SPAN = DIAL_MAX * STEP_DEG;
const FRICTION = 0.955;
const DETENT_VEL = 1.2; // Below this it stops coasting and homes to a notch
const DETENT_STIFFNESS = 0.22;
const DETENT_DAMPING = 0.6;
const BOUNCE = -0.4;
const FLICK = 26; // deg/frame, the nudge that shows a spin-down without a pointer

const pointerAngle = (event: React.PointerEvent, element: HTMLElement) => {
	const rect = element.getBoundingClientRect();
	return (
		(Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180) /
		Math.PI
	);
};

const DIAL_STEPS: Record<string, number> = {
	ArrowLeft: -1,
	ArrowDown: -1,
	ArrowRight: 1,
	ArrowUp: 1,
	PageDown: -25,
	PageUp: 25,
};

export function SpinDial({ duration, ease }: Readonly<{ duration?: number; ease?: string | SpringEase }>) {
	const [value, setValue] = useState(0);
	const reduced = useReducedMotion();

	const dialRef = useRef<HTMLDivElement>(null);
	const faceRef = useRef<HTMLDivElement>(null);

	const state = useRef({ angle: 0, vel: 0, grabbed: false, pointer: 0, value: 0, reduced: false });

	const wake = useMotionLoop(() => {
		const face = faceRef.current;
		if (!face) return null;
		const s = state.current;

		return {
			step: () => {
				if (s.grabbed) return true;

				if (s.reduced) {
					s.angle = clamp(Math.round(s.angle / STEP_DEG), 0, DIAL_MAX) * STEP_DEG;
					s.vel = 0;
					return false;
				}

				if (Math.abs(s.vel) > DETENT_VEL) {
					s.vel *= FRICTION;
					s.angle += s.vel;
					if (s.angle < 0 || s.angle > DIAL_SPAN) {
						s.angle = clamp(s.angle, 0, DIAL_SPAN);
						s.vel *= BOUNCE;
					}
					return true;
				}

				// Homing to the nearest notch is what makes a flick land rather than drift.
				const notch = clamp(Math.round(s.angle / STEP_DEG), 0, DIAL_MAX) * STEP_DEG;
				s.vel = (s.vel + (notch - s.angle) * DETENT_STIFFNESS) * DETENT_DAMPING;
				s.angle += s.vel;

				if (Math.abs(s.vel) < 0.01 && Math.abs(notch - s.angle) < 0.05) {
					s.angle = notch;
					s.vel = 0;
					return false;
				}
				return true;
			},
			paint: () => {
				face.style.transform = `rotate(${s.angle}deg)`;

				const next = clamp(Math.round(s.angle / STEP_DEG), 0, DIAL_MAX);
				if (next === s.value) return;
				s.value = next;
				setValue(next);
			},
		};
	});

	useEffect(() => {
		state.current.reduced = Boolean(reduced);
		if (reduced) return;
		state.current.vel = FLICK;
		wake();
	}, [reduced, wake]);

	const nudge = (units: number) => {
		const s = state.current;
		s.angle = clamp(s.value + units, 0, DIAL_MAX) * STEP_DEG;
		s.vel = 0;
		wake();
	};

	return (
		<div className="flex flex-col items-center gap-3.5">
			<div
				className={cn(
					"relative flex size-36 cursor-grab touch-none select-none items-center justify-center rounded-full border border-border bg-bg-neutral active:cursor-grabbing",
					FOCUS_RING,
				)}
				ref={dialRef}
				role="slider"
				tabIndex={0}
				aria-label="Goal"
				aria-valuemin={0}
				aria-valuemax={DIAL_MAX}
				aria-valuenow={value}
				aria-valuetext={`$${value}`}
				onKeyDown={(event) => {
					const step = DIAL_STEPS[event.key];
					if (step === undefined) return;
					event.preventDefault();
					nudge(step);
				}}
				onPointerDown={(event) => {
					const dial = dialRef.current;
					if (!dial) return;
					event.currentTarget.setPointerCapture(event.pointerId);
					const s = state.current;
					s.grabbed = true;
					s.pointer = pointerAngle(event, dial);
					s.vel = 0;
					wake();
				}}
				onPointerMove={(event) => {
					const dial = dialRef.current;
					const s = state.current;
					if (!dial || !s.grabbed) return;
					const angle = pointerAngle(event, dial);
					// atan2 wraps at ±180; the short way round is always the one turned.
					let delta = angle - s.pointer;
					if (delta > 180) delta -= 360;
					if (delta < -180) delta += 360;
					s.pointer = angle;
					s.angle = clamp(s.angle + delta, 0, DIAL_SPAN);
					s.vel = s.vel * 0.6 + delta * 0.4;
				}}
				onPointerUp={() => {
					state.current.grabbed = false;
					wake();
				}}
				onPointerCancel={() => {
					state.current.grabbed = false;
					wake();
				}}
			>
				{/* Ticks around the rim, so a turn reads even before the value changes. */}
				<div
					className="absolute inset-0 rounded-full after:absolute after:left-1/2 after:top-1.5 after:-ml-1 after:size-2 after:rounded-full after:bg-primary after:content-['']"
					ref={faceRef}
					style={{
						background:
							"repeating-conic-gradient(from 0deg, var(--ds-icon-subtlest) 0deg 0.7deg, transparent 0.7deg 6deg)",
						// `closest-side`, so the band is a ring on the rim rather than one cut by the corners.
						mask: "radial-gradient(circle closest-side, transparent 76%, #000 77%)",
					}}
				/>
				<TextContinuity
					ease={ease}
					duration={duration}
					className="relative text-[1.75rem] font-bold tabular-nums text-text"
				>{`$${value}`}</TextContinuity>
			</div>
		</div>
	);
}

// ── A chip you pull ──

const PULL_MIN = -199;
const PULL_MAX = 999;

const PULL_LIMIT = 74; // px of travel before the rubber band saturates
const PULL_RATE = 30; // units per second at a full pull
const PULL_STIFFNESS = 0.3;
const PULL_DAMPING = 0.55;
const HELLO = 34; // px of nudge on mount, so it wobbles without counting

const PULL_STEPS: Record<string, number> = {
	ArrowLeft: -1,
	ArrowDown: -1,
	ArrowRight: 1,
	ArrowUp: 1,
	PageDown: -25,
	PageUp: 25,
};

export function PullToCount() {
	const [value, setValue] = useState(0);
	const reduced = useReducedMotion();

	const chipRef = useRef<HTMLDivElement>(null);

	const state = useRef({ offset: 0, vel: 0, grabbed: false, from: 0, count: 0, value: 0, reduced: false });

	const wake = useMotionLoop(() => {
		const chip = chipRef.current;
		if (!chip) return null;
		const s = state.current;

		return {
			step: () => {
				if (s.grabbed) {
					// Quadratic, so a short pull stays precise and a long one flies.
					const pull = s.offset / PULL_LIMIT;
					s.count = clamp(s.count + (Math.sign(pull) * pull * pull * PULL_RATE) / 60, PULL_MIN, PULL_MAX);
					return true;
				}

				if (s.reduced) {
					s.offset = 0;
					s.vel = 0;
					return false;
				}

				s.vel = (s.vel - s.offset * PULL_STIFFNESS) * PULL_DAMPING;
				s.offset += s.vel;

				if (Math.abs(s.vel) < 0.05 && Math.abs(s.offset) < 0.1) {
					s.offset = 0;
					s.vel = 0;
					return false;
				}
				return true;
			},
			paint: () => {
				const t = Math.abs(s.offset) / PULL_LIMIT;
				chip.style.transform = `translateX(${s.offset}px) scale(${1 + t * 0.22}, ${1 - t * 0.13})`;

				const next = Math.round(s.count);
				if (next === s.value) return;
				s.value = next;
				setValue(next);
			},
		};
	});

	useEffect(() => {
		state.current.reduced = Boolean(reduced);
		if (reduced) return;
		state.current.offset = HELLO;
		wake();
	}, [reduced, wake]);

	const nudge = (units: number) => {
		const s = state.current;
		s.count = clamp(s.count + units, PULL_MIN, PULL_MAX);
		s.value = Math.round(s.count);
		setValue(s.value);
	};

	return (
		<div className="flex w-full max-w-80 flex-col items-center gap-4">
			<div className="relative flex h-14 w-full items-center justify-center">
				<div aria-hidden className="absolute inset-x-10 h-1 rounded-full bg-bg-neutral">
					<span className="absolute left-1/2 top-1/2 h-3.5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-icon-subtlest" />
				</div>

				<div
					className={cn(
						"relative cursor-grab touch-none select-none rounded-xl bg-primary px-4.5 py-2 active:cursor-grabbing",
						FOCUS_RING,
					)}
					ref={chipRef}
					role="spinbutton"
					tabIndex={0}
					aria-label="Quantity"
					aria-valuemin={PULL_MIN}
					aria-valuemax={PULL_MAX}
					aria-valuenow={value}
					onKeyDown={(event) => {
						const step = PULL_STEPS[event.key];
						if (step === undefined) return;
						event.preventDefault();
						nudge(step);
					}}
					onPointerDown={(event) => {
						event.currentTarget.setPointerCapture(event.pointerId);
						const s = state.current;
						s.grabbed = true;
						s.from = event.clientX - s.offset;
						s.vel = 0;
						s.count = s.value;
						wake();
					}}
					onPointerMove={(event) => {
						const s = state.current;
						if (!s.grabbed) return;
						const raw = event.clientX - s.from;
						// Rubber band: past the limit the pull keeps giving, the travel does not.
						s.offset = PULL_LIMIT * Math.tanh(raw / PULL_LIMIT);
					}}
					onPointerUp={() => {
						state.current.grabbed = false;
						wake();
					}}
					onPointerCancel={() => {
						state.current.grabbed = false;
						wake();
					}}
				>
					<TextContinuity className="text-center text-2xl font-bold tabular-nums text-primary-foreground">
						{signed(value)}
					</TextContinuity>
				</div>
			</div>
		</div>
	);
}
