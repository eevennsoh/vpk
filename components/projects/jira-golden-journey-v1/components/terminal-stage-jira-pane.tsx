"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";

import { cn } from "@/lib/utils";

import {
	getBoardCounts,
	getBoardSections,
	getVisibleOutputLines,
	TERMINAL_SECTION_ORDER,
	type TerminalBeatStep,
	type TerminalPaneState,
	type TerminalWorkItem,
} from "../lib/terminal-demo-state";
import type { TerminalStoryDefinition } from "../lib/terminal-story-definition";
import { foldBoardPreview } from "../hooks/use-terminal-demo";
import { BlinkCursor, PrLabel, StateGlyph, TerminalLineView } from "./terminal-stage-chrome";
import { motionEase } from "@/lib/motion";

// ---------------------------------------------------------------------------
// Left pane — the configured Jira/TwG dashboard. It begins as a plain shell;
// once the reducer flips `dashboardVisible` it fades into the sectioned board.
// ---------------------------------------------------------------------------

const DASHBOARD_FADE_TRANSITION: Transition = { duration: 0.2, ease: motionEase.out }; // duration-medium + ease-out (bold)
const ROW_TRANSITION: Transition = { duration: 0.15, ease: motionEase.outPractical }; // duration-normal + ease-out-practical

const COUNT_TONE_CLASS = {
	awaiting: "text-yellow-300",
	working: "text-amber-400",
	completed: "text-green-400",
} as const;

function JiraRow({ item, selected }: Readonly<{ item: TerminalWorkItem; selected: boolean }>): React.ReactElement {
	const shouldReduceMotion = useReducedMotion();
	return (
		<motion.div
			layout={!shouldReduceMotion}
			initial={shouldReduceMotion ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={shouldReduceMotion ? { duration: 0 } : ROW_TRANSITION}
			style={shouldReduceMotion ? undefined : { willChange: "transform, opacity" }}
			aria-selected={selected}
			// `-mx-4 px-4` is applied unconditionally so only the background colour
			// changes on selection — the row's geometry stays fixed, which keeps the
			// `layout` animation stable. The full-bleed bar mirrors a real TUI list
			// cursor (k9s / lazygit reverse-video row).
			className={cn(
				"-mx-4 flex items-center gap-2 px-4 py-0.5",
				selected ? "bg-bg-neutral" : null,
			)}
		>
			<StateGlyph status={item.status} className="shrink-0" />
			<span className="shrink-0 font-semibold text-text">{item.key}</span>
			<span className={cn("shrink-0", selected ? "text-text" : "text-text-subtle")}>{item.title}</span>
			<span className={cn("min-w-0 flex-1 truncate", selected ? "text-text-subtle" : "text-text-subtlest")}>
				{item.summary}
			</span>
			{item.pr ? <PrLabel number={item.pr.number} state={item.pr.state} /> : null}
			<span className="shrink-0 text-text-subtlest">{item.age}</span>
		</motion.div>
	);
}

function JiraSection({
	label,
	items,
	selectedKey,
}: Readonly<{ label: string; items: readonly TerminalWorkItem[]; selectedKey: string | null }>): React.ReactElement | null {
	return items.length > 0 ? (
		<div className="mb-3">
			<p className="mb-1 text-[11px] uppercase tracking-wide text-text-subtlest">{label}</p>
			{items.map((item) => (
				<JiraRow key={item.key} item={item} selected={item.key === selectedKey} />
			))}
		</div>
	) : null;
}

function JiraShellView({
	pane,
	activeStep,
	revealCount,
	story,
}: Readonly<{
	pane: TerminalPaneState;
	activeStep: TerminalBeatStep | null;
	revealCount: number;
	story: TerminalStoryDefinition;
}>): React.ReactElement {
	const isTyping = activeStep?.kind === "type" && activeStep.pane === "left";
	const isPasting = activeStep?.kind === "paste" && activeStep.pane === "left";
	const displayedDraft = isTyping
		? activeStep.text.slice(0, revealCount)
		: isPasting
			? activeStep.text
			: pane.promptDraft;
	const inFlightLines = getVisibleOutputLines(activeStep, "left", revealCount);

	return (
		<div className="flex h-full flex-col overflow-y-auto px-4 py-3 text-text-subtle">
			<div className="flex flex-col gap-0.5">
				{pane.transcript.map((line, index) => (
					<TerminalLineView key={index} line={line} />
				))}
				{inFlightLines.map((line, index) => (
					<TerminalLineView key={`in-flight-${index}`} line={line} />
				))}
			</div>
			<div className={cn("flex items-center gap-2", pane.transcript.length > 0 ? "mt-1" : null)}>
				<span className="text-text-subtlest">{story.dashboard.shellPrompt}</span>
				<span>{displayedDraft}</span>
				<BlinkCursor />
			</div>
		</div>
	);
}

interface TerminalStageJiraPaneProps {
	pane: TerminalPaneState;
	items: readonly TerminalWorkItem[];
	dashboardVisible: boolean;
	activeStep: TerminalBeatStep | null;
	revealCount: number;
	selectedKey: string | null;
	story: TerminalStoryDefinition;
}

export function TerminalStageJiraPane({
	pane,
	items,
	dashboardVisible,
	activeStep,
	revealCount,
	selectedKey,
	story,
}: Readonly<TerminalStageJiraPaneProps>): React.ReactElement {
	const shouldReduceMotion = useReducedMotion();
	const scrollRef = useRef<HTMLDivElement>(null);
	const previewItems = foldBoardPreview(items, activeStep, revealCount);
	const sections = getBoardSections(previewItems);
	const counts = getBoardCounts(previewItems);
	const rowCount = sections.needsInput.length + sections.working.length + sections.backlog.length + sections.done.length;

	useEffect(() => {
		const node = scrollRef.current;
		if (!node) return;
		node.scrollTop = node.scrollHeight;
	}, [pane.transcript.length, rowCount]);

	if (!dashboardVisible) {
		return <JiraShellView pane={pane} activeStep={activeStep} revealCount={revealCount} story={story} />;
	}

	return (
		<motion.div
			initial={shouldReduceMotion ? false : { opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={shouldReduceMotion ? { duration: 0 } : DASHBOARD_FADE_TRANSITION}
			style={shouldReduceMotion ? undefined : { willChange: "opacity" }}
			className="flex h-full flex-col overflow-hidden"
		>
			<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
				<p className="font-semibold text-blue-400">{story.dashboard.title}</p>
				<p className="mb-1 text-text-subtlest">{story.dashboard.workspace}</p>
				<p className="mb-3 text-text-subtle">
					<span className={COUNT_TONE_CLASS.awaiting}>{counts.awaiting} awaiting input</span>
					{" · "}
					<span className={COUNT_TONE_CLASS.working}>{counts.working} working</span>
					{" · "}
					<span className={COUNT_TONE_CLASS.completed}>{counts.completed} completed</span>
				</p>
				{TERMINAL_SECTION_ORDER.map(({ key, label }) => (
					<JiraSection key={key} label={label} items={sections[key]} selectedKey={selectedKey} />
				))}
			</div>
			<p className="shrink-0 border-t border-border px-4 py-2 text-[11px] text-text-subtlest">
				{story.dashboard.footerHints}
			</p>
		</motion.div>
	);
}
