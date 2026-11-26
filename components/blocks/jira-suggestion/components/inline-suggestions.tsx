"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";

import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motionRecipe } from "@/lib/motion";
import { cn } from "@/lib/utils";

import { CARD_PAPER, CARD_PAPER_STYLE } from "./card-face";
import { RowFace } from "./card-faces";
import type { SwipeDirection } from "./use-deck";

/** How far a suggestion slides as the pager moves past it, toward the way the reviewer is reading. */
const PAGE_SLIDE = 8;

function PageButton({ label, disabled, onClick, children }: Readonly<{ label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button aria-label={label} className="size-7 any-pointer-coarse:size-8" disabled={disabled} onClick={onClick} shape="circle" size="icon-compact" type="button" variant="ghost" />}>
				{children}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

/**
 * Suggestions shown inline, already open: one suggestion at a time as the same card a review list row is (label,
 * value, then the lightbulb · ✕ · ✓ on hover), with a quiet pager under a full-width hairline to step through the
 * rest. Accepting or discarding hands the slot to the next suggestion; nothing to review leaves nothing on screen.
 */
export function JiraInlineSuggestions({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const pending = feed.review.pending;
	const [position, setPosition] = useState(0);
	const [direction, setDirection] = useState<1 | -1>(1);
	const [whyOpen, setWhyOpen] = useState(false);
	const anchorRef = useRef<HTMLElement>(null);
	// A decided suggestion leaves the list, so the one after it slides into the same position.
	const index = Math.min(position, pending.length - 1);
	const current = pending.at(index);
	if (!current) return null;

	const page = (step: 1 | -1) => {
		setDirection(step);
		setWhyOpen(false);
		setPosition(index + step);
	};
	const decide = (decision: SwipeDirection) => {
		setDirection(1);
		setWhyOpen(false);
		if (decision === "accept") feed.review.accept(current.id);
		else feed.review.dismiss(current.id);
	};

	return (
		<TooltipProvider>
			<section aria-label="AI suggestions" className="mb-4">
				<div className={cn("group/suggestion-card relative overflow-hidden", CARD_PAPER, "shadow-sm")} style={CARD_PAPER_STYLE}>
					<AnimatePresence custom={direction} initial={false} mode="popLayout">
						<motion.div
							animate={{ opacity: 1, x: 0, transition: motionRecipe.popup.enter }}
							custom={direction}
							exit={{ opacity: 0, x: -PAGE_SLIDE * direction, transition: motionRecipe.popup.exit }}
							initial={{ opacity: 0, x: PAGE_SLIDE * direction }}
							key={current.id}
						>
							<RowFace controls onDecide={decide} suggestion={current} why={{ whyOpen, onWhyOpenChange: setWhyOpen, whyAnchor: anchorRef, whyContainer: null }} />
						</motion.div>
					</AnimatePresence>
					<div className="flex h-10 items-center gap-2 border-t border-border-disabled pr-2 pl-4">
						<span aria-live="polite" className="min-w-0 flex-1 text-xs text-text-subtlest tabular-nums">
							Suggestion {index + 1} of {pending.length}
						</span>
						<span className="flex items-center gap-0.5">
							<PageButton disabled={index === 0} label="Previous suggestion" onClick={() => page(-1)}>
								<ChevronLeftIcon color="currentColor" label="" size="small" />
							</PageButton>
							<PageButton disabled={index === pending.length - 1} label="Next suggestion" onClick={() => page(1)}>
								<ChevronRightIcon color="currentColor" label="" size="small" />
							</PageButton>
						</span>
					</div>
				</div>
			</section>
		</TooltipProvider>
	);
}
