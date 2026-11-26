"use client";

import { useId, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import ChevronRightIcon from "@atlaskit/icon/core/chevron-right";
import { JiraActivityEntryGlyph, type JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import { JiraActivityTimestamp } from "@/components/blocks/jira-activity/jira-activity-timestamp";
import { Icon } from "@/components/ui/icon";
import { motionDuration, motionEase } from "@/lib/motion";
import "./activity-update-group.css";

/** Explore WIP umbrella row: one summary line that discloses each adjacent field change. */
export function ProjectButterUpdateGroup({ summary, timestamp, events, renderEvent, defaultOpen = false }: Readonly<{
	summary: string;
	timestamp: string;
	events: readonly JiraActivityEventEntry[];
	renderEvent: (entry: JiraActivityEventEntry) => ReactNode;
	defaultOpen?: boolean;
}>) {
	const [open, setOpen] = useState(defaultOpen);
	const reduceMotion = useReducedMotion();
	const panelId = useId();
	return (
		<div className="min-w-0" data-project-butter-update-group>
			<div className="group/activity-timestamp relative flex min-h-6 min-w-0 items-center gap-1.5">
				<button aria-controls={panelId} aria-expanded={open} className="peer min-w-0 rounded-sm text-left text-xs text-text outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-border-focused" onClick={() => setOpen((current) => !current)} type="button">
					<span aria-hidden className="absolute -left-10 top-0 flex h-6 w-8 items-center justify-center bg-surface"><Icon className={open ? "rotate-90 text-icon-subtle transition-transform duration-normal ease-out-practical" : "text-icon-subtle transition-transform duration-normal ease-out-practical"} data-update-chevron render={<ChevronRightIcon color="currentColor" label="" size="small" />} /></span>
					<span className="min-w-0">{open ? "Hide updates" : summary}</span>
				</button>
				{open ? null : <JiraActivityTimestamp className="relative z-[1]" timestamp={timestamp} />}
			</div>
			<motion.div
				animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
				aria-hidden={!open || undefined}
				className="-ml-10 overflow-hidden pl-10"
				data-project-butter-update-reveal
				hidden={!open}
				id={panelId}
				inert={!open || undefined}
				initial={false}
				transition={reduceMotion ? { duration: 0 } : { duration: motionDuration.slow, ease: motionEase.outPractical }}
			>
				<ul className="grid gap-2 pt-2">
					{events.map((entry) => <li className="-ml-10 flex min-w-0 gap-2" key={entry.id}><span aria-hidden className="flex h-6 w-8 shrink-0 items-center justify-center bg-surface" data-update-glyph><JiraActivityEntryGlyph actor={entry.actor} icon={entry.icon} /></span><div className="min-w-0 flex-1">{renderEvent(entry)}</div></li>)}
				</ul>
			</motion.div>
		</div>
	);
}
