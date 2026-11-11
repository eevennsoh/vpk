"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { actorInitials } from "@/components/blocks/agent-list/agent-list-actor";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { groupTeammateSessions } from "@/app/sandbox/agent-selector-canvas/teammate-session-model";
import { activitySummaryLabel, TeammateActivitySummary } from "@/app/sandbox/agent-selector-canvas/teammate-activity-summary";

export type TeammateApproach = "quiet" | "people" | "activity";

export function TeammateSessionDisclosure({ approach, children, items }: Readonly<{
	approach: TeammateApproach;
	children: ReactNode;
	items: readonly AgentSessionItem[];
}>) {
	const [open, setOpen] = useState(false);
	const trigger = useRef<HTMLButtonElement>(null);
	const hintId = useId();
	const teammates = groupTeammateSessions(items);
	const countsLabel = `${items.length} sessions${approach === "people" ? `, ${teammates.length} teammates` : approach === "activity" ? `, ${activitySummaryLabel(items)}` : ""}`;

	return (
		<Collapsible open={open} onOpenChange={setOpen} onKeyDown={(event) => {
			if (event.key !== "Escape" || !open || event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return;
			event.preventDefault();
			event.stopPropagation();
			setOpen(false);
			trigger.current?.focus({ preventScroll: true });
		}}>
			<CollapsibleTrigger
				ref={trigger}
				aria-describedby={hintId}
				className="flex w-full flex-col gap-2 rounded-lg px-3 py-3 text-left text-text-subtle hover:bg-bg-neutral-subtle-hovered focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				<span className="flex w-full min-w-0 items-center gap-2">
					<span className="min-w-0 flex-1 text-xs font-medium">Sessions from your teammates</span>
					{approach !== "people" ? <Badge aria-hidden="true">{items.length}</Badge> : null}
					<Icon aria-hidden className={cn("size-3 shrink-0 text-icon-subtle motion-safe:transition-transform motion-safe:duration-fast motion-safe:ease-out-practical", open ? "rotate-90" : null)} render={<ChevronRightIcon label="" size="small" />} />
				</span>
				{approach === "people" ? (
					<span aria-hidden="true" className="flex w-full items-center gap-3">
						<AvatarGroup as="span" size="sm">
							{teammates.map(({ name }) => (
								<Avatar key={name} size="sm" animate={false}>
									<AvatarFallback>{actorInitials(name)}</AvatarFallback>
								</Avatar>
							))}
						</AvatarGroup>
						<span className="min-w-0 text-xs">{items.length} sessions · {teammates.length} teammates</span>
					</span>
				) : null}
				{approach === "activity" ? <TeammateActivitySummary items={items} /> : null}
				<span className="sr-only">{countsLabel}</span>
			</CollapsibleTrigger>
			<p id={hintId} className="sr-only">Read-only. Only each session’s owner can act on it.</p>
			<CollapsibleContent
				hiddenUntilFound={false}
				aria-hidden={!open}
				inert={!open}
				className="h-(--collapsible-panel-height) overflow-hidden motion-safe:transition-[height] motion-safe:duration-normal motion-safe:ease-out-practical data-starting-style:h-0 data-ending-style:h-0 motion-safe:data-ending-style:duration-fast motion-safe:data-ending-style:ease-in has-[:focus-visible]:overflow-visible"
			>
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}
