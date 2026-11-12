"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";

import {
	getVisibleOutputLines,
	type TerminalBeatStep,
	type TerminalPaneState,
} from "../lib/terminal-demo-state";
import type { TerminalStoryDefinition } from "../lib/terminal-story-definition";
import { BlinkCursor, StateGlyph, TerminalLineView } from "./terminal-stage-chrome";
import { motionEase } from "@/lib/motion";

const LINE_TRANSITION: Transition = { duration: 0.15, ease: motionEase.outPractical }; // duration-normal + ease-out-practical
const LINE_EXIT_TRANSITION: Transition = { duration: 0.1, ease: motionEase.in }; // duration-fast + ease-in
const LINE_MOTION_STYLE = { willChange: "transform, opacity" } as const;

// ---------------------------------------------------------------------------
// Right pane — the Claude Code session. Renders the welcome box, committed
// transcript, and a bordered prompt box. In-flight reveal for the pane's own
// "type"/"output" steps is layered over the committed pane state, never
// mutating it (the reducer commits atomically on `commit-step`).
// ---------------------------------------------------------------------------

// Pixel-art Claude Code mascot (the coral critter from the CLI splash). Drawn as a
// grid of coloured cells so it stays a "terminal-doable" sprite: `#` = coral body,
// `o` = dark eye. Each cell maps 1:1 to a block a real terminal could paint.
const LOGO_GRID = [
	"...######...",
	"..########..",
	".##########.",
	"############",
	"###oo##oo###",
	"###oo##oo###",
	"############",
	"############",
	".##########.",
	".##.####.##.",
	".#..####..#.",
] as const;
const LOGO_CELL_SIZE = 3;
const LOGO_BODY_FILL = "#D97757";
const LOGO_EYE_FILL = "#1c1917";

function ClaudeLogo(): React.ReactElement {
	const columns = LOGO_GRID[0].length;
	const width = columns * LOGO_CELL_SIZE;
	const height = LOGO_GRID.length * LOGO_CELL_SIZE;
	return (
		<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
			{LOGO_GRID.flatMap((row, y) =>
				[...row].map((cell, x) =>
					cell === "." ? null : (
						<rect
							key={`${x}-${y}`}
							x={x * LOGO_CELL_SIZE}
							y={y * LOGO_CELL_SIZE}
							width={LOGO_CELL_SIZE}
							height={LOGO_CELL_SIZE}
							fill={cell === "o" ? LOGO_EYE_FILL : LOGO_BODY_FILL}
						/>
					),
				),
			)}
		</svg>
	);
}

interface TerminalStageClaudePaneProps {
	pane: TerminalPaneState;
	activeStep: TerminalBeatStep | null;
	revealCount: number;
	story: TerminalStoryDefinition;
}

export function TerminalStageClaudePane({
	pane,
	activeStep,
	revealCount,
	story,
}: Readonly<TerminalStageClaudePaneProps>): React.ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const scrollRef = useRef<HTMLDivElement>(null);
	const isTyping = activeStep?.kind === "type" && activeStep.pane === "right";
	const isPasting = activeStep?.kind === "paste" && activeStep.pane === "right";
	const displayedDraft = isTyping
		? activeStep.text.slice(0, revealCount)
		: isPasting
			? activeStep.text
			: pane.promptDraft;
	const inFlightLines = getVisibleOutputLines(activeStep, "right", revealCount);
	// One list so committing an output step does not remount the same lines under
	// new keys (that flash is what made Working… jump between beats).
	const visibleLines = [...pane.transcript, ...inFlightLines];
	const currentLine = inFlightLines.at(-1) ?? pane.transcript.at(-1);
	const activeLine = pane.working ? currentLine : undefined;
	const hasInlineWorkingMarker = activeLine?.[0]?.text === "⏺ ";

	useEffect(() => {
		const node = scrollRef.current;
		if (!node) return;
		node.scrollTop = node.scrollHeight;
	}, [pane.transcript.length, inFlightLines.length]);

	return (
		<div className="flex h-full min-w-0 flex-col overflow-hidden">
			<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
				<div className="mb-3 flex items-start gap-3 rounded-md border border-border p-3">
					<ClaudeLogo />
					<div className="min-w-0">
						<p className="text-[#D97757]">✻ Welcome to Claude Code!</p>
						<p className="text-text-subtlest">Claude Code · /help for help</p>
						<p className="text-text-subtlest">cwd: {story.claude.cwd}</p>
					</div>
				</div>
				<div className="flex flex-col gap-1">
					{visibleLines.map((line, index) => (
						<motion.div
							key={`line-${index}`}
							layout={shouldReduceMotion ? false : "position"}
							initial={shouldReduceMotion ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={shouldReduceMotion ? { duration: 0 } : LINE_TRANSITION}
							style={shouldReduceMotion ? undefined : LINE_MOTION_STYLE}
						>
							<TerminalLineView
								line={line}
								active={line === activeLine}
							/>
						</motion.div>
					))}
					<AnimatePresence initial={false}>
						{pane.working && !hasInlineWorkingMarker ? (
							<motion.div
								key="working"
								layout={shouldReduceMotion ? false : "position"}
								initial={shouldReduceMotion ? false : { opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={shouldReduceMotion ? undefined : { opacity: 0, transition: LINE_EXIT_TRANSITION }}
								transition={shouldReduceMotion ? { duration: 0 } : LINE_TRANSITION}
								style={shouldReduceMotion ? undefined : LINE_MOTION_STYLE}
								className="mt-1 flex items-center gap-2 text-text-subtlest"
							>
								<StateGlyph status="working" className="shrink-0 text-[#D97757]" />
								<span>Working…</span>
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			</div>
			<div className="shrink-0 border-t border-border px-4 py-3">
				<div className="rounded-md border border-border px-3 py-2 text-text-subtle">
					<span>{"> "}{displayedDraft}</span>
					<BlinkCursor />
				</div>
				<p className="mt-1 text-[11px] text-text-subtlest">? for shortcuts</p>
			</div>
		</div>
	);
}
