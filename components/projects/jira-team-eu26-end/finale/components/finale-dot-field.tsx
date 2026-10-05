"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import type { FinaleFieldRipple, FinaleFit, FinaleViewport } from "../lib/finale-card-motion";
import { clamp } from "../lib/finale-math";
import { useFinaleFrame } from "../hooks/use-finale-frame";

/**
 * Signature dot grid (dots only, no connecting lines), contained inside each
 * tile. It has no resting state: as a tile touches down, the lattice pulses
 * out from the tile's centre — a ring and a softer echo ring, each born at the
 * centre and fading as it spreads to the tile's edges — and is spent before
 * the tile's logo and heading build. Stage-pixel values, scaled with the type.
 */
const FIELD = {
	gap: 60,
	dotRadius: 0.9,
	maxDotRadius: 1.4,
	maxOpacity: 0.55,
	rippleSpeed: 700,
	rippleWidth: 46,
	/** The echo ring follows the first one out from the centre. */
	echoDelay: 0.16,
	echoStrength: 0.55,
	/** The whole pulse is over before the tile's content starts to build. */
	lifetime: 0.8,
	/** ADS dark navy: darker than the neutral ink, still quiet. */
	ink: "9, 30, 66",
} as const;

const ALPHA_STEPS = 32;
/** One fill per alpha step: dots are batched by step, so a pulse is a few fills, not one per dot. */
const FILLS = Array.from({ length: ALPHA_STEPS + 1 }, (_, step) => `rgba(${FIELD.ink}, ${((step / ALPHA_STEPS) * FIELD.maxOpacity).toFixed(4)})`);

/** The lit dots of one pulse, kept between frames so a stream of landings allocates nothing. */
interface Lattice {
	readonly xs: Float64Array;
	readonly ys: Float64Array;
	readonly sizes: Float64Array;
	readonly steps: Uint8Array;
	readonly used: Uint8Array;
}

function lattice(capacity: number): Lattice {
	return { xs: new Float64Array(capacity), ys: new Float64Array(capacity), sizes: new Float64Array(capacity), steps: new Uint8Array(capacity), used: new Uint8Array(ALPHA_STEPS + 1) };
}

/** Empty until the first pulse, which grows a lattice to fit its tile. */
const NO_DOTS = lattice(0);

function pulsing(ripple: FinaleFieldRipple, time: number): boolean {
	return time >= ripple.start && time < ripple.start + FIELD.lifetime;
}

/** One tile's pulse at `time`, clipped to the tile. */
function paintPulse(context: CanvasRenderingContext2D, dots: Lattice, ripple: FinaleFieldRipple, time: number, scale: number, radius: number): Lattice {
	const age = time - ripple.start;
	const tile = ripple.from;
	const fade = ripple.amp * (1 - clamp(age / FIELD.lifetime));
	const gap = FIELD.gap * scale;
	const width = FIELD.rippleWidth * scale;
	const dotScale = Math.max(1, scale * 1.2);
	// Two rings, each born at the tile's centre (radius 0) and growing outward.
	const reach = FIELD.rippleSpeed * scale * age;
	const echo = FIELD.rippleSpeed * scale * (age - FIELD.echoDelay);
	const cx = tile.x + tile.width / 2;
	const cy = tile.y + tile.height / 2;
	// The lattice is anchored to the tile, centred inside it.
	const columns = Math.floor(tile.width / gap);
	const rows = Math.floor(tile.height / gap);
	const x0 = cx - (columns * gap) / 2;
	const y0 = cy - (rows * gap) / 2;
	const capacity = (rows + 1) * (columns + 1);
	const store = dots.xs.length >= capacity ? dots : lattice(capacity);
	store.used.fill(0);
	let count = 0;
	for (let row = 0; row <= rows; row += 1) {
		for (let column = 0; column <= columns; column += 1) {
			const x = x0 + column * gap;
			const y = y0 + row * gap;
			const distance = Math.hypot(x - cx, y - cy);
			const offset = distance - reach;
			let ring = Math.exp(-(offset * offset) / (2 * width * width));
			if (echo >= 0) {
				const behind = distance - echo;
				ring += Math.exp(-(behind * behind) / (2 * width * width)) * FIELD.echoStrength;
			}
			const energy = Math.min(1, ring * fade);
			const step = Math.round(energy * ALPHA_STEPS);
			if (step <= 0) continue;
			store.xs[count] = x;
			store.ys[count] = y;
			store.sizes[count] = (FIELD.dotRadius + (FIELD.maxDotRadius - FIELD.dotRadius) * Math.min(1, ring)) * dotScale;
			store.steps[count] = step;
			store.used[step] = 1;
			count += 1;
		}
	}
	if (count === 0) return store;
	context.save();
	context.beginPath();
	context.roundRect(tile.x, tile.y, tile.width, tile.height, radius);
	context.clip();
	for (let step = 1; step <= ALPHA_STEPS; step += 1) {
		if (!store.used[step]) continue;
		context.fillStyle = FILLS[step];
		context.beginPath();
		for (let index = 0; index < count; index += 1) {
			if (store.steps[index] !== step) continue;
			const x = store.xs[index];
			const y = store.ys[index];
			const size = store.sizes[index];
			context.moveTo(x + size, y);
			context.arc(x, y, size, 0, Math.PI * 2);
		}
		context.fill();
	}
	context.restore();
	return store;
}

interface FinaleDotFieldBase {
	readonly fit: FinaleFit;
	/** Stage-to-viewport scale of the lattice and its rings; the stage fit's unless set. */
	readonly scale?: number;
	readonly viewport: FinaleViewport;
	/** Tile corner radius in viewport px (the pulse is clipped to each tile). */
	readonly radius: number;
}

type FinaleDotFieldProps = FinaleDotFieldBase & (
	| {
		/** One pulse per bento tile, fixed on the slide. */
		readonly ripples: readonly FinaleFieldRipple[];
		readonly ripplesAt?: never;
	}
	| {
		/** The pulses that may be live at `time`, on their tiles' rects this frame (the gliding wall's). */
		readonly ripplesAt: (time: number) => readonly FinaleFieldRipple[];
		readonly ripples?: never;
	}
);

const NO_RIPPLES: readonly FinaleFieldRipple[] = [];

export function FinaleDotField({ fit, scale = fit.scale, viewport, ripples, ripplesAt, radius }: Readonly<FinaleDotFieldProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const contextRef = useRef<CanvasRenderingContext2D | null>(null);
	const ratioRef = useRef(1);
	const drawnRef = useRef(false);
	const latticeRef = useRef<Lattice>(NO_DOTS);
	const lastTimeRef = useRef<number | null>(null);

	// Sized before the frame subscription below, so a held frame handed over on mount paints.
	useLayoutEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		ratioRef.current = ratio;
		canvas.width = Math.round(viewport.width * ratio);
		canvas.height = Math.round(viewport.height * ratio);
		// Resizing the canvas wiped it.
		contextRef.current = canvas.getContext("2d");
		drawnRef.current = false;
	}, [viewport.height, viewport.width]);

	const paint = (time: number) => {
		const canvas = canvasRef.current;
		const context = contextRef.current;
		if (!canvas || !context) return;
		const all = ripplesAt ? ripplesAt(time) : (ripples ?? NO_RIPPLES);
		const live = all.some((ripple) => pulsing(ripple, time));
		const visibility = live ? "visible" : "hidden";
		if (canvas.style.visibility !== visibility) canvas.style.visibility = visibility;
		// Idle and already blank: nothing to clear.
		if (!live && !drawnRef.current) return;
		const ratio = ratioRef.current;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, viewport.width, viewport.height);
		drawnRef.current = live;
		if (!live) return;
		for (const ripple of all) {
			if (!pulsing(ripple, time)) continue;
			const tile = ripple.from;
			if (tile.x >= viewport.width || tile.y >= viewport.height || tile.x + tile.width <= 0 || tile.y + tile.height <= 0) continue;
			latticeRef.current = paintPulse(context, latticeRef.current, ripple, time, scale, radius);
		}
	};

	useFinaleFrame((time) => {
		lastTimeRef.current = time;
		paint(time);
	});

	// A held clock never ticks again: repaint the frame it is holding (a resize wipes the canvas).
	useEffect(() => {
		if (lastTimeRef.current !== null) paint(lastTimeRef.current);
	});

	return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" style={{ visibility: "hidden" }} />;
}
