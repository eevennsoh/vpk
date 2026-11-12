"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { TeammateSessionsDisclosure } from "@/components/blocks/agent-assignment/components/teammate-sessions-disclosure";
import type { AgentSessionItem } from "@/components/blocks/agent-session";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { activitySummaryLabel, TeammateActivitySummary } from "@/app/sandbox/agent-selector-canvas/teammate-activity-summary";

export type TeammateApproach = "quiet" | "people" | "activity";

export function TeammateSessionDisclosure({ approach, children, items }: Readonly<{
	approach: TeammateApproach;
	children: ReactNode;
	items: readonly AgentSessionItem[];
}>) {
	return approach === "people"
		? <TeammateSessionsDisclosure items={items}>{children}</TeammateSessionsDisclosure>
		: <SummarySessionDisclosure approach={approach} items={items}>{children}</SummarySessionDisclosure>;
}

function SummarySessionDisclosure({ approach, children, items }: Readonly<{
	approach: "quiet" | "activity";
	children: ReactNode;
	items: readonly AgentSessionItem[];
}>) {
	const [open, setOpen] = useState(false);
	const trigger = useRef<HTMLButtonElement>(null);
	const hintId = useId();
	const countsLabel = `${items.length} sessions${approach === "activity" ? `, ${activitySummaryLabel(items)}` : ""}`;

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
					<Badge aria-hidden="true">{items.length}</Badge>
					<Icon aria-hidden className={cn("size-3 shrink-0 text-icon-subtle motion-safe:transition-transform motion-safe:duration-fast motion-safe:ease-out-practical", open ? "rotate-90" : null)} render={<ChevronRightIcon label="" size="small" />} />
				</span>
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
