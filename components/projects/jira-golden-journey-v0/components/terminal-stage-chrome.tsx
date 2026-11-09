"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import type { TerminalBoardStatus, TerminalLine, TerminalSpan } from "../lib/terminal-demo-state";

// ---------------------------------------------------------------------------
// Shared terminal-stage atoms — tone spans, animated status glyphs, blink
// cursor, PR chips, and the bottom tmux status bar. Kept dependency-free of
// the controller so panes and the stage shell can all import from here.
// ---------------------------------------------------------------------------

const SPAN_TONE_CLASS: Record<NonNullable<TerminalSpan["tone"]>, string> = {
	dim: "text-text-subtlest",
	accent: "text-blue-300",
	success: "text-green-400",
	warning: "text-yellow-300",
	error: "text-red-400",
	bold: "text-text font-semibold",
	brand: "text-[#D97757]",
};

export function TerminalLineView({
	line,
	className,
}: Readonly<{ line: TerminalLine; className?: string }>): React.ReactElement {
	return (
		<div className={cn("whitespace-pre-wrap break-words text-text-subtle", className)}>
			{line.map((span, index) => (
				<span key={index} className={span.tone ? SPAN_TONE_CLASS[span.tone] : undefined}>
					{span.text}
				</span>
			))}
		</div>
	);
}

const WORKING_GLYPH_FRAMES = ["✽", "✻", "✢", "·"] as const;
const WORKING_GLYPH_INTERVAL_MS = 140;

/** Animated (working) / static (needs-input, done, backlog) board-row glyph. */
export function StateGlyph({
	status,
	className,
}: Readonly<{ status: TerminalBoardStatus; className?: string }>): React.ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const isWorking = status === "working";
	const [frameIndex, setFrameIndex] = useState(0);

	useEffect(() => {
		if (!isWorking || shouldReduceMotion) return;
		const interval = window.setInterval(() => {
			setFrameIndex((current) => (current + 1) % WORKING_GLYPH_FRAMES.length);
		}, WORKING_GLYPH_INTERVAL_MS);
		return () => window.clearInterval(interval);
	}, [isWorking, shouldReduceMotion]);

	if (status === "working") {
		return (
			<span className={cn("text-amber-400", className)} aria-hidden="true">
				{shouldReduceMotion ? WORKING_GLYPH_FRAMES[0] : WORKING_GLYPH_FRAMES[frameIndex]}
			</span>
		);
	}
	if (status === "needs-input") {
		return (
			<span className={cn("text-yellow-300", className)} aria-hidden="true">
				✻
			</span>
		);
	}
	if (status === "done") {
		return (
			<span className={cn("text-green-400", className)} aria-hidden="true">
				✻
			</span>
		);
	}
	return (
		<span className={cn("text-text-subtlest", className)} aria-hidden="true">
			○
		</span>
	);
}

export function BlinkCursor({ className }: Readonly<{ className?: string }> = {}): React.ReactElement {
	return (
		<span className={cn("animate-pulse text-text motion-reduce:animate-none", className)} aria-hidden="true">
			▌
		</span>
	);
}

export function PrLabel({
	number,
	state,
}: Readonly<{ number: number; state: "open" | "merged" }>): React.ReactElement {
	return (
		<span className={cn("shrink-0 text-[11px]", state === "merged" ? "text-purple-300" : "text-blue-300")}>
			#{number} {state}
		</span>
	);
}

/** Bottom tmux-style status bar: window list on the left, live hint + clock on the right. */
export function TmuxStatusBar({
	split,
	statusHint,
}: Readonly<{ split: boolean; statusHint: string }>): React.ReactElement {
	const leading = statusHint.charAt(0);
	const pulseGlyph = leading === "→" || leading === "✽";
	const glyph = pulseGlyph ? leading : "";
	const rest = pulseGlyph ? statusHint.slice(1) : statusHint;

	return (
		<div className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-bg-neutral-subtle px-3 text-xs text-text-subtle">
			<div className="flex items-center gap-3">
				<span className="text-green-400">[asx]</span>
				<span>{split ? "0:jira 1:claude*" : "0:claude*"}</span>
			</div>
			<div className="flex items-center gap-3">
				<span>
					<span className="animate-pulse motion-reduce:animate-none">{glyph}</span>
					{rest}
				</span>
				<span>14:32</span>
			</div>
		</div>
	);
}
