"use client";

import { AgentSession } from "@/components/blocks/agent-session";
import { JiraActivityEntryGlyph, type JiraActivityEventEntry } from "@/components/blocks/jira-activity";
import { ThreadConnector } from "@/components/blocks/jira-activity/jira-activity-comment";
import { JiraActivityEvent } from "@/components/blocks/jira-activity/jira-activity-event";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { cn } from "@/lib/utils";

export function ProjectButterSessionStart({ session, onOpen, hasReplies = false }: Readonly<{ session: ProjectButterSessionItem; onOpen: (id: string) => void; hasReplies?: boolean }>) {
	return (
		<div className={cn("relative rounded-lg border border-border bg-surface", hasReplies && "mb-3")} data-project-butter-session-start={session.id}>
			<AgentSession animateLayout={false} density="long" items={[{ ...session, updatedAtMs: session.updatedAtMs ?? session.invokedAtMs }]} onView={(item) => onOpen(item.id)} selectedItemId={null} showLinkWorkItemMenuItem={false} showWorkingSpinner={session.state === "running"} variant="large" />
		</div>
	);
}

export function ProjectButterThreadEvents({ events }: Readonly<{ events?: readonly JiraActivityEventEntry[] }>) {
	return events?.map((event) => <div className="relative pt-3" data-jira-activity-entry-id={event.id} key={event.id}><div className="relative flex items-center gap-2"><ThreadConnector centered continued={false} /><span className="flex size-6 shrink-0 items-center justify-center"><JiraActivityEntryGlyph actor={event.actor} icon={event.icon} /></span><JiraActivityEvent entry={event} /></div></div>);
}
