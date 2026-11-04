"use client";

import { useId, useState, type Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Tile } from "@/components/ui/tile";
import { TWGLoader } from "@/components/ui-custom/twg-loader";
import { RovoGeneration } from "@/components/ui-custom/rovo-generation";
import { TwgToolBannerBackground, TwgToolSourceStack, type TwgToolSource } from "@/components/ui-custom/twg-tool";
import { motionDuration, motionEase } from "@/lib/motion";

/** The products the agent read, matching the evidence kinds behind the suggestions. */
const SUGGESTION_SOURCES = [
	{ id: "twg", label: "Teamwork Graph", provider: "twg" },
	{ id: "jira", label: "Jira", provider: "jira" },
	{ id: "confluence", label: "Confluence", provider: "confluence" },
	{ id: "loom", label: "Loom", provider: "loom" },
] as const satisfies readonly TwgToolSource[];

function TriggerLabel({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	if (feed.status === "running") return <span className="text-text-subtle">Checking for suggestions…</span>;
	const pending = feed.review.pending.length;
	if (pending === 0) return <span className="text-text-subtle">All caught up</span>;
	const fresh = feed.newIds.size;
	return (
		<>
			{pending} {pending === 1 ? "suggestion" : "suggestions"}
			{fresh > 0 ? (
				<>
					<span className="sr-only">, </span>
					<span className="ml-1.5 text-xs font-medium text-text-discovery">{fresh} new</span>
				</>
			) : null}
		</>
	);
}

export interface StackTriggerProps {
	feed: SuggestionFeed;
	open: boolean;
	panelId: string;
	onToggle: () => void;
	triggerRef: Ref<HTMLButtonElement>;
	sources?: readonly TwgToolSource[];
	animateIntro?: boolean;
	showIntroLoading?: boolean;
}

/**
 * The live "N suggestions" banner above Details, matching the Ledger's. Its accessible name is its visible label
 * (the live count or run state), so what a screen reader announces matches what is shown. The graph mark is decorative and animates while the agent re-runs.
 */
export function StackTrigger({ feed, open, panelId, onToggle, triggerRef, sources = SUGGESTION_SOURCES, animateIntro = false, showIntroLoading = false }: Readonly<StackTriggerProps>) {
	const labelId = useId();
	const [intro, setIntro] = useState(animateIntro);
	const reduced = useReducedMotion() ?? false;
	const banner = (
		<div className="relative flex h-auto w-full items-center justify-start gap-3 overflow-hidden rounded-[calc(0.25*2rem+0.375rem+1px)] border border-border bg-surface-sunken p-1.5 pr-2 text-left transition-[background-color,border-color,box-shadow] has-[[data-suggestion-trigger][aria-expanded=false]:hover]:bg-surface-raised-hovered has-[[data-suggestion-trigger][aria-expanded=true]]:border-border-selected has-[[data-suggestion-trigger][aria-expanded=true]]:bg-bg-selected has-[[data-suggestion-trigger]:focus-visible]:border-ring has-[[data-suggestion-trigger]:focus-visible]:ring-3 has-[[data-suggestion-trigger]:focus-visible]:ring-ring/50">
			<button
				aria-controls={open ? panelId : undefined}
				aria-expanded={open}
				aria-labelledby={labelId}
				className="absolute inset-0 z-20 rounded-[inherit] outline-none"
				data-suggestion-trigger=""
				onClick={onToggle}
				ref={triggerRef}
				type="button"
			/>
			<AnimatePresence>
				{intro ? null : <motion.div animate={{ opacity: 1 }} className="pointer-events-none absolute inset-0" data-suggestion-grid="" initial={reduced ? false : { opacity: 0 }} key="grid" style={{ willChange: "opacity" }} transition={{ duration: motionDuration.slowest, ease: motionEase.inOut }}>
					<TwgToolBannerBackground gridMaskPosition="right 13px center" />
				</motion.div>}
			</AnimatePresence>
			<Tile aria-hidden className="relative z-10 bg-surface" hasBorder label="Teamwork Graph" size="medium" variant="transparent">
				<TWGLoader active={intro || feed.status === "running"} label="" size="small" />
			</Tile>
			<span aria-live="polite" className="relative z-10 min-w-0 flex-1 text-sm text-text" id={labelId}>{intro && showIntroLoading ? "Finding suggestions" : <TriggerLabel feed={feed} />}</span>
			<AnimatePresence>
				{intro ? null : <div className="relative z-10 max-w-[44%] shrink-0" data-suggestion-sources key="sources"><TwgToolSourceStack sources={sources} /></div>}
			</AnimatePresence>
		</div>
	);
	return animateIntro ? <RovoGeneration.Highlight active className="block w-full" onHighlightComplete={() => setIntro(false)}>{banner}</RovoGeneration.Highlight> : banner;
}
