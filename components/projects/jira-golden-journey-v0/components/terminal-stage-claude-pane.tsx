"use client";

import { useEffect, useRef } from "react";

import type { TerminalBeatStep, TerminalLine, TerminalPaneState } from "../lib/terminal-demo-state";
import { BlinkCursor, TerminalLineView } from "./terminal-stage-chrome";

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
}

export function TerminalStageClaudePane({
	pane,
	activeStep,
	revealCount,
}: Readonly<TerminalStageClaudePaneProps>): React.ReactElement {
	const scrollRef = useRef<HTMLDivElement>(null);
	const isTyping = activeStep?.kind === "type" && activeStep.pane === "right";
	const isOutputting = activeStep?.kind === "output" && activeStep.pane === "right";
	const displayedDraft = isTyping ? activeStep.text.slice(0, revealCount) : pane.promptDraft;
	const inFlightLines: readonly TerminalLine[] = isOutputting ? activeStep.lines.slice(0, revealCount) : [];

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
						<p className="text-text-subtlest">claude-fable · /help for help</p>
						<p className="text-text-subtlest">cwd: ~/dev/asx</p>
					</div>
				</div>
				<div className="flex flex-col gap-1">
					{pane.transcript.map((line, index) => (
						<TerminalLineView key={index} line={line} />
					))}
					{inFlightLines.map((line, index) => (
						<TerminalLineView key={`in-flight-${index}`} line={line} />
					))}
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
