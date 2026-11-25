"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ShowMoreHorizontalIcon from "@atlaskit/icon/core/show-more-horizontal";
import DataNumberIcon from "@atlaskit/icon/core/data-number";
import EpicIcon from "@atlaskit/icon/core/epic";
import TagIcon from "@atlaskit/icon/core/tag";
import ComponentIcon from "@atlaskit/icon/core/component";
import TargetIcon from "@atlaskit/icon/core/target";
import GlobeIcon from "@atlaskit/icon/core/globe";
import TextIcon from "@atlaskit/icon/core/text";
import AssetsObjectIcon from "@atlaskit/icon-lab/core/assets-object";
import PersonIcon from "@atlaskit/icon-lab/core/person-assignee";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SuggestionValueReveal } from "@/components/blocks/jira-work-item/project-butter/suggestion-rainbow-text";
import { cn } from "@/lib/utils";
import { PROJECT_BUTTER_DETAIL_FIELDS, type ProjectButterDetailFieldId, type ProjectButterDetailOrderId } from "@/components/blocks/jira-work-item/project-butter/details-model";
import type { DetailSuggestionReveal } from "@/components/blocks/jira-work-item/project-butter/use-suggestion-fill";
import { DETAIL_VALUE_ENTRY_OFFSET, DETAIL_VALUE_HANDOFF, DETAILS_RAIL_GLIDE } from "@/components/blocks/jira-work-item/project-butter/details-rail";
import { SuggestionFieldFeedback, SuggestionLabelReveal } from "./suggestion-targets";
import { motionDuration } from "@/lib/motion";

const FIELD_ICONS: Partial<Record<ProjectButterDetailFieldId, typeof DataNumberIcon>> = {
	parent: EpicIcon, labels: TagIcon, components: ComponentIcon, fixVersion: TagIcon,
	storyPoints: DataNumberIcon, costCenter: TagIcon, campaignGoal: TargetIcon,
	campaignBudget: DataNumberIcon, targetPlatforms: TargetIcon, estimatedReach: DataNumberIcon,
	audienceSegment: TextIcon, campaignRegion: GlobeIcon, assetObject: AssetsObjectIcon,
};

export function DetailsFieldRow({ children, filled, id, onClear, onHide, onMove, first, last, reflow = false, reveal }: Readonly<{
	children: ReactNode;
	filled: boolean;
	id: ProjectButterDetailOrderId;
	onClear?: () => void;
	onHide?: () => void;
	onMove: (direction: -1 | 1) => void;
	first: boolean;
	last: boolean;
	/** Glide to new rail positions. A fixed layout dependency otherwise keeps Motion out of dnd-kit drags. */
	reflow?: boolean;
	reveal?: DetailSuggestionReveal;
}>) {
	const [actionsOpen, setActionsOpen] = useState(false);
	const { listeners, isDragging, setNodeRef, transform, transition } = useSortable({ id, transition: { duration: motionDuration.medium * 1000, easing: "var(--ease-out-practical)" } });
	const label = id === "agents" ? "Agents" : PROJECT_BUTTER_DETAIL_FIELDS[id];
	const FieldIcon = id === "agents" ? undefined : id === "reporter" && !filled ? PersonIcon : FIELD_ICONS[id];
	const fieldIcon = FieldIcon ? <IconTile aria-hidden as="span" className={filled ? "text-icon-subtle" : "text-icon-subtlest"} data-field-icon={id} icon={<FieldIcon label="" />} iconSize="medium" label="" size="small" variant="transparent" /> : null;
	const usesInlineLabel = id === "assignee" || id === "dueDate" || (id === "reporter" && filled);
	const rowReveal = usesInlineLabel ? undefined : reveal;
	const isLabels = id === "labels";
	const animateEntry = id === "parent" || id === "assetObject";
	const sweep = rowReveal ? (
		<SuggestionValueReveal
			className={cn("flex text-sm leading-5", isLabels ? "items-start" : "items-center")}
			key={rowReveal.key}
			reveal={rowReveal}
			truncate={id === "parent"}
		/>
	) : null;
	const labelsRevealing = isLabels && Boolean(rowReveal);
	const labelsWereRevealing = useRef(labelsRevealing);
	const labelsControl = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const didFinish = labelsWereRevealing.current && !labelsRevealing;
		labelsWereRevealing.current = labelsRevealing;
		const control = labelsControl.current;
		if (!didFinish || !control || control.matches(":focus-within") || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;

		const tags = control.querySelectorAll('[data-slot="tag-group"] > [data-slot="tag"]');
		const startTime = document.timeline.currentTime;
		const animations = Array.from(tags, (tag, index) => {
			const animation = tag.animate(
				[{ opacity: 0, transform: `translateY(${DETAIL_VALUE_ENTRY_OFFSET}px)` }, { opacity: 1, transform: "none" }],
				{ delay: index * (motionDuration.fast * 1000), duration: DETAIL_VALUE_HANDOFF.duration * 1000, fill: "backwards" },
			);
			if (startTime !== null) animation.startTime = startTime;
			return animation;
		});
		return () => { for (const animation of animations) animation.cancel(); };
	}, [labelsRevealing]);
	return (
		<div
			aria-label={id === "agents" ? undefined : `${label} field`}
			className={cn("group/butter-field relative min-w-0 cursor-grab rounded-md touch-pan-x", isDragging ? "z-30 cursor-grabbing" : undefined)}
			data-field-filled={filled || id === "agents"}
			data-field-id={id}
			data-field-label={label}
			data-field-dragging={isDragging ? "true" : undefined}
			onFocusCapture={reveal?.finish}
			{...listeners}
			ref={setNodeRef}
			role={id === "agents" ? undefined : "group"}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<motion.div className="min-w-0" layout="position" layoutDependency={reflow ? undefined : "settled"} transition={DETAILS_RAIL_GLIDE}>
				{filled ? <div className="mb-0.5 min-w-0 text-xs leading-4 text-text-subtle">{label}</div> : null}
				<div className="relative -mx-2 flex min-w-0 items-center rounded-md px-2 py-1.5 transition-colors duration-fast ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered" data-project-butter-detail-value-row>
					<div className={cn("flex min-w-0 flex-1 items-center gap-2 [&_:is([data-slot=popover-trigger],[data-slot=dropdown-menu-trigger],[data-slot=inline-edit-read-view])]:-my-1.5 [&_:is([data-slot=popover-trigger],[data-slot=dropdown-menu-trigger],[data-slot=inline-edit-read-view])]:min-h-0 [&_:is([data-slot=popover-trigger],[data-slot=dropdown-menu-trigger],[data-slot=inline-edit-read-view])]:py-1.5 [&_[data-slot=labels-field]]:py-0", id !== "status" ? "pr-8" : undefined)}>
						{fieldIcon}
						<div className="relative min-w-0 flex-1 has-[>[data-suggestion-preview]]:[&>[data-project-butter-field-control]:not(:focus-within)]:opacity-0!">
							<motion.div
								animate={animateEntry ? { opacity: rowReveal ? 0 : 1, y: rowReveal ? DETAIL_VALUE_ENTRY_OFFSET : 0 } : undefined}
								className={cn("min-w-0 group-focus-within/butter-field:opacity-100!", !animateEntry && rowReveal && "opacity-0")}
								data-project-butter-field-control={usesInlineLabel ? undefined : ""}
								initial={false}
								ref={isLabels ? labelsControl : undefined}
								transition={rowReveal ? { duration: motionDuration.instant } : DETAIL_VALUE_HANDOFF}
							>
								<SuggestionLabelReveal value={usesInlineLabel ? reveal : undefined}>{children}</SuggestionLabelReveal>
							</motion.div>
							{!usesInlineLabel ? <SuggestionFieldFeedback field={id} inline /> : null}
							{animateEntry || isLabels ? <AnimatePresence initial={false}>{sweep}</AnimatePresence> : sweep}
						</div>
					</div>
					<div className={cn("absolute right-1 top-1/2 flex -translate-y-1/2 shrink-0 items-center opacity-0 transition-opacity duration-fast ease-out-practical group-hover/butter-field:opacity-100 group-focus-within/butter-field:opacity-100", actionsOpen || isDragging ? "opacity-100" : undefined)} onPointerDown={(event) => event.stopPropagation()}>
						<DropdownMenu onOpenChange={setActionsOpen} open={actionsOpen}>
							<DropdownMenuTrigger render={<Button aria-label={`More ${label.toLowerCase()} field actions`} className="[&_svg]:text-icon-subtle aria-expanded:[&_svg]:text-icon-subtle" size="icon-compact" type="button" variant="ghost" />}><ShowMoreHorizontalIcon label="" size="small" /></DropdownMenuTrigger>
							<DropdownMenuContent align="end" positionerClassName="z-[700]">
								<DropdownMenuItem disabled={first} onSelect={() => onMove(-1)}>Move up</DropdownMenuItem>
								<DropdownMenuItem disabled={last} onSelect={() => onMove(1)}>Move down</DropdownMenuItem>
								{onClear || onHide ? <DropdownMenuSeparator /> : null}
								{onClear ? <DropdownMenuItem onSelect={onClear}>Clear {label.toLowerCase()}</DropdownMenuItem> : null}
								{onHide ? <DropdownMenuItem onSelect={onHide}>Hide field</DropdownMenuItem> : <DropdownMenuItem disabled>Pinned by default</DropdownMenuItem>}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</motion.div>
		</div>
	);
}
