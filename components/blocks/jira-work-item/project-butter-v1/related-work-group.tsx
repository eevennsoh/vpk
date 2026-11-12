"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motionDuration } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Tracks whether a height-animated panel has settled open, so it can switch back to
 * `overflow: visible` (the Show N more pill and tilted pile cards sit outside the box).
 * Any false -> true flip of `open` counts, whether from the trigger or a programmatic open
 * (add requests, file drops, revealKey), so content never spills while the height tweens.
 */
export function useRelatedPanelSettle(open: boolean) {
	const reducedMotion = useReducedMotion();
	const [previous, setPrevious] = useState(open);
	const [animating, setAnimating] = useState(false);
	if (previous !== open) {
		setPrevious(open);
		setAnimating(open && !reducedMotion);
	}
	useEffect(() => {
		if (!animating) return undefined;
		const timer = window.setTimeout(() => setAnimating(false), motionDuration.slow * 1000);
		return () => window.clearTimeout(timer);
	}, [animating]);
	return animating;
}

/** Height-animated collapsible content shared by the Related work section and its groups. */
export function RelatedCollapsiblePanel({ animating, children, contentLabel, contentRole, id, open }: Readonly<{
	animating: boolean;
	children: ReactNode;
	contentLabel?: string;
	contentRole?: "group";
	id: string;
	open: boolean;
}>) {
	return (
		<CollapsibleContent
			aria-hidden={open ? undefined : true}
			className={cn(
				"h-(--collapsible-panel-height) min-w-0 transition-[height] duration-slow ease-in-out data-starting-style:h-0 data-ending-style:h-0",
				open && !animating ? "overflow-visible" : "overflow-hidden",
			)}
			hiddenUntilFound={false}
			id={id}
			inert={open ? undefined : true}
			keepMounted
		>
			<div aria-label={contentLabel} className={cn("relative min-w-0 transition-opacity ease-in", open ? "opacity-100 duration-normal" : "opacity-0 duration-0")} role={contentRole}>
				{children}
			</div>
		</CollapsibleContent>
	);
}

export type RelatedGroupType = "attachments" | "subitems" | "linked";

export interface RelatedWorkGroupProps {
	/** DOM id: section-attachments | section-subitems | section-linked-items. */
	id: string;
	relatedType: RelatedGroupType;
	label: string;
	/** Subtlest text after the label, e.g. the active attachment filter. Included in the trigger name. */
	titleMeta?: string;
	/** Visual indicator after the label (e.g. the child progress ring). Receives the open state. */
	indicator?: ReactNode | ((open: boolean) => ReactNode);
	/** Spoken form of the indicator, appended to the trigger name. */
	indicatorLabel?: string;
	/** Trailing header tabs (attachment filters). Revealed on group hover with `extra`. */
	tabs?: ReactNode;
	/** Trailing header actions (+, More actions / display options), 4px apart. */
	extra?: ReactNode;
	/** Labels go font-medium while the Related work heading is hidden (fewer than 2 groups). */
	asSectionHeader?: boolean;
	/** 4px title-to-content by default; 8px for child work. Tabs use 12px. */
	headingGap?: "default" | "wide";
	/** Any change forces the group open (add requests, file drop). */
	revealKey?: number;
	children: ReactNode;
}

/** The reference ContextTableGroup: collapsible group with hover-revealed header actions. */
export function RelatedWorkGroup({ asSectionHeader = false, children, extra, headingGap = "default", id, indicator, indicatorLabel, label, relatedType, revealKey = 0, tabs, titleMeta }: Readonly<RelatedWorkGroupProps>) {
	const contentId = useId();
	const [open, setOpen] = useState(true);
	const [seenReveal, setSeenReveal] = useState(revealKey);
	if (seenReveal !== revealKey) {
		setSeenReveal(revealKey);
		if (!open) setOpen(true);
	}
	const animating = useRelatedPanelSettle(open);
	const name = `${open ? "Collapse" : "Expand"} ${label}${titleMeta ? ` ${titleMeta}` : ""}${indicatorLabel ? ` ${indicatorLabel}` : ""}`;
	return (
		<Collapsible onOpenChange={setOpen} open={open}>
			<div
				className={cn(
					"group/related-group flex flex-col transition-[gap,padding] duration-medium ease-in-out",
					!open ? "gap-0 pb-3.5" : tabs ? "gap-3 pb-5.5" : headingGap === "wide" ? "gap-2 pb-5.5" : "gap-1 pb-5.5",
				)}
				data-collapsed={open ? undefined : true}
				data-component="ContextTableGroup"
				data-related-type={relatedType}
				data-section-header={asSectionHeader || undefined}
				id={id}
			>
				<div className="group/related-header flex h-8 min-w-0 items-center gap-2">
					<h3 className="flex min-w-0 items-center">
						<CollapsibleTrigger aria-controls={contentId} aria-label={name} className="flex min-w-0 items-center gap-1 rounded-sm bg-transparent text-left text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-border-focused focus-visible:ring-offset-2">
							<span className={cn("truncate", asSectionHeader ? "font-medium" : "font-normal")}>{label}</span>
							{titleMeta ? <span className="truncate text-text-subtlest">{titleMeta}</span> : null}
							{indicator ? <span className="flex shrink-0 items-center">{typeof indicator === "function" ? indicator(open) : indicator}</span> : null}
							<span aria-hidden className={cn("flex shrink-0 items-center text-icon-subtlest transition-[opacity,rotate] duration-normal ease-in-out", open ? "opacity-0 group-hover/related-header:opacity-100 group-focus-within/related-header:opacity-100" : "-rotate-90 opacity-100")}>
								<ChevronDownIcon label="" size="small" />
							</span>
						</CollapsibleTrigger>
					</h3>
					{open && (tabs || extra) ? (
						<div className="pointer-events-none ml-auto flex shrink-0 items-center gap-2 opacity-0 transition-opacity duration-normal ease-out-practical group-hover/related-group:pointer-events-auto group-hover/related-group:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 has-[[aria-expanded=true]]:pointer-events-auto has-[[aria-expanded=true]]:opacity-100" data-related-group-actions>
							{tabs}
							{extra ? <div className="flex items-center gap-1">{extra}</div> : null}
						</div>
					) : null}
				</div>
				<RelatedCollapsiblePanel animating={animating} contentLabel={label} contentRole="group" id={contentId} open={open}>
					{children}
				</RelatedCollapsiblePanel>
			</div>
		</Collapsible>
	);
}
