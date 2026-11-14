"use client";

/**
 * Elastic examples — a figure you squash into a shorter form, and a sentence you
 * squeeze one abbreviation at a time. Ported from torph's `elastic.tsx`
 * (https://github.com/lochie/torph, MIT). Haptics calls omitted.
 */

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import TextContinuity from "..";
import { useMotionLoop } from "../hooks";
import { clamp, formFor, measureForms } from "../lib";
import { FOCUS_RING, ResizeFrame } from "./primitives";

// ── A figure you squash ──

const FIGURES = ["1,248,392", "1,248K", "1.2M", "1M"];

const SQUISH_FLOOR = 0.84; // How far a form squashes before it gives
const SQUISH_CEILING = 1.15;
const SQUISH_STIFFNESS = 0.2;
const SQUISH_DAMPING = 0.62;
const SQUISH_EVERY = 3400;

export function SquishyNumber() {
	const [form, setForm] = useState(0);
	const [taken, setTaken] = useState(false);
	const reduced = useReducedMotion();

	const boxRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);

	const state = useRef({
		width: 0,
		vel: 0,
		target: 0,
		grabbed: false,
		from: 0,
		widths: [] as number[],
		form: 0,
		wide: true,
	});

	const wake = useMotionLoop(() => {
		const box = boxRef.current;
		const text = textRef.current;
		if (!box || !text) return null;

		const s = state.current;
		s.widths = measureForms(text, FIGURES);
		s.width = s.target = s.widths[0]!;

		const floor = () => s.widths[s.widths.length - 1]! * SQUISH_FLOOR;
		const ceiling = () => s.widths[0]! * SQUISH_CEILING;

		return {
			step: () => {
				if (s.grabbed) return true;

				s.vel = (s.vel + (s.target - s.width) * SQUISH_STIFFNESS) * SQUISH_DAMPING;
				s.width += s.vel;

				if (Math.abs(s.vel) < 0.05 && Math.abs(s.target - s.width) < 0.2) {
					// A figure held squashed reads as broken type, so rest is its natural width.
					const rest = s.widths[s.form]!;
					if (Math.abs(rest - s.width) > 0.2) {
						s.target = rest;
						return true;
					}
					s.width = s.target;
					s.vel = 0;
					return false;
				}
				return true;
			},
			paint: () => {
				s.width = clamp(s.width, floor(), ceiling());
				const next = formFor(s.widths, s.width, SQUISH_FLOOR);
				const k = clamp(s.width / s.widths[next]!, SQUISH_FLOOR, SQUISH_CEILING);

				box.style.width = `${s.width}px`;
				// Squash one way, swell the other — the volume has to go somewhere.
				text.style.transform = `scaleX(${k}) scaleY(${1 + (1 - k) * 0.35})`;

				if (next === s.form) return;
				s.form = next;
				setForm(next);
			},
		};
	});

	useEffect(() => {
		if (taken || reduced) return;
		const id = window.setInterval(() => {
			const s = state.current;
			s.wide = !s.wide;
			s.target = s.wide ? s.widths[0]! * SQUISH_CEILING : s.widths[s.widths.length - 1]! * SQUISH_FLOOR;
			wake();
		}, SQUISH_EVERY);
		return () => window.clearInterval(id);
	}, [taken, reduced, wake]);

	const release = () => {
		const s = state.current;
		if (!s.grabbed) return;
		s.grabbed = false;
		s.target = s.width;
		wake();
	};

	return (
		<div className="flex h-16 items-stretch">
			<div
				className="box-content flex items-center overflow-hidden rounded-l-xl border border-border bg-surface-sunken px-3.5"
				ref={boxRef}
			>
				{/*
				 * Scaled from the left, so the squash follows the handle rather than
				 * the middle. The type lives here, not on the morph inside: this is the
				 * element that gets measured.
				 */}
				<span
					className="inline-flex origin-left whitespace-nowrap text-[2rem] font-bold tabular-nums text-text"
					ref={textRef}
				>
					<TextContinuity>{FIGURES[form]!}</TextContinuity>
				</span>
			</div>

			<span
				className={cn(
					"relative w-3 flex-none cursor-ew-resize touch-none rounded-r-xl bg-bg-neutral",
					"after:absolute after:left-1/2 after:top-1/2 after:h-4 after:w-0.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-icon-subtlest after:content-['']",
					"hover:after:bg-icon-brand",
					FOCUS_RING,
				)}
				role="slider"
				tabIndex={0}
				aria-label="Width"
				aria-valuemin={0}
				aria-valuemax={FIGURES.length - 1}
				aria-valuenow={FIGURES.length - 1 - form}
				aria-valuetext={FIGURES[form]!}
				onKeyDown={(event) => {
					const step = event.key === "ArrowLeft" ? -24 : event.key === "ArrowRight" ? 24 : 0;
					if (!step) return;
					event.preventDefault();
					const s = state.current;
					setTaken(true);
					s.target = s.width + step;
					wake();
				}}
				onPointerDown={(event) => {
					event.currentTarget.setPointerCapture(event.pointerId);
					const s = state.current;
					setTaken(true);
					s.grabbed = true;
					s.from = event.clientX - s.width;
					wake();
				}}
				onPointerMove={(event) => {
					const s = state.current;
					if (!s.grabbed) return;
					s.width = event.clientX - s.from;
				}}
				onPointerUp={release}
				onPointerCancel={release}
			/>
		</div>
	);
}

// ── A sentence you squeeze ──

const PHRASES = ["3 hours 24 minutes ago", "3 hr 24 min ago", "3h 24m ago", "3h ago", "now"];

const SQUEEZE_EVERY = 3000;
const SQUEEZE_STIFFNESS = 0.22;
const SQUEEZE_DAMPING = 0.66;

export function SqueezeToAbbreviate() {
	const [form, setForm] = useState(0);
	const [taken, setTaken] = useState(false);
	const reduced = useReducedMotion();

	const cellRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLSpanElement>(null);

	const state = useRef({
		width: 0,
		vel: 0,
		target: 0,
		grabbed: false,
		from: 0,
		widths: [] as number[],
		form: 0,
		wide: true,
	});

	const wake = useMotionLoop(() => {
		const cell = cellRef.current;
		const text = textRef.current;
		if (!cell || !text) return null;

		const s = state.current;
		s.widths = measureForms(text, PHRASES);
		s.width = s.target = s.widths[0]! + 16;

		const floor = () => s.widths[s.widths.length - 1]!;
		const ceiling = () => s.widths[0]! + 24;

		return {
			step: () => {
				if (s.grabbed) return true;

				s.vel = (s.vel + (s.target - s.width) * SQUEEZE_STIFFNESS) * SQUEEZE_DAMPING;
				s.width += s.vel;

				if (Math.abs(s.vel) < 0.05 && Math.abs(s.target - s.width) < 0.2) {
					s.width = s.target;
					s.vel = 0;
					return false;
				}
				return true;
			},
			paint: () => {
				s.width = clamp(s.width, floor(), ceiling());
				cell.style.width = `${s.width}px`;

				// No squashing here: prose that distorts reads as broken, not as rubber.
				const next = formFor(s.widths, s.width, 1);
				if (next === s.form) return;
				s.form = next;
				setForm(next);
			},
		};
	});

	useEffect(() => {
		if (taken || reduced) return;
		const id = window.setInterval(() => {
			const s = state.current;
			s.wide = !s.wide;
			s.target = s.wide ? s.widths[0]! + 24 : s.widths[s.widths.length - 1]!;
			wake();
		}, SQUEEZE_EVERY);
		return () => window.clearInterval(id);
	}, [taken, reduced, wake]);

	const release = () => {
		const s = state.current;
		if (!s.grabbed) return;
		s.grabbed = false;
		s.target = s.width;
		wake();
	};

	return (
		<ResizeFrame
			// The cell is content-box, so the narrowest form ends flush with its right edge.
			className="h-12"
			cellClassName="px-3.5"
			cellRef={cellRef}
			label="Column width"
			valueMin={0}
			valueMax={PHRASES.length - 1}
			valueNow={PHRASES.length - 1 - form}
			valueText={PHRASES[form]!}
			getWidth={() => state.current.width}
			onGrab={() => {
				setTaken(true);
				state.current.grabbed = true;
				wake();
			}}
			onResize={(width) => {
				state.current.width = width;
			}}
			onRelease={release}
			onStep={(delta) => {
				const s = state.current;
				setTaken(true);
				s.target = s.width + delta;
				wake();
			}}
		>
			<span className="inline-flex whitespace-nowrap text-base font-medium text-text" ref={textRef}>
				<TextContinuity>{PHRASES[form]!}</TextContinuity>
			</span>
		</ResizeFrame>
	);
}
