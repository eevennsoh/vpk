"use client";

/**
 * A tank that sloshes — a percentage read through the surface of the liquid
 * behind it. Ported from torph's `machines.tsx`
 * (https://github.com/lochie/torph, MIT).
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import TextContinuity from "..";
import { useMotionLoop } from "../hooks";
import { clamp } from "../lib";
import { FOCUS_RING } from "./primitives";

const LEVELS = [0.72, 0.52, 0.95, 0.46];

const TANK_W = 100; // viewBox units; the SVG stretches to the tank
const TANK_H = 60;
const SLOSH_STIFFNESS = 0.09;
const SLOSH_DAMPING = 0.82;
const WAVE_STIFFNESS = 0.16;
const WAVE_DAMPING = 0.9;
const WAVE_DRIVE = 0.55;
const WAVE_SPEED = 0.24;
const POINTS = 24;
const FILL_EVERY = 2600;

const TANK_STEPS: Record<string, number> = {
	ArrowDown: -0.05,
	ArrowLeft: -0.05,
	ArrowUp: 0.05,
	ArrowRight: 0.05,
};

const VALUE_CLASS = "absolute inset-0 z-9 flex items-center justify-center text-[2rem] font-bold tabular-nums";

export function SloshGauge() {
	const [level, setLevel] = useState(LEVELS[0]!);
	const [taken, setTaken] = useState(false);
	const reduced = useReducedMotion();

	const tankRef = useRef<HTMLDivElement>(null);
	const pathRef = useRef<SVGPathElement>(null);
	const overRef = useRef<HTMLDivElement>(null);

	const state = useRef({
		level: LEVELS[0]!,
		vel: 0,
		wave: 0,
		waveVel: 0,
		phase: 0,
		target: LEVELS[0]!,
		reduced: false,
	});

	const wake = useMotionLoop(() => {
		const path = pathRef.current;
		const over = overRef.current;
		if (!path || !over) return null;
		const s = state.current;

		return {
			step: () => {
				if (s.reduced) {
					s.level = s.target;
					s.vel = s.wave = s.waveVel = 0;
					return false;
				}

				s.vel = (s.vel + (s.target - s.level) * SLOSH_STIFFNESS) * SLOSH_DAMPING;
				s.level += s.vel;

				// The surface is driven by the body's own movement, then rings on its own.
				s.waveVel = (s.waveVel - s.wave * WAVE_STIFFNESS) * WAVE_DAMPING - s.vel * WAVE_DRIVE;
				s.wave += s.waveVel;
				s.phase += WAVE_SPEED;

				return (
					Math.abs(s.vel) > 0.0004 ||
					Math.abs(s.target - s.level) > 0.001 ||
					Math.abs(s.wave) > 0.02 ||
					Math.abs(s.waveVel) > 0.01
				);
			},
			paint: () => {
				const base = TANK_H - s.level * TANK_H;
				const amp = clamp(s.wave * 22, -7, 7);

				let d = "";
				const surface: string[] = [];
				for (let i = 0; i <= POINTS; i += 1) {
					const t = i / POINTS;
					const x = t * TANK_W;
					const y = base + amp * Math.sin(s.phase + t * Math.PI * 2.2) + amp * 0.5 * (t - 0.5);
					d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
					surface.push(`${(t * 100).toFixed(2)}% ${((y / TANK_H) * 100).toFixed(2)}%`);
				}
				path.setAttribute("d", `${d}L${TANK_W} ${TANK_H}L0 ${TANK_H}Z`);
				// The same surface in the value's own box, so the digits under it read inverted.
				over.style.clipPath = `polygon(${surface.join(",")},100% 100%,0 100%)`;
			},
		};
	});

	useEffect(() => {
		state.current.target = level;
		state.current.reduced = Boolean(reduced);
		wake();
	}, [level, reduced, wake]);

	useEffect(() => {
		if (taken || reduced) return;
		let step = 0;
		const id = window.setInterval(() => {
			step = (step + 1) % LEVELS.length;
			setLevel(LEVELS[step]!);
		}, FILL_EVERY);
		return () => window.clearInterval(id);
	}, [taken, reduced]);

	const scrub = (event: React.PointerEvent) => {
		const tank = tankRef.current;
		if (!tank) return;
		const rect = tank.getBoundingClientRect();
		setTaken(true);
		setLevel(clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1));
	};

	const value = `${Math.round(level * 100)}%`;

	return (
		<div className="relative flex w-full max-w-88 items-center gap-6">
			<div className={cn(VALUE_CLASS, "text-text")}>
				<TextContinuity>{value}</TextContinuity>
			</div>

			{/* The value a second time, clipped to the liquid's surface each frame. */}
			<div
				className={cn(VALUE_CLASS, "z-10 text-text-inverse")}
				ref={overRef}
				aria-hidden
				style={{ clipPath: "polygon(0 100%, 100% 100%, 100% 100%, 0 100%)" }}
			>
				<TextContinuity>{value}</TextContinuity>
			</div>

			<div
				className={cn(
					"relative h-32 flex-1 cursor-ns-resize touch-none overflow-hidden rounded-xl border border-border bg-surface-sunken",
					FOCUS_RING,
				)}
				ref={tankRef}
				role="slider"
				tabIndex={0}
				aria-label="Fill"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(level * 100)}
				onKeyDown={(event) => {
					const step = TANK_STEPS[event.key];
					if (step === undefined) return;
					event.preventDefault();
					setTaken(true);
					setLevel((current) => clamp(current + step, 0, 1));
				}}
				onPointerDown={(event) => {
					event.currentTarget.setPointerCapture(event.pointerId);
					scrub(event);
				}}
				onPointerMove={(event) => {
					if (event.buttons) scrub(event);
				}}
			>
				<svg
					className="absolute inset-0 size-full"
					viewBox={`0 0 ${TANK_W} ${TANK_H}`}
					preserveAspectRatio="none"
					aria-hidden
				>
					<path ref={pathRef} fill="var(--ds-background-brand-bold)" />
				</svg>
			</div>
		</div>
	);
}
