"use client";

/**
 * Slider examples — a value carried above the thumb on a spring, and two of them
 * on one track leaning apart rather than overlapping. Ported from torph's
 * `slider.tsx` (https://github.com/lochie/torph, MIT).
 *
 * Every transform here is written from the physics loop; the classes are the
 * rest state only. Upstream's haptics calls are omitted — VPK does not take the
 * `web-haptics` dependency.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import TextContinuity from "..";
import { useMotionLoop } from "../hooks";

const BRIGHTNESS = [72, 18, 94, 41, 63];

const MAX = 100;
const AUTOPLAY_MS = 1700;
const GLIDE = 0.09; // How much of the way to the next preset the value covers per frame

const THUMB = 18; // The input's own thumb is sized to match, so both map a pointer alike

// A bob on a spring pinned to the thumb: how far it trails is how far it leans.
const STIFFNESS = 0.16;
const DAMPING = 0.67;
const MAX_TILT = 28;
const SOFT = 30; // px of trail at one radian of tanh — past it the lean saturates

const thumbX = (value: number, width: number) => THUMB / 2 + (value / MAX) * Math.max(0, width - THUMB);

type Bob = { x: number; lag: number; vel: number };

const swing = (bob: Bob) => {
	bob.vel = (bob.vel + (bob.x - bob.lag) * STIFFNESS) * DAMPING;
	bob.lag += bob.vel;
};

const settled = (bob: Bob) => Math.abs(bob.vel) < 0.02 && Math.abs(bob.x - bob.lag) < 0.05;

const tiltOf = (bob: Bob) => MAX_TILT * Math.tanh((bob.lag - bob.x) / SOFT);
const stretchOf = (bob: Bob) => Math.min(Math.abs(bob.vel) * 0.006, 0.13);
const scaleXof = (stretch: number, squash: number) => (1 - stretch * 0.7) * (1 - squash);

const bubbleTransform = (tilt: number, stretch: number, squash = 0) =>
	`translateX(-50%) rotate(${tilt}deg) scale(${scaleXof(stretch, squash)}, ${1 + stretch})`;

const TAIL = 9; // px the tail hangs below the bubble — its tip is the pivot
const RADIUS = 14; // px of corner rounding on the bubble

type Box = { half: number; top: number; bottom: number };
type Pt = { x: number; y: number };

const boxOf = (bubble: HTMLElement, kx: number, ky: number): Box => ({
	half: (bubble.offsetWidth / 2) * kx,
	top: -(TAIL + bubble.offsetHeight) * ky,
	bottom: -TAIL * ky,
});

/**
 * The body's box inset by its corner radius: a rounded rectangle is that box
 * swept by a disc, so two of them meet arc to arc once the boxes are 2 radii
 * apart. Swung about the tail tip, which sits at `x`.
 */
function cornersOf(box: Box, tilt: number, x: number): Pt[] {
	const sin = Math.sin((tilt * Math.PI) / 180);
	const cos = Math.cos((tilt * Math.PI) / 180);
	const half = Math.max(box.half - RADIUS, 0);
	const at = (px: number, py: number) => ({ x: x + px * cos - py * sin, y: px * sin + py * cos });
	return [
		at(-half, box.top + RADIUS),
		at(half, box.top + RADIUS),
		at(half, box.bottom - RADIUS),
		at(-half, box.bottom - RADIUS),
	];
}

function spanOn(poly: readonly Pt[], nx: number, ny: number) {
	let min = Infinity;
	let max = -Infinity;
	for (const p of poly) {
		const d = p.x * nx + p.y * ny;
		min = Math.min(min, d);
		max = Math.max(max, d);
	}
	return { min, max };
}

function overlaps(a: readonly Pt[], b: readonly Pt[]): boolean {
	for (const poly of [a, b]) {
		for (let i = 0; i < 2; i += 1) {
			const p = poly[i]!;
			const q = poly[i + 1]!;
			const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
			const spanA = spanOn(a, (q.y - p.y) / len, (p.x - q.x) / len);
			const spanB = spanOn(b, (q.y - p.y) / len, (p.x - q.x) / len);
			if (spanB.min > spanA.max || spanA.min > spanB.max) return false;
		}
	}
	return true;
}

function edgeDist(v: Pt, p: Pt, q: Pt): number {
	const ex = q.x - p.x;
	const ey = q.y - p.y;
	const along = ex * ex + ey * ey;
	const t = along ? Math.min(Math.max(((v.x - p.x) * ex + (v.y - p.y) * ey) / along, 0), 1) : 0;
	return Math.hypot(v.x - p.x - t * ex, v.y - p.y - t * ey);
}

/**
 * Daylight between two leaning bodies, negative once they cross. Their closest
 * approach, not their horizontal extents: bodies tilted into a V meet on their
 * near corners, which the extents pass long before the corners are anywhere
 * near each other.
 */
function gapBetween(a: readonly Pt[], b: readonly Pt[]): number {
	let near = Infinity;
	for (const [poly, other] of [
		[a, b],
		[b, a],
	] as const) {
		for (const v of poly) {
			for (let i = 0; i < other.length; i += 1) {
				near = Math.min(near, edgeDist(v, other[i]!, other[(i + 1) % other.length]!));
			}
		}
	}
	return (overlaps(a, b) ? -near : near) - 2 * RADIUS;
}

const TRACK_CLASS = "relative h-1.5 w-full rounded-full bg-bg-neutral";
const FILL_CLASS = "absolute inset-0 origin-left rounded-[inherit] bg-primary";
const ANCHOR_CLASS = "pointer-events-none absolute left-0 top-1/2 size-0";
const THUMB_CLASS = "absolute left-0 top-0 size-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg-neutral-bold";
const VALUE_CLASS = "text-[1.375rem] font-bold leading-tight tabular-nums text-primary-foreground";

/**
 * Invisible, but its size is what maps a pointer to a value — the thumb has to
 * stay 18px to match `THUMB`.
 */
const INPUT_CLASS = cn(
	"absolute left-0 top-1/2 z-2 m-0 h-10 w-full -translate-y-1/2 cursor-ew-resize appearance-none bg-transparent p-0 opacity-0",
	"[&::-webkit-slider-thumb]:size-4.5 [&::-webkit-slider-thumb]:appearance-none",
	"[&::-moz-range-thumb]:size-4.5 [&::-moz-range-thumb]:border-0",
);

/** The pivot is the tail's tip, so the bubble swings from there. */
const BUBBLE_CLASS = cn(
	"absolute bottom-5 left-0 -translate-x-1/2 rounded-xl bg-primary px-3 py-1.5",
	"[transform-origin:50%_calc(100%+9px)]",
	// A square stood on its corner: the point is a rounded corner, not a border trick.
	"after:absolute after:left-1/2 after:top-full after:-z-1 after:size-4 after:rounded-br after:bg-primary after:content-['']",
	"after:[transform:translate(-50%,calc(-50%-2.3px))_scaleX(0.72)_rotate(45deg)]",
);

export function BubbleSlider() {
	const [value, setValue] = useState(BRIGHTNESS[0]!);
	const [taken, setTaken] = useState(false);
	const reduced = useReducedMotion();

	const trackRef = useRef<HTMLDivElement>(null);
	const fillRef = useRef<HTMLDivElement>(null);
	const anchorRef = useRef<HTMLDivElement>(null);
	const bubbleRef = useRef<HTMLDivElement>(null);

	const state = useRef({
		bob: { x: 0, lag: 0, vel: 0 },
		value: BRIGHTNESS[0]!,
		play: BRIGHTNESS[0]!,
		to: BRIGHTNESS[0]!,
		still: false,
		width: 0,
	});

	const wake = useMotionLoop(() => {
		const track = trackRef.current;
		const fill = fillRef.current;
		const anchor = anchorRef.current;
		const bubble = bubbleRef.current;
		if (!track || !fill || !anchor || !bubble) return null;

		const s = state.current;
		s.width = track.offsetWidth;
		s.bob.x = thumbX(s.play, s.width);
		s.bob.lag = s.bob.x;

		return {
			step: () => {
				// The value eases rather than cuts, so the thumb glides to the next
				// preset and the bob is thrown by the travel, not by the jump.
				s.play += (s.to - s.play) * GLIDE;
				if (s.still || Math.abs(s.to - s.play) < 0.05) s.play = s.to;
				s.bob.x = thumbX(s.play, s.width);
				swing(s.bob);

				if (s.still) {
					s.bob.lag = s.bob.x;
					s.bob.vel = 0;
					return false;
				}
				if (s.play !== s.to || !settled(s.bob)) return true;
				s.bob.lag = s.bob.x;
				s.bob.vel = 0;
				return false;
			},
			paint: () => {
				const shown = Math.round(s.play);
				if (shown !== s.value) {
					s.value = shown;
					setValue(shown);
				}

				anchor.style.transform = `translateX(${s.bob.x}px)`;
				bubble.style.transform = bubbleTransform(tiltOf(s.bob), stretchOf(s.bob));
				fill.style.transform = `scaleX(${s.width ? s.bob.x / s.width : 0})`;
			},
		};
	});

	useEffect(() => {
		state.current.still = Boolean(reduced);
		wake();
	}, [reduced, wake]);

	useEffect(() => {
		const track = trackRef.current;
		if (!track) return;

		const observer = new ResizeObserver(([entry]) => {
			const s = state.current;
			s.width = entry!.contentRect.width;
			s.bob.x = thumbX(s.play, s.width);
			// A reflow is not a drag — the bubble is carried, not thrown.
			s.bob.lag = s.bob.x;
			s.bob.vel = 0;
			wake();
		});
		observer.observe(track);

		return () => observer.disconnect();
	}, [wake]);

	useEffect(() => {
		if (taken || reduced) return;
		let step = 0;
		const id = window.setInterval(() => {
			step = (step + 1) % BRIGHTNESS.length;
			state.current.to = BRIGHTNESS[step]!;
			wake();
		}, AUTOPLAY_MS);
		return () => window.clearInterval(id);
	}, [taken, reduced, wake]);

	return (
		// Side padding is the bubble's half-width at either end of the track.
		<div className="w-full max-w-86 px-11 pb-2 pt-8">
			<div className={TRACK_CLASS} ref={trackRef}>
				<div className={FILL_CLASS} ref={fillRef} style={{ transform: "scaleX(0)" }} />

				<input
					className={cn(INPUT_CLASS, "peer")}
					type="range"
					min={0}
					max={MAX}
					value={value}
					aria-label="Value"
					aria-valuetext={`${value}%`}
					onChange={(event) => {
						const next = Number(event.target.value);
						const s = state.current;
						s.play = s.to = s.value = next;
						setTaken(true);
						setValue(next);
						wake();
					}}
				/>

				<div className={ANCHOR_CLASS} ref={anchorRef}>
					<span className={cn(THUMB_CLASS, "peer-focus-visible:ring-4 peer-focus-visible:ring-border-focused")} />
					<div className={BUBBLE_CLASS} ref={bubbleRef}>
						<TextContinuity className={VALUE_CLASS}>{`${value}%`}</TextContinuity>
					</div>
				</div>
			</div>
		</div>
	);
}

const SHOVE_GAP = 8; // Units held between the thumbs, so both stay grabbable

const SHOVE_PAD = 10; // px of closeness at which the pair start to squash
const SHOVE_CLEAR = 2; // px of daylight they hold once they meet
const SHOVE_LEAN = 90; // deg — however far it takes, up to lying flat on the tail
const SHOVE_STIFFNESS = 0.2;
const SHOVE_DAMPING = 0.62;

/**
 * Two thumbs on one track: only the thumbs take a pointer, or the upper input
 * swallows every press meant for the lower one.
 */
const SHOVE_INPUT_CLASS = cn(
	INPUT_CLASS,
	"pointer-events-none",
	"[&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto",
);

export function RangeShove() {
	const [range, setRange] = useState({ lo: 32, hi: 68 });
	const reduced = useReducedMotion();

	const trackRef = useRef<HTMLDivElement>(null);
	const fillRef = useRef<HTMLDivElement>(null);
	const loRef = useRef<HTMLDivElement>(null);
	const hiRef = useRef<HTMLDivElement>(null);
	const loBubbleRef = useRef<HTMLDivElement>(null);
	const hiBubbleRef = useRef<HTMLDivElement>(null);

	const state = useRef({
		lo: { x: 0, lag: 0, vel: 0 },
		hi: { x: 0, lag: 0, vel: 0 },
		shove: 0,
		shoveVel: 0,
		range: { lo: 32, hi: 68 },
		width: 0,
	});

	const wake = useMotionLoop(() => {
		const track = trackRef.current;
		const fill = fillRef.current;
		const lo = loRef.current;
		const hi = hiRef.current;
		const loBubble = loBubbleRef.current;
		const hiBubble = hiBubbleRef.current;
		if (!track || !fill || !lo || !hi || !loBubble || !hiBubble) return null;

		const s = state.current;
		s.width = track.offsetWidth;
		s.lo.x = s.lo.lag = thumbX(s.range.lo, s.width);
		s.hi.x = s.hi.lag = thumbX(s.range.hi, s.width);

		return {
			step: () => {
				swing(s.lo);
				swing(s.hi);

				// How pressed together the pair are, 0 to 1 — what lean and squash ride on.
				const need = (loBubble.offsetWidth + hiBubble.offsetWidth) / 2 + SHOVE_PAD;
				const target = Math.max(0, need - (s.hi.x - s.lo.x)) / need;
				s.shoveVel = (s.shoveVel + (target - s.shove) * SHOVE_STIFFNESS) * SHOVE_DAMPING;
				s.shove += s.shoveVel;

				return (
					!settled(s.lo) ||
					!settled(s.hi) ||
					Math.abs(s.shoveVel) > 0.001 ||
					Math.abs(target - s.shove) > 0.002
				);
			},
			paint: () => {
				const squash = Math.min(Math.max(s.shove, 0), 1) * 0.16;
				const loStretch = stretchOf(s.lo);
				const hiStretch = stretchOf(s.hi);
				const loSwing = tiltOf(s.lo);
				const hiSwing = tiltOf(s.hi);
				const loBox = boxOf(loBubble, scaleXof(loStretch, squash), 1 + loStretch);
				const hiBox = boxOf(hiBubble, scaleXof(hiStretch, squash), 1 + hiStretch);

				// Both tails stay pinned to their thumbs, so leaning further is the only
				// way out of an overlap. Monotonic in `lean`, so a bisection finds the
				// shallowest one that still leaves SHOVE_CLEAR between the bodies.
				const gapAt = (lean: number) =>
					gapBetween(cornersOf(loBox, loSwing - lean, s.lo.x), cornersOf(hiBox, hiSwing + lean, s.hi.x));

				let lean = 0;
				if (gapAt(0) < SHOVE_CLEAR) {
					let over = SHOVE_LEAN;
					for (let i = 0; i < 12; i += 1) {
						const mid = (lean + over) / 2;
						if (gapAt(mid) < SHOVE_CLEAR) lean = mid;
						else over = mid;
					}
					lean = over;
				}

				lo.style.transform = `translateX(${s.lo.x}px)`;
				hi.style.transform = `translateX(${s.hi.x}px)`;
				loBubble.style.transform = bubbleTransform(loSwing - lean, loStretch, squash);
				hiBubble.style.transform = bubbleTransform(hiSwing + lean, hiStretch, squash);
				fill.style.transform = `translateX(${s.lo.x}px) scaleX(${s.width ? (s.hi.x - s.lo.x) / s.width : 0})`;
			},
		};
	});

	useEffect(() => {
		const s = state.current;
		s.range = range;
		s.lo.x = thumbX(range.lo, s.width);
		s.hi.x = thumbX(range.hi, s.width);
		if (reduced) {
			s.lo.lag = s.lo.x;
			s.hi.lag = s.hi.x;
			s.lo.vel = s.hi.vel = 0;
		}
		wake();
	}, [range, reduced, wake]);

	useEffect(() => {
		const track = trackRef.current;
		if (!track) return;

		const observer = new ResizeObserver(([entry]) => {
			const s = state.current;
			s.width = entry!.contentRect.width;
			s.lo.x = s.lo.lag = thumbX(s.range.lo, s.width);
			s.hi.x = s.hi.lag = thumbX(s.range.hi, s.width);
			s.lo.vel = s.hi.vel = 0;
			wake();
		});
		observer.observe(track);

		return () => observer.disconnect();
	}, [wake]);

	const drag = (edge: "lo" | "hi") => (event: React.ChangeEvent<HTMLInputElement>) => {
		const next = Number(event.target.value);
		setRange((r) =>
			edge === "lo"
				? { lo: Math.min(next, r.hi - SHOVE_GAP), hi: r.hi }
				: { lo: r.lo, hi: Math.max(next, r.lo + SHOVE_GAP) },
		);
	};

	return (
		<div className="flex w-full max-w-86 flex-col items-center gap-5 px-11 pb-2 pt-8">
			<div className={TRACK_CLASS} ref={trackRef}>
				<div className={FILL_CLASS} ref={fillRef} style={{ transform: "scaleX(0)" }} />

				<input
					className={SHOVE_INPUT_CLASS}
					type="range"
					min={0}
					max={MAX - SHOVE_GAP}
					value={range.lo}
					aria-label="Minimum"
					aria-valuetext={`$${range.lo}`}
					onChange={drag("lo")}
				/>
				<input
					className={SHOVE_INPUT_CLASS}
					type="range"
					min={SHOVE_GAP}
					max={MAX}
					value={range.hi}
					aria-label="Maximum"
					aria-valuetext={`$${range.hi}`}
					onChange={drag("hi")}
				/>

				<div className={ANCHOR_CLASS} ref={loRef}>
					<span className={THUMB_CLASS} />
					<div className={BUBBLE_CLASS} ref={loBubbleRef}>
						<TextContinuity className={VALUE_CLASS}>{`$${range.lo}`}</TextContinuity>
					</div>
				</div>

				<div className={ANCHOR_CLASS} ref={hiRef}>
					<span className={THUMB_CLASS} />
					<div className={BUBBLE_CLASS} ref={hiBubbleRef}>
						<TextContinuity className={VALUE_CLASS}>{`$${range.hi}`}</TextContinuity>
					</div>
				</div>
			</div>
		</div>
	);
}
