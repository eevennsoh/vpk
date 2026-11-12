"use client";

import { useEffect, useEffectEvent, useId, useState, type ReactNode, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";
import ChevronDownIcon from "@atlaskit/icon/core/chevron-down";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RelatedCollapsiblePanel, useRelatedPanelSettle } from "@/components/blocks/jira-work-item/project-butter-v1/related-work-group";
import type { ProjectButterRelatedKind } from "@/components/blocks/jira-work-item/project-butter-v1/related-model";
import { motionDuration, motionEase } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Delay before the Related work heading appears once a second group shows (reference RELATED_HEADER_REVEAL_MS). */
const RELATED_HEADER_REVEAL_MS = 160;

/**
 * The Related work heading shows only with 2+ visible groups. Crossing from <2 to 2+ waits 160ms
 * and fades in; already 2+ on mount (or reduced motion) shows at once without animation.
 */
export function useRelatedHeaderReveal(count: number) {
	const reducedMotion = useReducedMotion();
	const [previous, setPrevious] = useState(count);
	const [ready, setReady] = useState(count >= 2);
	const [animated, setAnimated] = useState(false);
	if (previous !== count) {
		setPrevious(count);
		if (count < 2) {
			setReady(false);
			setAnimated(false);
		} else if (previous < 2 && reducedMotion) {
			setReady(true);
		}
	}
	useEffect(() => {
		if (count < 2 || ready) return undefined;
		const timer = window.setTimeout(() => {
			setReady(true);
			setAnimated(true);
		}, RELATED_HEADER_REVEAL_MS);
		return () => window.clearTimeout(timer);
	}, [count, ready]);
	return { ready: count >= 2 && ready, animated };
}

const SHORTCUTS: Readonly<Record<string, ProjectButterRelatedKind>> = { A: "attachments", C: "children", K: "linked" };

/** Shift+A / Shift+C / Shift+K open the matching composer while the work item is active. */
export function useRelatedAddShortcuts(enabled: boolean, scopeRef: RefObject<HTMLElement | null>, openRelatedAdd: (kind: ProjectButterRelatedKind) => void) {
	const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
		const kind = SHORTCUTS[event.key.toUpperCase()];
		if (!kind || !event.shiftKey || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target && (
			target.closest<HTMLElement>("[contenteditable]")?.isContentEditable ||
			target.closest("input, textarea, select, [role=combobox], [role=menu], [role=menuitem], [role=listbox], [role=option], [role=slider]")
		)) return;
		const scopeDialog = scopeRef.current?.closest('[role="dialog"]') ?? null;
		const targetDialog = target?.closest('[role="dialog"], [role="alertdialog"]') ?? null;
		if (targetDialog && targetDialog !== scopeDialog) return;
		event.preventDefault();
		openRelatedAdd(kind);
	});
	useEffect(() => {
		if (!enabled) return undefined;
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled]);
}

/**
 * The Related work section (reference Section with hideTitle/collapsible). With fewer than two groups
 * the h2 is absent, the section keeps the "Related work" name, and the content cannot collapse.
 */
export function RelatedWorkSection({ animated, children, collapsedSummary, onOpenChange, open, ready, sectionRef }: Readonly<{
	/** Fade the heading in (the 160ms reveal); false when it was already shown on mount. */
	animated: boolean;
	children: ReactNode;
	/** Rendered beside the title while collapsed. */
	collapsedSummary?: ReactNode;
	onOpenChange: (open: boolean) => void;
	/** Controlled open state (content.relatedSectionOpen). */
	open: boolean;
	/** Heading visible (2+ groups). */
	ready: boolean;
	sectionRef?: RefObject<HTMLElement | null>;
}>) {
	const titleId = useId();
	const contentId = useId();
	const expanded = ready ? open : true;
	const animating = useRelatedPanelSettle(expanded);
	return (
		<section aria-label={ready ? undefined : "Related work"} aria-labelledby={ready ? titleId : undefined} className="min-w-0" data-component="RelatedWork" id="section-linked-content" ref={sectionRef}>
			<Collapsible onOpenChange={onOpenChange} open={expanded}>
				{ready ? (
					<motion.div animate={{ opacity: 1 }} className="-ml-1 flex h-8 w-[calc(100%+4px)] min-w-0 items-center gap-2" initial={animated ? { opacity: 0 } : false} transition={{ duration: motionDuration.medium, ease: motionEase.out }}>
						<h2 className="flex h-6 min-w-0 items-center">
							<CollapsibleTrigger aria-controls={contentId} aria-label={`${open ? "Collapse" : "Expand"} Related work`} className="flex h-6 min-w-0 items-center gap-1 rounded-sm px-1 text-left text-sm font-medium text-text outline-none focus-visible:ring-2 focus-visible:ring-border-focused focus-visible:ring-offset-2">
								<span className="truncate" id={titleId}>Related work</span>
								<span aria-hidden className={cn("flex shrink-0 items-center text-icon-subtlest transition-[rotate] duration-medium ease-out-practical", !open && "-rotate-90")}><ChevronDownIcon label="" size="small" /></span>
							</CollapsibleTrigger>
						</h2>
						{open ? null : collapsedSummary}
					</motion.div>
				) : null}
				<RelatedCollapsiblePanel animating={animating} id={contentId} open={expanded}>
					<div className="flex min-w-0 flex-col">{children}</div>
				</RelatedCollapsiblePanel>
			</Collapsible>
		</section>
	);
}
