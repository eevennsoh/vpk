"use client";

import { useId, useState, type ReactNode } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import type { JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import { JiraActivityTimestamp } from "@/components/blocks/jira-activity/jira-activity-timestamp";
import { Icon } from "@/components/ui/icon";

/** Explore WIP umbrella row: one summary line that discloses each adjacent field change. */
export function ProjectButterUpdateGroup({ summary, timestamp, events, renderEvent, defaultOpen = false }: Readonly<{
	summary: string;
	timestamp: string;
	events: readonly JiraActivityEventEntry[];
	renderEvent: (entry: JiraActivityEventEntry) => ReactNode;
	defaultOpen?: boolean;
}>) {
	const [open, setOpen] = useState(defaultOpen);
	const panelId = useId();
	return (
		<div className="min-w-0" data-project-butter-update-group>
			<div className="group/activity-timestamp relative flex min-h-6 min-w-0 items-center gap-1.5">
				<button aria-controls={panelId} aria-expanded={open} className="peer min-w-0 rounded-sm text-left text-sm text-text outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-border-focused" onClick={() => setOpen((current) => !current)} type="button">
					<span className="min-w-0">{summary}</span>
				</button>
				<JiraActivityTimestamp className="relative z-[1]" timestamp={timestamp} />
				<Icon aria-hidden className="pointer-events-none shrink-0 text-icon-subtlest opacity-0 transition-transform duration-fast ease-out-practical group-hover/activity-timestamp:opacity-100 peer-focus-visible:opacity-100 peer-aria-expanded:rotate-90 [@media(hover:none)]:opacity-100" data-activity-chevron render={<ChevronRightIcon color="currentColor" label="" size="small" />} />
			</div>
			<ul className="mt-2 grid gap-2" hidden={!open} id={panelId}>
				{open ? events.map((entry) => <li className="min-w-0" key={entry.id}>{renderEvent(entry)}</li>) : null}
			</ul>
		</div>
	);
}
