"use client";

import type { ReactNode } from "react";

import GrowHorizontalIcon from "@atlaskit/icon/core/grow-horizontal";
import ShrinkHorizontalIcon from "@atlaskit/icon/core/shrink-horizontal";

import { CollapsedColumnLabel } from "@/components/blocks/agent-session-column/collapsed-column-label";
import type { AgentSessionColumnFrame } from "@/components/blocks/agent-session-column/agent-session-column-frame";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { KanbanCollapsedChromeStyles } from "../../column-chrome";
import { BOARD_COLUMN_ACTION_REVEAL } from "../lib/board-column-action-reveal";

const COLLAPSED_HEAD_COUNT_AT_REST = cn(
	"pointer-events-none absolute inset-0 flex items-center justify-center",
	"text-xs font-normal text-text-subtlest",
	"transition-opacity duration-normal ease-out-practical",
	"group-hover/collapsed-column:opacity-0 group-has-[:focus-visible]/collapsed-column:opacity-0",
	"motion-reduce:transition-none",
);

/**
 * Hover/focus revealed control that collapses a column into its pill, or grows
 * the pill back into a column.
 */
export function BoardColumnResizeButton({
	className,
	collapsed,
	onToggle,
	title,
}: Readonly<{
	className?: string;
	collapsed: boolean;
	onToggle: () => void;
	title: string;
}>) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							aria-label={collapsed ? `Expand ${title} column` : `Collapse ${title} column`}
							className={cn("shrink-0 [writing-mode:horizontal-tb]", className)}
							onClick={onToggle}
							size="icon-compact"
							type="button"
							variant="ghost"
						/>
					}
				>
					<Icon
						className="text-icon-subtle"
						render={
							collapsed
								? <GrowHorizontalIcon label="" size="small" />
								: <ShrinkHorizontalIcon label="" size="small" />
						}
					/>
				</TooltipTrigger>
				<TooltipContent>{collapsed ? "Expand" : "Collapse"}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/**
 * The collapsed form of a board column.
 *
 * Caption: the count stays in the header row above a stroked pill, and the
 * title reads top-to-bottom inside that pill. Enclosed: count and title live
 * inside one sunken box. The count uses the same 24px row Untracked uses, inset
 * by the expanded well header's top padding, so a collapsed Untracked number
 * shares a row with an expanded status count. Title padding sits below. The
 * pill hugs its content rather than running the column's full height. The
 * shell around it still stretches, so the drop target keeps the full height
 * every other column has.
 *
 * No `overflow-hidden` on the pill: the title carries its own `truncate`,
 * and enclosed puts the expand control inside the same box, where clipping
 * would slice its focus ring. The 32px inner width is the shell content
 * box — do not reuse `space.150` as inline pad.
 */
export function CollapsedBoardColumn({
	chrome,
	count,
	headerFrame,
	onExpand,
	title,
}: Readonly<{
	chrome: KanbanCollapsedChromeStyles;
	count: number;
	headerFrame: AgentSessionColumnFrame;
	onExpand: () => void;
	title: string;
}>): ReactNode {
	const countRow = (
		<div className="group/collapsed-column w-full">
			<div className="relative flex h-6 w-full items-center justify-center">
				<span className={COLLAPSED_HEAD_COUNT_AT_REST}>
					{count}
				</span>
				<BoardColumnResizeButton
					className={cn(
						BOARD_COLUMN_ACTION_REVEAL,
						"group-hover/collapsed-column:pointer-events-auto group-hover/collapsed-column:opacity-100",
						"group-has-[:focus-visible]/collapsed-column:pointer-events-auto group-has-[:focus-visible]/collapsed-column:opacity-100",
					)}
					collapsed
					onToggle={onExpand}
					title={title}
				/>
			</div>
		</div>
	);
	return (
		<CollapsedColumnLabel
			appearance={chrome}
			countRow={countRow}
			headerFrame={headerFrame}
			title={title}
		/>
	);
}
