"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import ChevronLeftIcon from "@atlaskit/icon/core/chevron-left";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import CrossIcon from "@atlaskit/icon/core/cross";
import LightbulbIcon from "@atlaskit/icon/core/lightbulb";

import type { SuggestionFieldId } from "@/components/blocks/jira-suggestion/data/suggestions";
import type { SuggestionFeed } from "@/components/blocks/jira-suggestion/hooks/use-suggestion-feed";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { SETTLE } from "./constants";
import { WhyCard } from "./why-card";

/** How many frames to look for the previewed field before giving up (it renders a commit or two after the preview is set). */
const ANCHOR_SEARCH_FRAMES = 30;

/**
 * Where a suggestion lands on the work item: a detail's value row (steadier than its sliding highlight), or the
 * field's own dashed preview box (the description).
 */
function findPreviewAnchor(field: SuggestionFieldId): HTMLElement | null {
	return document.querySelector<HTMLElement>(`[data-field-id="${field}"] [data-project-butter-detail-value-row]`)
		?? document.querySelector<HTMLElement>(`[data-suggestion-preview="${field}"]`);
}

function ToolbarButton({ label, hint = label, disabled = false, onClick, children, ...aria }: Readonly<{ label: string; hint?: string; disabled?: boolean; onClick: () => void; children: React.ReactNode; "aria-expanded"?: boolean; "aria-controls"?: string }>) {
	return (
		<Tooltip>
			<TooltipTrigger render={<Button {...aria} aria-label={label} className="size-7 any-pointer-coarse:size-8 aria-expanded:bg-bg-neutral-subtle-hovered aria-expanded:[&_svg]:text-icon-subtle" disabled={disabled} onClick={onClick} shape="circle" size="icon-compact" type="button" variant="ghost" />}>
				{children}
			</TooltipTrigger>
			<TooltipContent>{hint}</TooltipContent>
		</Tooltip>
	);
}

/**
 * Suggestions shown inline, where they would land. The current suggestion is previewed in its own field (the same
 * in-place preview the review panel shows on hover), and a small toolbar sits just under that field's right edge: the
 * lightbulb · ✕ · ✓ a review row has, and a pager through the rest. There is no separate suggestions
 * area; paging or deciding moves the preview, and the toolbar with it, to the next field. Nothing left leaves nothing.
 */
export function JiraInlineSuggestions({ feed }: Readonly<{ feed: SuggestionFeed }>) {
	const pending = feed.review.pending;
	const [position, setPosition] = useState(0);
	const [whyOpen, setWhyOpen] = useState(false);
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const whyId = useId();
	// A decided suggestion leaves the list, so the one after it slides into the same position.
	const index = Math.min(position, pending.length - 1);
	const current = pending.at(index);
	const previewId = current?.id;
	const previewText = current?.valueText;
	const onPreview = feed.onPreviewCard;
	useEffect(() => {
		onPreview?.(previewId && previewText !== undefined ? { id: previewId, valueText: previewText } : null);
	}, [onPreview, previewId, previewText]);
	useEffect(() => () => onPreview?.(null), [onPreview]);
	// Follow the preview to its field once it has rendered there.
	useEffect(() => {
		if (!previewId) return undefined;
		let frames = 0;
		let raf = 0;
		const look = () => {
			const found = findPreviewAnchor(previewId);
			if (found || frames >= ANCHOR_SEARCH_FRAMES) setAnchor(found);
			else {
				frames += 1;
				raf = requestAnimationFrame(look);
			}
		};
		raf = requestAnimationFrame(look);
		return () => cancelAnimationFrame(raf);
	}, [previewId]);
	if (!current) return null;

	const page = (step: 1 | -1) => {
		setWhyOpen(false);
		setPosition(index + step);
	};
	const decide = (accept: boolean) => {
		setWhyOpen(false);
		if (accept) feed.review.accept(current.id);
		else feed.review.dismiss(current.id);
	};
	const field = current.label.toLowerCase();
	const hasWhy = current.reason.evidence.length > 0;
	const expanded = hasWhy && whyOpen;
	const anchored = anchor?.isConnected ? anchor : null;

	return (
		<Popover open={Boolean(anchored)}>
			{anchored ? (
				<PopoverContent
					align="end"
					anchor={anchored}
					aria-label={`AI suggestion for ${field}, ${index + 1} of ${pending.length}`}
					// ADS overlay elevation without its 1px perimeter: just the overlay's 8px spread, per theme (no token has it alone).
					className={cn("gap-0 overflow-hidden p-0 shadow-[0px_8px_12px_#1E1F2126] dark:shadow-[0px_8px_12px_#0104045C]", expanded ? "w-80" : "w-auto")}
					initialFocus={false}
					positionerClassName="z-[650]"
					side="bottom"
					sideOffset={4}
				>
					<TooltipProvider>
						{/* The toolbar sits right under the field it previews, so it never names the field again. */}
						<div className="flex h-9 items-center gap-1 px-1">
							{hasWhy ? (
								<ToolbarButton aria-controls={whyId} aria-expanded={expanded} hint={expanded ? "Hide why" : "Why this was suggested"} label={`Why ${field} was suggested`} onClick={() => setWhyOpen(!expanded)}>
									<LightbulbIcon color="currentColor" label="" size="small" />
								</ToolbarButton>
							) : null}
							<ToolbarButton hint="Discard" label={`Discard ${field}`} onClick={() => decide(false)}>
								<CrossIcon color="currentColor" label="" size="small" />
							</ToolbarButton>
							<ToolbarButton hint="Accept" label={`Accept ${field}`} onClick={() => decide(true)}>
								<CheckMarkIcon color="currentColor" label="" size="small" />
							</ToolbarButton>
							<span aria-hidden className="mx-1 h-4 w-px bg-border" />
							<ToolbarButton disabled={index === 0} label="Previous suggestion" onClick={() => page(-1)}>
								<ChevronLeftIcon color="currentColor" label="" size="small" />
							</ToolbarButton>
							<span aria-live="polite" className="text-xs whitespace-nowrap text-text-subtlest tabular-nums">{index + 1}/{pending.length}</span>
							<ToolbarButton disabled={index === pending.length - 1} label="Next suggestion" onClick={() => page(1)}>
								<ChevronRightIcon color="currentColor" label="" size="small" />
							</ToolbarButton>
						</div>
						<AnimatePresence initial={false}>
							{expanded ? (
								<motion.div animate={{ height: "auto", opacity: 1, transition: SETTLE }} className="overflow-hidden" exit={{ height: 0, opacity: 0, transition: SETTLE }} id={whyId} initial={{ height: 0, opacity: 0 }} key="why">
									<div className="border-t border-border-disabled">
										<WhyCard inline suggestion={current} />
									</div>
								</motion.div>
							) : null}
						</AnimatePresence>
					</TooltipProvider>
				</PopoverContent>
			) : null}
		</Popover>
	);
}
