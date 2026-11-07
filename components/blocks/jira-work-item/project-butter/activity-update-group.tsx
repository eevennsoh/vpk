"use client";

import { useId, useState, type ReactNode } from "react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import type { JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

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
			<div className="flex min-h-6 min-w-0 items-center gap-2">
				<button aria-controls={panelId} aria-expanded={open} className="flex min-w-0 items-center gap-1 rounded-sm text-left text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-border-focused" onClick={() => setOpen((current) => !current)} type="button">
					<span className="min-w-0">{summary}</span>
					<Icon aria-hidden className={cn("shrink-0 text-icon-subtle transition-transform duration-fast ease-out-practical", open ? "rotate-90" : null)} render={<ChevronRightIcon color="currentColor" label="" size="small" />} />
				</button>
				<span className="shrink-0 text-xs text-text-subtlest">{timestamp}</span>
			</div>
			<ul className="mt-2 grid gap-2" hidden={!open} id={panelId}>
				{open ? events.map((entry) => <li className="min-w-0" key={entry.id}>{renderEvent(entry)}</li>) : null}
			</ul>
		</div>
	);
}
