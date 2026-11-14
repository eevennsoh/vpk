"use client";

/**
 * Gesture examples — a button you hold, a word that pops, and a tag that trails.
 * Ported from torph's `gestures.tsx` (https://github.com/lochie/torph, MIT).
 * Upstream's haptics calls are omitted; VPK does not take `web-haptics`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import TextContinuity from "..";
import { useMotionLoop } from "../hooks";
import { clamp } from "../lib";
import { FOCUS_RING } from "./primitives";

// ── A button you hold ──

const HOLD_STEPS = [
	{ at: 0, label: "Hold to Delete" },
	{ at: 0.12, label: "Holding to Delete" },
	{ at: 0.62, label: "Deleting" },
	{ at: 1, label: "Deleted" },
];

const HOLD_FRAMES = 200;
const HOLD_RELEASE = 0.14; // Progress lost per frame when let go early
const HOLD_REST = 70; // Frames it stays deleted before offering itself again
const HOLD_EVERY = 4600;

function holdLabel(progress: number): string {
	for (let i = HOLD_STEPS.length - 1; i >= 0; i -= 1) {
		if (progress >= HOLD_STEPS[i]!.at) return HOLD_STEPS[i]!.label;
	}
	return HOLD_STEPS[0]!.label;
}

/** A label that keeps up with the progress fill running under it. */
export function HoldToConfirm() {
	const [label, setLabel] = useState(HOLD_STEPS[0]!.label);
	const [taken, setTaken] = useState(false);
	const reduced = useReducedMotion();

	const buttonRef = useRef<HTMLButtonElement>(null);
	const fillRef = useRef<HTMLSpanElement>(null);

	const state = useRef({ progress: 0, press: 0, held: false, rest: 0, label: HOLD_STEPS[0]!.label });

	const wake = useMotionLoop(() => {
		const button = buttonRef.current;
		const fill = fillRef.current;
		if (!button || !fill) return null;
		const s = state.current;

		return {
			step: () => {
				s.press += ((s.held ? 1 : 0) - s.press) * 0.3;

				if (s.rest > 0) {
					s.rest -= 1;
					if (s.rest === 0) s.progress = 0;
					return true;
				}

				if (s.held) {
					s.progress = Math.min(1, s.progress + 1 / HOLD_FRAMES);
					// Done: it holds the outcome for a beat rather than snapping back.
					if (s.progress === 1) {
						s.held = false;
						s.rest = HOLD_REST;
					}
					return true;
				}

				s.progress = Math.max(0, s.progress - HOLD_RELEASE);
				return s.progress > 0 || s.press > 0.01;
			},
			paint: () => {
				button.style.transform = `scale(${1 - s.press * 0.04})`;
				fill.style.transform = `scaleX(${s.progress})`;

				const next = holdLabel(s.progress);
				if (next === s.label) return;
				s.label = next;
				setLabel(next);
			},
		};
	});

	useEffect(() => {
		if (taken || reduced) return;
		const id = window.setInterval(() => {
			state.current.held = true;
			wake();
		}, HOLD_EVERY);
		return () => window.clearInterval(id);
	}, [taken, reduced, wake]);

	const press = () => {
		const s = state.current;
		setTaken(true);
		if (s.rest > 0) return;
		s.held = true;
		wake();
	};

	const lift = () => {
		state.current.held = false;
		wake();
	};

	return (
		<button
			type="button"
			className={cn(
				"relative overflow-hidden rounded-xl bg-surface-raised px-6 py-3 touch-none select-none hover:bg-surface-raised-hovered",
				FOCUS_RING,
			)}
			ref={buttonRef}
			onPointerDown={(event) => {
				event.currentTarget.setPointerCapture(event.pointerId);
				press();
			}}
			onPointerUp={lift}
			onPointerCancel={lift}
			onPointerLeave={lift}
			onKeyDown={(event) => {
				if (event.key !== " " && event.key !== "Enter") return;
				event.preventDefault();
				press();
			}}
			onKeyUp={lift}
			onBlur={lift}
		>
			<span
				aria-hidden
				className="absolute inset-0 origin-left bg-bg-danger"
				ref={fillRef}
				style={{ transform: "scaleX(0)" }}
			/>
			<TextContinuity className="relative text-[0.9375rem] font-semibold text-text">{label}</TextContinuity>
		</button>
	);
}

// ── A word that pops ──

// One family, so every step has letters to hand over: Al, Al, Aig, Anig.
const RATINGS = [
	{ word: "Abysmal", tone: "var(--ds-text-danger)" },
	{ word: "Awful", tone: "var(--ds-text-accent-orange)" },
	{ word: "Alright", tone: "var(--ds-text-warning)" },
	{ word: "Amazing", tone: "var(--ds-text-information)" },
	{ word: "Astonishing", tone: "var(--ds-text-success)" },
];

const LAST = RATINGS.length - 1;
const START = 2;

const POP_KICK = 0.9;
const POP_STIFFNESS = 0.24;
const POP_DAMPING = 0.58;
const WORD_GAP = 26; // px from the centre of the face to the word
const MOUTH_GLIDE = 0.16; // Share of the way to the new expression the mouth covers per frame
const MOUTH_BEND = 4.4; // viewBox units the middle of the mouth travels either side of flat
const RATE_EVERY = 1800;

const mouthPath = (mood: number) => `M7.8 15.2Q12 ${(15.2 + (mood * 2 - 1) * MOUTH_BEND).toFixed(2)} 16.2 15.2`;

export function RatingSlider() {
	const [rating, setRating] = useState(START);
	const [taken, setTaken] = useState(false);
	const reduced = useReducedMotion();

	const faceRef = useRef<HTMLSpanElement>(null);
	const mouthRef = useRef<SVGPathElement>(null);
	const railRef = useRef<HTMLDivElement>(null);
	const wordRef = useRef<HTMLSpanElement>(null);
	const dotsRef = useRef<(HTMLSpanElement | null)[]>([]);
	const state = useRef({ pop: 0, vel: 0, mood: START / LAST, curve: START / LAST, reduced: false });

	const wake = useMotionLoop(() => {
		const face = faceRef.current;
		const mouth = mouthRef.current;
		if (!face || !mouth) return null;
		const s = state.current;

		return {
			step: () => {
				if (s.reduced) {
					s.pop = s.vel = 0;
					s.curve = s.mood;
					return false;
				}
				s.vel = (s.vel - s.pop * POP_STIFFNESS) * POP_DAMPING;
				s.pop += s.vel;
				s.curve += (s.mood - s.curve) * MOUTH_GLIDE;
				if (Math.abs(s.vel) < 0.002 && Math.abs(s.pop) < 0.002 && Math.abs(s.mood - s.curve) < 0.001) {
					s.pop = 0;
					s.vel = 0;
					s.curve = s.mood;
					return false;
				}
				return true;
			},
			paint: () => {
				face.style.transform = `translate(-50%, -50%) scale(${1 + s.pop * 0.22}) rotate(${s.pop * 5}deg)`;
				mouth.setAttribute("d", mouthPath(s.curve));
			},
		};
	});

	const choose = useCallback(
		(next: number) => {
			const s = state.current;
			// Kicked in the direction of travel, so a slide up and a slide down differ.
			s.vel = POP_KICK * (next > rating ? 0.1 : -0.1);
			s.pop = POP_KICK * 0.25;
			s.mood = next / LAST;
			setRating(next);
			wake();
		},
		[rating, wake],
	);

	useEffect(() => {
		state.current.reduced = Boolean(reduced);
	}, [reduced]);

	useEffect(() => {
		if (taken || reduced) return;
		const id = window.setInterval(() => choose((rating + 1) % RATINGS.length), RATE_EVERY);
		return () => window.clearInterval(id);
	}, [taken, reduced, rating, choose]);

	const side = rating > LAST / 2 ? "left" : "right";

	// A long word reaches past its neighbour, so the dots it covers yield as it grows.
	useEffect(() => {
		const rail = railRef.current;
		const word = wordRef.current;
		if (!rail || !word) return;

		const sync = () => {
			const step = rail.clientWidth / LAST;
			const reach = WORD_GAP + word.offsetWidth;
			dotsRef.current.forEach((dot, i) => {
				const away = (i - rating) * (side === "right" ? 1 : -1);
				dot?.setAttribute("data-covered", String(away === 0 || (away > 0 && away * step < reach)));
			});
		};

		const observer = new ResizeObserver(sync);
		observer.observe(word);
		observer.observe(rail);
		return () => observer.disconnect();
	}, [rating, side]);

	const { word, tone } = RATINGS[rating]!;

	return (
		<div className="relative h-9 w-full max-w-64 rounded-full bg-surface-sunken">
			<input
				className={cn(
					"peer absolute inset-x-0 -inset-y-1 z-2 m-0 w-full cursor-ew-resize appearance-none bg-transparent p-0 opacity-0",
					"[&::-webkit-slider-thumb]:size-11 [&::-webkit-slider-thumb]:appearance-none",
					"[&::-moz-range-thumb]:size-11 [&::-moz-range-thumb]:border-0",
				)}
				type="range"
				min={0}
				max={LAST}
				value={rating}
				aria-label="Rating"
				aria-valuetext={word}
				onChange={(event) => {
					const next = Number(event.target.value);
					setTaken(true);
					if (next !== rating) choose(next);
				}}
			/>

			{/* Inset by half a face, so the end stops sit flush with the ends of the pill. */}
			<div className="absolute inset-y-0 inset-x-5.5" ref={railRef}>
				{RATINGS.map((entry, i) => (
					<span
						key={entry.word}
						aria-hidden
						className={cn(
							"absolute top-1/2 size-1.75 -translate-x-1/2 -translate-y-1/2 rounded-full bg-icon-subtlest opacity-50",
							// Delayed, so a dot waits for the word to clear it.
							"transition-opacity duration-slow ease-out [transition-delay:140ms] motion-reduce:transition-none",
							"data-[covered=true]:opacity-0 data-[covered=true]:duration-normal data-[covered=true]:[transition-delay:0ms]",
						)}
						style={{ left: `${(i / LAST) * 100}%` }}
						ref={(el) => {
							dotsRef.current[i] = el;
						}}
					/>
				))}

				<span
					className="absolute top-1/2 transition-[left] duration-[460ms] ease-[cubic-bezier(0.34,1.28,0.5,1)] motion-reduce:transition-none"
					style={{ left: `${(rating / LAST) * 100}%` }}
					data-side={side}
				>
					<span
						className={cn(
							"absolute left-0 top-1/2 text-base font-bold",
							"transition-[color,transform] duration-[460ms] ease-[cubic-bezier(0.34,1.28,0.5,1)] motion-reduce:transition-none",
							side === "right" ? "translate-x-6.5 -translate-y-1/2" : "-translate-y-1/2 [transform:translate(calc(-1.625rem_-_100%),-50%)]",
						)}
						ref={wordRef}
						style={{ color: tone }}
					>
						<TextContinuity>{word}</TextContinuity>
					</span>

					<span
						className={cn(
							"absolute left-0 top-1/2 z-1 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full",
							"transition-[background] duration-slower ease-out motion-reduce:transition-none",
							"peer-focus-visible:ring-[3px] peer-focus-visible:ring-border-focused",
						)}
						ref={faceRef}
						style={{ background: tone }}
					>
						<svg viewBox="0 0 24 24" aria-hidden className="block size-full">
							<circle cx="8.8" cy="9.4" r="1.5" fill="var(--ds-surface)" />
							<circle cx="15.2" cy="9.4" r="1.5" fill="var(--ds-surface)" />
							<path
								ref={mouthRef}
								d={mouthPath(rating / LAST)}
								fill="none"
								stroke="var(--ds-surface)"
								strokeWidth="1.7"
								strokeLinecap="round"
							/>
						</svg>
					</span>
				</span>
			</div>
		</div>
	);
}

// ── A tag that trails ──

const ZONES = ["North End", "The Harbour", "Old Town", "Riverside", "The Docks", "Hillside"];

const COLS = 3;
const TAG_STIFFNESS = 0.18;
const TAG_DAMPING = 0.66;
const TAG_TILT = 26;
const TAG_SOFT = 34;
const HANG = 8; // px the tag hangs below the point it chases — its string
const EDGE = 6;
const DRIFT = 0.011; // Radians per frame of the path it walks on its own

export function TrailingTag() {
	const [zone, setZone] = useState(0);
	const [taken, setTaken] = useState(false);
	const reduced = useReducedMotion();

	const fieldRef = useRef<HTMLDivElement>(null);
	const tagRef = useRef<HTMLDivElement>(null);

	const state = useRef({
		x: 0,
		y: 0,
		tx: 0,
		ty: 0,
		vx: 0,
		vy: 0,
		phase: 0,
		taken: false,
		zone: 0,
		size: { w: 0, h: 0 },
	});

	const wake = useMotionLoop(() => {
		const field = fieldRef.current;
		const tag = tagRef.current;
		if (!field || !tag) return null;

		const s = state.current;
		s.size = { w: field.clientWidth, h: field.clientHeight };
		s.tx = s.x = s.size.w / 2;
		s.ty = s.y = s.size.h / 2;

		return {
			step: () => {
				if (!s.taken) {
					// A slow lissajous, so it visits every zone without repeating a loop.
					s.phase += DRIFT;
					s.tx = s.size.w * (0.5 + 0.36 * Math.sin(s.phase));
					s.ty = s.size.h * (0.5 + 0.3 * Math.sin(s.phase * 1.7));
				}

				s.vx = (s.vx + (s.tx - s.x) * TAG_STIFFNESS) * TAG_DAMPING;
				s.vy = (s.vy + (s.ty - s.y) * TAG_STIFFNESS) * TAG_DAMPING;
				s.x += s.vx;
				s.y += s.vy;

				if (!s.taken) return true;
				return (
					Math.abs(s.vx) > 0.02 ||
					Math.abs(s.vy) > 0.02 ||
					Math.abs(s.tx - s.x) > 0.05 ||
					Math.abs(s.ty - s.y) > 0.05
				);
			},
			paint: () => {
				const tilt = TAG_TILT * Math.tanh(-s.vx / TAG_SOFT);
				// Kept inside the field, the way a tooltip stays on screen at an edge.
				const half = tag.offsetWidth / 2;
				const x = clamp(s.x, half + EDGE, Math.max(half + EDGE, s.size.w - half - EDGE));
				const y = clamp(s.y, 0, Math.max(0, s.size.h - tag.offsetHeight - HANG - EDGE));
				tag.style.transform = `translate(${x}px, ${y}px) translateX(-50%) translateY(${HANG}px) rotate(${tilt}deg)`;

				const col = clamp(Math.floor((s.tx / s.size.w) * COLS), 0, COLS - 1);
				const row = clamp(Math.floor((s.ty / s.size.h) * 2), 0, 1);
				const next = row * COLS + col;
				if (next === s.zone) return;
				s.zone = next;
				setZone(next);
			},
		};
	});

	useEffect(() => {
		const field = fieldRef.current;
		if (!field) return;
		const observer = new ResizeObserver(([entry]) => {
			state.current.size = { w: entry!.contentRect.width, h: entry!.contentRect.height };
			wake();
		});
		observer.observe(field);
		return () => observer.disconnect();
	}, [wake]);

	useEffect(() => {
		state.current.taken = taken || Boolean(reduced);
		wake();
	}, [taken, reduced, wake]);

	const follow = (event: React.PointerEvent) => {
		const field = fieldRef.current;
		if (!field) return;
		const rect = field.getBoundingClientRect();
		const s = state.current;
		setTaken(true);
		s.taken = true;
		s.tx = clamp(event.clientX - rect.left, 0, rect.width);
		s.ty = clamp(event.clientY - rect.top, 0, rect.height);
		wake();
	};

	return (
		<div
			className="relative grid h-36 w-full max-w-88 cursor-crosshair touch-none grid-cols-3 grid-rows-2 overflow-hidden rounded-xl border border-border bg-surface-sunken"
			ref={fieldRef}
			onPointerMove={follow}
			onPointerDown={follow}
		>
			{ZONES.map((name) => (
				<span
					key={name}
					aria-hidden
					className="flex items-center justify-center text-[0.6875rem] font-medium text-text-subtlest inset-ring inset-ring-border"
				>
					{name}
				</span>
			))}

			{/* Hung from the point it is following, so a sideways move swings it. */}
			<div
				className="pointer-events-none absolute left-0 top-0 rounded-lg bg-primary px-2.5 py-1.5 [transform-origin:50%_-8px] before:absolute before:bottom-full before:left-1/2 before:h-2 before:w-px before:bg-primary before:content-['']"
				ref={tagRef}
			>
				<TextContinuity className="text-[0.8125rem] font-bold text-primary-foreground">{ZONES[zone]!}</TextContinuity>
			</div>
		</div>
	);
}
