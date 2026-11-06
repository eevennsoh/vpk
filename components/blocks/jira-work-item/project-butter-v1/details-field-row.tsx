"use client";

import { useState, type ReactNode } from "react";
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
import { SuggestionRainbowText } from "@/components/blocks/jira-work-item/project-butter-v1/suggestion-rainbow-text";
import { cn } from "@/lib/utils";
import { PROJECT_BUTTER_DETAIL_FIELDS, type ProjectButterDetailFieldId } from "@/components/blocks/jira-work-item/project-butter-v1/details-model";
import { DETAILS_RAIL_GLIDE } from "@/components/blocks/jira-work-item/project-butter-v1/details-rail";
import { motionDuration, motionEase } from "@/lib/motion";

const FIELD_ICONS: Partial<Record<ProjectButterDetailFieldId, typeof DataNumberIcon>> = {
	parent: EpicIcon, labels: TagIcon, components: ComponentIcon, fixVersion: TagIcon,
	storyPoints: DataNumberIcon, costCenter: TagIcon, campaignGoal: TargetIcon,
	campaignBudget: DataNumberIcon, targetPlatforms: TargetIcon, estimatedReach: DataNumberIcon,
	audienceSegment: TextIcon, campaignRegion: GlobeIcon, assetObject: AssetsObjectIcon,
};

export function DetailsFieldRow({ children, filled, id, onClear, onHide, onMove, onRevealInteract, first, last, reflow = false, shimmerText }: Readonly<{
	children: ReactNode;
	filled: boolean;
	id: ProjectButterDetailFieldId;
	onClear?: () => void;
	onHide?: () => void;
	onMove: (direction: -1 | 1) => void;
	onRevealInteract?: (field: ProjectButterDetailFieldId) => void;
	first: boolean;
	last: boolean;
	/** Glide to new rail positions. A fixed layout dependency otherwise keeps Motion out of dnd-kit drags. */
	reflow?: boolean;
	shimmerText?: string;
}>) {
	const [actionsOpen, setActionsOpen] = useState(false);
	const { listeners, isDragging, setNodeRef, transform } = useSortable({ id });
	const label = PROJECT_BUTTER_DETAIL_FIELDS[id];
	const FieldIcon = id === "reporter" && !filled ? PersonIcon : FIELD_ICONS[id];
	return (
		<div
			aria-label={`${label} field`}
			className={cn("group/butter-field relative min-w-0 rounded-md touch-pan-x", isDragging ? "z-30" : undefined)}
			data-field-filled={filled}
			data-field-id={id}
			data-field-label={label}
			data-field-dragging={isDragging ? "true" : undefined}
			onFocusCapture={() => { if (shimmerText) onRevealInteract?.(id); }}
			{...listeners}
			ref={setNodeRef}
			role="group"
			style={{ transform: CSS.Transform.toString(transform), transition: isDragging ? undefined : "transform var(--duration-medium) var(--ease-out-practical)" }}
		>
			<motion.div className="min-w-0" layout="position" layoutDependency={reflow ? undefined : "settled"} transition={DETAILS_RAIL_GLIDE}>
				{filled ? <div className="mb-0.5 min-w-0 text-xs leading-4 text-text-subtle">{label}</div> : null}
				<div className="relative -mx-2 flex min-h-8 min-w-0 items-center rounded-md px-2 transition-colors duration-fast ease-out-practical hover:bg-bg-neutral-subtle-hovered focus-within:bg-bg-neutral-subtle-hovered">
					<div className={cn("flex min-w-0 flex-1 items-center gap-2 [&_[data-slot=detail-value-trigger]]:min-h-8", id !== "status" ? "pr-8" : undefined)}>
						{FieldIcon ? <IconTile aria-hidden as="span" className="text-icon-subtle" data-field-icon={id} icon={<FieldIcon label="" size="small" />} label="" size="xxsmall" variant="transparent" /> : null}
						<div className="relative min-w-0 flex-1">
							<motion.div animate={{ opacity: shimmerText ? 0 : 1 }} className="min-w-0 group-focus-within/butter-field:opacity-100!" data-project-butter-field-control initial={false} transition={{ duration: motionDuration.medium, ease: motionEase.outPractical }}>
								{children}
							</motion.div>
							<AnimatePresence initial={false}>
								{shimmerText ? <motion.div animate={{ opacity: 1 }} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden group-focus-within/butter-field:opacity-0!" exit={{ opacity: 0 }} initial={{ opacity: 0 }} key="shimmer" transition={{ duration: motionDuration.medium, ease: motionEase.outPractical }}><SuggestionRainbowText text={shimmerText} /></motion.div> : null}
							</AnimatePresence>
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
