"use client";

import { useEffect, useRef } from "react";

import type { FinaleFieldRipple, FinaleFit, FinaleViewport } from "../lib/finale-card-motion";
import { clamp } from "../lib/finale-math";
import { useFinaleFrame } from "./finale-frame";

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

interface FinaleDotFieldProps {
	readonly fit: FinaleFit;
	readonly viewport: FinaleViewport;
	readonly ripples: readonly FinaleFieldRipple[];
	/** Tile corner radius in viewport px (the pulse is clipped to each tile). */
	readonly radius: number;
}

export function FinaleDotField({ fit, viewport, ripples, radius }: Readonly<FinaleDotFieldProps>) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const ratioRef = useRef(1);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		ratioRef.current = ratio;
		canvas.width = Math.round(viewport.width * ratio);
		canvas.height = Math.round(viewport.height * ratio);
	}, [viewport.height, viewport.width]);

	useFinaleFrame((time) => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		const ratio = ratioRef.current;
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		context.clearRect(0, 0, viewport.width, viewport.height);
		const live = ripples.filter((ripple) => time >= ripple.start && time < ripple.start + FIELD.lifetime);
		canvas.style.visibility = live.length > 0 ? "visible" : "hidden";
		if (live.length === 0) return;

		const scale = fit.scale;
		const gap = FIELD.gap * scale;
		const width = FIELD.rippleWidth * scale;
		const dotScale = Math.max(1, scale * 1.2);

		for (const ripple of live) {
			const age = time - ripple.start;
			const tile = ripple.from;
			const fade = ripple.amp * (1 - clamp(age / FIELD.lifetime));
			// Two rings, each born at the tile's centre (radius 0) and growing outward.
			const rings = [
				{ reach: FIELD.rippleSpeed * scale * age, strength: 1 },
				{ reach: FIELD.rippleSpeed * scale * (age - FIELD.echoDelay), strength: FIELD.echoStrength },
			].filter((ring) => ring.reach >= 0);
			const cx = tile.x + tile.width / 2;
			const cy = tile.y + tile.height / 2;
			// The lattice is anchored to the tile, centred inside it.
			const columns = Math.floor(tile.width / gap);
			const rows = Math.floor(tile.height / gap);
			const x0 = cx - (columns * gap) / 2;
			const y0 = cy - (rows * gap) / 2;
			const paths = Array.from({ length: ALPHA_STEPS + 1 }, () => new Path2D());
			const used = new Uint8Array(ALPHA_STEPS + 1);
			for (let row = 0; row <= rows; row += 1) {
				for (let column = 0; column <= columns; column += 1) {
					const x = x0 + column * gap;
					const y = y0 + row * gap;
					const distance = Math.hypot(x - cx, y - cy);
					let ring = 0;
					for (const pulse of rings) {
						const offset = distance - pulse.reach;
						ring += Math.exp(-(offset * offset) / (2 * width * width)) * pulse.strength;
					}
					const energy = Math.min(1, ring * fade);
					const step = Math.round(energy * ALPHA_STEPS);
					if (step <= 0) continue;
					const dot = (FIELD.dotRadius + (FIELD.maxDotRadius - FIELD.dotRadius) * Math.min(1, ring)) * dotScale;
					paths[step].moveTo(x + dot, y);
					paths[step].arc(x, y, dot, 0, Math.PI * 2);
					used[step] = 1;
				}
			}
			context.save();
			context.beginPath();
			context.roundRect(tile.x, tile.y, tile.width, tile.height, radius);
			context.clip();
			for (let step = 1; step <= ALPHA_STEPS; step += 1) {
				if (!used[step]) continue;
				context.fillStyle = `rgba(${FIELD.ink}, ${((step / ALPHA_STEPS) * FIELD.maxOpacity).toFixed(4)})`;
				context.fill(paths[step]);
			}
			context.restore();
		}
	});

	return <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 size-full" style={{ visibility: "hidden" }} />;
}
