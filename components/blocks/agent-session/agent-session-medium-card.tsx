"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";

import ArrowUpIcon from "@atlaskit/icon/core/arrow-up";

import { AgentListIdentity } from "@/components/blocks/agent-list/agent-list-card";
import type { JiraIssueAgentSessionDragBinding } from "@/components/blocks/jira-issue/agent-session-drag";
import { IconTile } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";

import {
	AGENT_SESSION_ARRIVAL_OFFSET_PX,
	AGENT_SESSION_ARRIVAL_TRANSITION,
} from "./agent-session-arrival-motion";
import { AgentSessionMediumDrag } from "./agent-session-medium-drag";
import type { AgentSessionItem } from "./agent-session-types";

export function AgentSessionMediumCard({
	captured = false,
	isArriving,
	isHighlighted = false,
	isNew,
	item,
	onItemHover,
	onView,
	sessionDrag,
}: Readonly<{
	captured?: boolean;
	isArriving: boolean;
	/** Lit from the Untracked work column hovering this same session. */
	isHighlighted?: boolean;
	isNew: boolean;
	item: AgentSessionItem;
	flyout?: boolean;
	issueKey?: string;
	onAttach?: (item: AgentSessionItem) => void;
	onCreateWorkItem?: (item: AgentSessionItem) => void;
	onItemHover?: (item: AgentSessionItem | null) => void;
	onSubtasks?: (item: AgentSessionItem) => void;
	onView?: (item: AgentSessionItem) => void;
	sessionDrag?: JiraIssueAgentSessionDragBinding;
}>) {
	const shouldReduceMotion = useReducedMotion();
	const shouldPlayArrival = isArriving && !shouldReduceMotion;
	const onItemHoverRef = useRef(onItemHover);
	const isHoveredRef = useRef(false);

	useEffect(() => {
		onItemHoverRef.current = onItemHover;
	}, [onItemHover]);

	useEffect(() => () => {
		if (isHoveredRef.current) {
			onItemHoverRef.current?.(null);
		}
	}, []);

	return (
		<motion.div
			animate={shouldPlayArrival ? { opacity: 1, y: 0 } : undefined}
			className="w-[276px] max-w-full"
			data-new={isNew || undefined}
			initial={shouldPlayArrival ? { opacity: 0, y: AGENT_SESSION_ARRIVAL_OFFSET_PX } : false}
			style={{ willChange: shouldPlayArrival ? "opacity, transform" : undefined }}
			transition={AGENT_SESSION_ARRIVAL_TRANSITION}
		>
			<AgentSessionMediumDrag
				item={item}
				sessionDrag={sessionDrag}
				shouldReduceMotion={shouldReduceMotion}
			>
				{(bind) => (
					<button
						{...bind}
						className={cn(
							"relative flex h-10 w-[276px] max-w-full items-center gap-2 rounded-[10px] border border-solid bg-surface px-2 text-left",
							"transition-[background-color,border-color] duration-xxshort ease-out-practical motion-reduce:transition-none",
							"hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
							// Lit from the column, the pointer is nowhere near this row, so it
							// borrows the row's own hover rung. The resting fill is restated
							// here beside the lit one so the pair cannot drift apart; the
							// later `cn` argument still wins over the base when highlighted.
							isHighlighted ? "bg-surface-hovered" : "bg-surface hover:bg-surface-hovered",
							!captured && isNew ? "border-border-discovery" : "border-border-disabled",
							isNew ? "ring-1 ring-border-discovery" : null,
						)}
						data-captured={captured || undefined}
						data-highlighted={isHighlighted || undefined}
						data-new={isNew || undefined}
						onClick={onView === undefined ? undefined : () => onView(item)}
						onPointerEnter={() => {
							isHoveredRef.current = true;
							onItemHover?.(item);
						}}
						onPointerLeave={() => {
							isHoveredRef.current = false;
							onItemHover?.(null);
						}}
						type="button"
					>
						{isNew ? (
							<>
								<span className="sr-only">Newly synced, not yet reviewed</span>
								<span aria-hidden="true" className="absolute left-1 top-1/2 size-1 -translate-y-1/2 rounded-full bg-icon-information" />
							</>
						) : null}
						<span className="block" data-session-drag-identity="">
							<AgentListIdentity
								agent={item.agent}
								attributedBy={item.invokedBy}
								attributionOrder="agent-first"
								sizePx={32}
							/>
						</span>
						<span className="min-w-0 truncate text-sm font-medium leading-5 text-text">
							{item.title}
						</span>
						<IconTile
							className="text-icon"
							icon={<ArrowUpIcon color="currentColor" label="" size="small" />}
							iconSize="medium"
							label="Up"
							size="small"
							variant="transparent"
						/>
					</button>
				)}
			</AgentSessionMediumDrag>
		</motion.div>
	);
}
