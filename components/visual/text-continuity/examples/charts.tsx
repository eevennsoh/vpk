"use client";

/**
 * Chart examples — a readout scrubbed by pointer, and one sampled faster than
 * the morph completes. Ported from torph's `chart.tsx` and `ticker.tsx`
 * (https://github.com/lochie/torph, MIT).
 */

import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import TextContinuity from "..";
import { SETTLE_SPRING } from "../data";
import { clamp } from "../lib";
import { Caption, FOCUS_RING } from "./primitives";

// ── Scrub a chart ──

// Climbs and dips, so the scrub has something to do at every place value.
const CHART_DATA = [
	{ month: "January", value: 4120 },
	{ month: "February", value: 3840 },
	{ month: "March", value: 5230 },
	{ month: "April", value: 4780 },
	{ month: "May", value: 6150 },
	{ month: "June", value: 5890 },
	{ month: "July", value: 7240 },
	{ month: "August", value: 6870 },
	{ month: "September", value: 7590 },
	{ month: "October", value: 8120 },
	{ month: "November", value: 7430 },
	{ month: "December", value: 9210 },
];

const CHART_MAX = Math.max(...CHART_DATA.map((d) => d.value));
const CHART_LAST = CHART_DATA.length - 1;

/** Autoplays until touched, then hands over rather than fighting the pointer. */
export function Chart() {
	const [active, setActive] = useState(CHART_LAST);
	const [taken, setTaken] = useState(false);
	const reduced = useReducedMotion();

	useEffect(() => {
		if (taken || reduced) return;
		const id = window.setInterval(() => setActive((i) => (i + 1) % CHART_DATA.length), 1100);
		return () => window.clearInterval(id);
	}, [taken, reduced]);

	const scrub = (clientX: number, element: HTMLElement) => {
		const rect = element.getBoundingClientRect();
		setTaken(true);
		setActive(clamp(Math.floor(((clientX - rect.left) / rect.width) * CHART_DATA.length), 0, CHART_LAST));
	};

	const step = (delta: number) => {
		setTaken(true);
		setActive((i) => clamp(i + delta, 0, CHART_LAST));
	};

	const onKeyDown = (event: React.KeyboardEvent) => {
		const handlers: Record<string, () => void> = {
			ArrowLeft: () => step(-1),
			ArrowRight: () => step(1),
			ArrowDown: () => step(-1),
			ArrowUp: () => step(1),
			Home: () => {
				setTaken(true);
				setActive(0);
			},
			End: () => {
				setTaken(true);
				setActive(CHART_LAST);
			},
		};

		const handler = handlers[event.key];
		if (!handler) return;
		event.preventDefault();
		handler();
	};

	const current = CHART_DATA[active]!;

	return (
		<div className="flex w-full flex-col justify-between gap-5 p-5">
			<div className="flex flex-col items-start">
				<div className="text-[1.75rem] font-semibold leading-tight text-text">
					<TextContinuity ease={SETTLE_SPRING}>{`$${current.value.toLocaleString("en")}`}</TextContinuity>
				</div>
				<Caption>
					<TextContinuity duration={100}>{`${current.month} revenue`}</TextContinuity>
				</Caption>
			</div>

			<div
				className={cn("flex h-14 cursor-ew-resize items-end gap-[3px] rounded-sm", FOCUS_RING)}
				role="slider"
				tabIndex={0}
				aria-label="Month"
				aria-valuemin={0}
				aria-valuemax={CHART_LAST}
				aria-valuenow={active}
				aria-valuetext={`${current.month}, $${current.value.toLocaleString("en")}`}
				onKeyDown={onKeyDown}
				onPointerDown={(e) => scrub(e.clientX, e.currentTarget)}
				// Touch drags belong to the page scroller; a finger selects on tap.
				onPointerMove={(e) => {
					if (e.pointerType === "touch") return;
					scrub(e.clientX, e.currentTarget);
				}}
			>
				{CHART_DATA.map((item, i) => (
					<span
						key={item.month}
						aria-hidden
						className={cn(
							"min-w-0 flex-1 rounded-t-xs transition-colors duration-normal ease-out-practical motion-reduce:transition-none",
							i === active ? "bg-bg-neutral-bold" : "bg-bg-neutral",
						)}
						style={{ height: `${(item.value / CHART_MAX) * 100}%` }}
					/>
				))}
			</div>
		</div>
	);
}

// ── A live ticker ──

const BASELINE = 7240;

const WINDOW = 20; // Slots across the visible box
const POINTS = WINDOW + 2; // A spare at each end: the sample arriving, the one leaving
const SLOT = 100 / WINDOW; // viewBox units per slot
const SLOT_MS = 420; // One slot's travel — the scroll speed, and the sampling rate

// A shape rather than random values, so server and first client render agree.
const SEED = Array.from({ length: POINTS }, (_, i) =>
	Math.round(BASELINE + Math.sin(i / 2.4) * 620 + Math.sin(i / 1.1) * 260),
);

const compact = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${Math.round(value)}`);
const percent = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

/** A Catmull-Rom spline: at this size a corner per sample reads as noise. */
function spark(values: readonly number[], min: number, max: number): string {
	const span = max - min || 1;
	const y = (i: number) => 30 - ((values[clamp(i, 0, values.length - 1)]! - min) / span) * 28;

	let d = `M0 ${y(0).toFixed(2)}`;

	for (let i = 0; i < values.length - 1; i += 1) {
		const x = i * SLOT;
		// Spacing is uniform, so only the control points' heights vary.
		const c1 = y(i) + (y(i + 1) - y(i - 1)) / 6;
		const c2 = y(i + 1) - (y(i + 2) - y(i)) / 6;

		d +=
			` C${(x + SLOT / 3).toFixed(2)} ${c1.toFixed(2)}` +
			` ${(x + (SLOT * 2) / 3).toFixed(2)} ${c2.toFixed(2)}` +
			` ${(x + SLOT).toFixed(2)} ${y(i + 1).toFixed(2)}`;
	}

	return d;
}

/** Fraction of the remaining distance to cover in `dt`ms, at time constant `tau`. */
const chase = (dt: number, tau: number) => 1 - Math.exp(-dt / tau);

/** Closed back along the baseline, for the wash underneath. */
const area = (line: string) => `${line} L${((POINTS - 1) * SLOT).toFixed(2)} 32 L0 32 Z`;

/** Least-squares slope across the window, as a fraction of the drawn height. */
function trend(values: readonly number[], min: number, max: number): number {
	const mid = (values.length - 1) / 2;
	let num = 0;
	let den = 0;

	for (let i = 0; i < values.length; i += 1) {
		num += (i - mid) * values[i]!;
		den += (i - mid) ** 2;
	}

	return ((num / den) * (values.length - 1)) / (max - min || 1);
}

const TREND_GAIN = 1.6; // Slope worth full colour, set from the walk's spread

/** Through the surface colour, not straight across — red to green passes through mud. */
function tint(value: number): string {
	const to = value > 0 ? "var(--ds-text-success)" : "var(--ds-text-danger)";
	const k = Math.min(Math.abs(value) * TREND_GAIN, 1);
	return `color-mix(in srgb, ${to} ${(k * 100).toFixed(1)}%, var(--ds-text-subtlest))`;
}

const SEED_MIN = Math.min(...SEED);
const SEED_MAX = Math.max(...SEED);
const SEED_LINE = spark(SEED, SEED_MIN, SEED_MAX);
const SEED_TINT = tint(trend(SEED, SEED_MIN, SEED_MAX));

/**
 * The sample interval is shorter than the default morph duration on purpose:
 * each update lands on the morph before it and picks up from where it got to.
 */
export function Ticker() {
	const [stats, setStats] = useState({ requests: BASELINE, change: 12.4 });
	const reduced = useReducedMotion();
	// Legal in a fragment reference, but not for anything reading it as a selector.
	const fillId = useId().replace(/:/gu, "");

	const groupRef = useRef<SVGGElement>(null);
	const lineRef = useRef<SVGPathElement>(null);
	const areaRef = useRef<SVGPathElement>(null);
	// Set directly, not via currentColor — that has a history of not repainting.
	const washTopRef = useRef<SVGStopElement>(null);
	const washFootRef = useRef<SVGStopElement>(null);

	// Not React state: re-rendering the card every frame would drag both morphs.
	const chart = useRef({
		values: [...SEED],
		value: BASELINE,
		min: SEED_MIN,
		max: SEED_MAX,
		samples: 0,
		trend: trend(SEED, SEED_MIN, SEED_MAX),
	});

	useEffect(() => {
		if (reduced) return;

		let frame = 0;
		let last = performance.now();
		let carry = 0;
		let drift = 0;
		let changeDrift = 0;
		let painted = ""; // Three attributes ride on this: cheaper to compare than write

		const sample = () => {
			const state = chart.current;

			// Most of the last step carries into this one, so the series moves in
			// runs rather than reversing every sample and drawing a zigzag.
			drift = drift * 0.72 + (Math.random() - 0.5) * 0.02;

			state.value = Math.max(
				950,
				Math.round(
					state.value * (1 + drift) +
						// Pulled back to the baseline, so the series wanders inside a band.
						(BASELINE - state.value) * 0.04,
				),
			);
			state.values = [...state.values.slice(1), state.value];
			state.samples += 1;

			// Half the rate: a figure changing every 420ms is unreadable.
			if (state.samples % 2 === 0) {
				// Smoothed twice, so the value arcs and actually crosses zero — the
				// sign flipping under the morph is the half of this stat worth watching.
				changeDrift = changeDrift * 0.8 + (Math.random() - 0.5) * 1.6;
				setStats((prev) => ({ requests: state.value, change: prev.change * 0.9 + changeDrift }));
			}
		};

		const draw = (now: number) => {
			const state = chart.current;
			// Clamped so a backgrounded tab does not resume with one enormous step.
			const dt = Math.min(now - last, 64);
			carry += now - last;
			last = now;

			while (carry >= SLOT_MS) {
				carry -= SLOT_MS;
				sample();
			}

			const lo = Math.min(...state.values);
			const hi = Math.max(...state.values);

			// Outward briskly, inward gently. The new sample spends a slot beyond the
			// right edge before it is visible, so easing outward cannot clip the line.
			state.min += (lo - state.min) * chase(dt, lo < state.min ? 140 : 800);
			state.max += (hi - state.max) * chase(dt, hi > state.max ? 140 : 800);

			// Eased too: stepping the tint once a sample would read as a flicker.
			state.trend += (trend(state.values, state.min, state.max) - state.trend) * chase(dt, 500);

			const next = tint(state.trend);

			if (next !== painted) {
				painted = next;
				lineRef.current?.setAttribute("stroke", next);
				washTopRef.current?.setAttribute("stop-color", next);
				washFootRef.current?.setAttribute("stop-color", next);
			}

			const line = spark(state.values, state.min, state.max);
			lineRef.current?.setAttribute("d", line);
			areaRef.current?.setAttribute("d", area(line));

			// Linear. A landing sample shifts the array left as this resets, on the
			// same frame — the two cancel exactly, so the scroll has no seam.
			groupRef.current?.setAttribute("transform", `translate(${(-(carry / SLOT_MS) * SLOT).toFixed(3)} 0)`);

			frame = window.requestAnimationFrame(draw);
		};

		frame = window.requestAnimationFrame(draw);
		return () => window.cancelAnimationFrame(frame);
	}, [reduced]);

	return (
		<div className="flex w-full flex-col gap-4 p-6">
			<svg className="block h-13 w-full" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden>
				<defs>
					<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
						<stop ref={washTopRef} offset="0%" stopColor={SEED_TINT} stopOpacity="0.14" />
						<stop ref={washFootRef} offset="100%" stopColor={SEED_TINT} stopOpacity="0" />
					</linearGradient>
				</defs>

				{/* Clipped at both ends, so a new sample scrolls in rather than appearing. */}
				<g ref={groupRef} transform="translate(0 0)">
					<path ref={areaRef} d={area(SEED_LINE)} fill={`url(#${fillId})`} />
					<path
						ref={lineRef}
						d={SEED_LINE}
						fill="none"
						stroke={SEED_TINT}
						// Under this the tint reads closer to grey than to either colour.
						strokeOpacity={0.7}
						strokeWidth={1.5}
						strokeLinecap="round"
						strokeLinejoin="round"
						// The viewBox is stretched, so the stroke reads thinner across than down.
						vectorEffect="non-scaling-stroke"
					/>
				</g>
			</svg>

			<div className="flex items-end justify-between">
				<div className="flex flex-col items-start">
					<div className="text-[1.75rem] font-semibold leading-tight text-text">
						<TextContinuity>{compact(stats.requests)}</TextContinuity>
					</div>
					<Caption>Requests / min</Caption>
				</div>

				{/* Anchored to its own edge, so a value changing width doesn't shove the pair. */}
				<div className="flex flex-col items-end text-right">
					<div
						className={cn(
							"text-[1.75rem] font-semibold leading-tight",
							stats.change < 0 ? "text-text-danger" : "text-text-success",
						)}
					>
						<TextContinuity ease={SETTLE_SPRING}>{percent(stats.change)}</TextContinuity>
					</div>
					<Caption>vs. last week</Caption>
				</div>
			</div>
		</div>
	);
}
