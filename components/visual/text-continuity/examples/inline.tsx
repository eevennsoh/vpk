"use client";

/**
 * Inline examples — small surfaces where the morph is the whole interaction.
 * Ported from torph's `copy.tsx`, `action.tsx`, `rewrite.tsx` and `number.tsx`
 * (https://github.com/lochie/torph, MIT).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import TextContinuity from "..";
import { useCycle } from "../hooks";
import { wrap } from "../lib";
import { Chip, Well } from "./primitives";

const COPY_STATES = ["Copy", "Copied"];

/** Two words sharing four letters — the shortest morph there is. */
export function Copy() {
	const index = useCycle(COPY_STATES.length, 2000);

	return (
		<Chip className="rounded-xl px-4 py-2.5">
			<TextContinuity>{COPY_STATES[index]!}</TextContinuity>
		</Chip>
	);
}

const ACTION_TRANSITION = {
	type: "spring" as const,
	mass: 4,
	stiffness: 800,
	damping: 80,
	restDelta: 0.0001,
};

/**
 * The one continuous animation in the gallery, so it needs its own guard:
 * `useCycle` rests this example on the spinner state, and an indefinite spin is
 * exactly what `prefers-reduced-motion` is asking us not to do.
 */
const SpinnerIcon = () => {
	const reduced = useReducedMotion();

	return (
		<svg width="23" height="23" viewBox="0 0 23 23" fill="none" aria-hidden>
			<motion.g
				animate={reduced ? undefined : { rotate: 360 }}
				transition={reduced ? undefined : { repeat: Infinity, duration: 0.5, ease: "linear" }}
				style={{ originX: "50%", originY: "50%", willChange: "transform" }}
			>
				<path
					d="M21.313 11.4062C21.313 16.8775 16.8777 21.3128 11.4065 21.3128"
					stroke="currentColor"
					strokeWidth="3"
					strokeLinecap="round"
				/>
				<path
					opacity="0.1"
					d="M11.4065 21.313C16.8777 21.313 21.313 16.8777 21.313 11.4065C21.313 5.93529 16.8777 1.5 11.4065 1.5C5.93529 1.5 1.5 5.93529 1.5 11.4065C1.5 16.8777 5.93529 21.313 11.4065 21.313Z"
					stroke="currentColor"
					strokeWidth="3"
				/>
			</motion.g>
		</svg>
	);
};

const CheckIcon = () => (
	<svg width="21" height="21" viewBox="0 0 21 21" fill="none" aria-hidden>
		<path
			d="M20.9016 10.4508C20.9016 4.67899 16.2226 0 10.4508 0C4.67899 0 0 4.67899 0 10.4508C0 16.2226 4.67899 20.9016 10.4508 20.9016C16.2226 20.9016 20.9016 16.2226 20.9016 10.4508Z"
			fill="currentColor"
		/>
		<path
			d="M6.09631 10.9828L8.83539 13.6439L14.8053 7.83789"
			fill="none"
			stroke="var(--ds-surface)"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
	</svg>
);

const ACTION_STATES = [
	{ label: "Processing Transaction", Icon: SpinnerIcon },
	{ label: "Transaction Safe", Icon: CheckIcon },
];

/** A status pill: the icon crossfades while the label morphs underneath a mask. */
export function Action() {
	const index = useCycle(ACTION_STATES.length, 2000);
	const { Icon } = ACTION_STATES[index]!;

	return (
		<div className="flex items-center justify-center gap-2.5 overflow-hidden rounded-full bg-bg-neutral py-3 pl-4.5 pr-6 text-base font-medium text-text">
			<div className="relative size-6">
				<AnimatePresence initial={false}>
					<motion.div
						key={index}
						className="absolute inset-0 flex items-center justify-center text-icon-brand"
						initial={{ opacity: 0, scale: 0.6 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.6, transition: ACTION_TRANSITION }}
						transition={{ delay: 0.1, ...ACTION_TRANSITION }}
						style={{ willChange: "opacity, transform" }}
					>
						<Icon />
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Masked at both edges so a longer label fades out rather than clipping. */}
			<div
				className="-mx-8 px-8"
				style={{
					maskImage:
						"linear-gradient(to right, transparent, black 2rem, black calc(100% - 2rem), transparent)",
				}}
			>
				<TextContinuity duration={600} ease="cubic-bezier(0.41, 1.03, 0.6, 1.03)">
					{ACTION_STATES[index]!.label}
				</TextContinuity>
			</div>
		</div>
	);
}

const REWRITE_STATES = [
	{ tone: "Direct", body: "Running late, be there soon." },
	{ tone: "Friendly", body: "Running a bit behind, I'll be there soon." },
	{ tone: "Professional", body: "I'm running a little behind, should be there soon." },
];

/** A whole message rephrased, wrapped across lines that rewrap as it changes. */
export function Rewrite() {
	const index = useCycle(REWRITE_STATES.length, 2400);
	const { tone, body } = REWRITE_STATES[index]!;

	return (
		<div className="flex h-27 flex-col items-end justify-end gap-2">
			<div className="max-w-56 rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-left text-sm font-medium leading-snug text-primary-foreground">
				<TextContinuity>{wrap(body, 24)}</TextContinuity>
			</div>

			<div className="flex items-center gap-1.5 pl-0.5 text-xs font-medium text-text-subtlest">
				<svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden className="text-icon-brand">
					<path d="M6 0.5L7.2 4.3L11 5.5L7.2 6.7L6 10.5L4.8 6.7L1 5.5L4.8 4.3L6 0.5Z" fill="currentColor" />
				</svg>
				<TextContinuity>{tone}</TextContinuity>
			</div>
		</div>
	);
}

/**
 * A scripted caret. Each step names the value *and* where the caret sits, which
 * is what switches the morph from place matching to caret matching: typing `1`
 * in front of `20` inserts a digit rather than renumbering the column.
 */
const NUMBER_SCRIPT = [
	// Type $20
	{ value: "$", cursor: 1, delay: 0 },
	{ value: "$2", cursor: 2, delay: 150 },
	{ value: "$20", cursor: 3, delay: 1200 },
	{ value: "$20", cursor: 3, delay: 1800 },

	// Caret before the 2, then insert — the thousands separator appears
	{ value: "$20", cursor: 1, delay: 200 },
	{ value: "$420", cursor: 2, delay: 400 },
	{ value: "$4,020", cursor: 4, delay: 1800 },

	// Caret between the digits, then insert a decimal point
	{ value: "$420", cursor: 2, delay: 400 },
	{ value: "$4.20", cursor: 3, delay: 400 },
	{ value: "$4.20", cursor: 3, delay: 1800 },

	// Backspace it away
	{ value: "$4.20", cursor: 5, delay: 1800 },
	{ value: "$4.2", cursor: 4, delay: 200 },
	{ value: "$4", cursor: 2, delay: 200 },
	{ value: "$", cursor: 1, delay: 200 },
];

export function NumberField() {
	const [index, setIndex] = useState(0);
	const reduced = useReducedMotion();

	const measureRef = useRef<HTMLSpanElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [cursorX, setCursorX] = useState<number | null>(null);

	useEffect(() => {
		if (reduced) return;
		const timeout = window.setTimeout(() => setIndex((prev) => (prev + 1) % NUMBER_SCRIPT.length), NUMBER_SCRIPT[index]!.delay);
		return () => window.clearTimeout(timeout);
	}, [index, reduced]);

	const step = NUMBER_SCRIPT[index]!;

	// The caret rides on the measured width of the value up to the caret index,
	// so it stays put while the digits around it slide.
	useLayoutEffect(() => {
		const measure = measureRef.current;
		const container = containerRef.current;
		if (!measure || !container) return;
		setCursorX(measure.getBoundingClientRect().right - container.getBoundingClientRect().left);
	}, [index]);

	return (
		<Well className="flex items-center justify-center rounded-b-none rounded-t-2xl border-b-0 px-2.5 py-8 text-4xl font-semibold text-text">
			<div ref={containerRef} className="relative">
				<TextContinuity cursorIndex={step.cursor}>{step.value}</TextContinuity>

				<span ref={measureRef} aria-hidden className="invisible absolute left-0 top-0 whitespace-pre font-[inherit]">
					{step.value.slice(0, step.cursor)}
				</span>

				<span
					aria-hidden
					className="text-continuity-caret absolute top-1/2 h-[0.95em] w-px -translate-y-1/2 rounded-full bg-border-bold transition-[left] duration-slow ease-out motion-reduce:transition-none"
					style={{ left: cursorX != null ? `${cursorX}px` : undefined }}
				/>
			</div>
		</Well>
	);
}
