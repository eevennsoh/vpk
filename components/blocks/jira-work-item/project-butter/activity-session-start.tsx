"use client";

import { AgentSession } from "@/components/blocks/agent-session";
import { JiraActivityEntryGlyph, type JiraActivityEventEntry, type JiraActivityReply } from "@/components/blocks/jira-activity";
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

type ThreadEventsEntry = Readonly<{ replies?: readonly JiraActivityReply[]; activityEvents?: readonly JiraActivityEventEntry[] }>;

/** The reply each event precedes, by time; events newer than every reply trail the thread. */
function threadEventAnchors({ replies = [], activityEvents = [] }: ThreadEventsEntry) {
	return activityEvents.map((event) => ({ event, replyId: replies.find((reply) => event.createdAtMs !== undefined && reply.createdAtMs !== undefined && reply.createdAtMs > event.createdAtMs)?.id }));
}

function threadEventsBeforeReply(entry: ThreadEventsEntry, replyId: string) {
	return threadEventAnchors(entry).filter((anchor) => anchor.replyId === replyId).map((anchor) => anchor.event);
}

export function trailingThreadEvents(entry: ThreadEventsEntry) {
	return threadEventAnchors(entry).filter((anchor) => anchor.replyId === undefined).map((anchor) => anchor.event);
}

/** Thread events that happened before `reply`, or null so the thread keeps no empty slot. */
export function renderThreadEventsBeforeReply(entry: ThreadEventsEntry, reply: Readonly<{ id: string }>) {
	const events = threadEventsBeforeReply(entry, reply.id);
	return events.length ? <ProjectButterThreadEvents continued events={events} /> : null;
}

export function ProjectButterThreadEvents({ events, continued = false }: Readonly<{ events?: readonly JiraActivityEventEntry[]; continued?: boolean }>) {
	return events?.map((event, index) => <div className="relative pt-3" data-jira-activity-entry-id={event.id} key={event.id}><div className="relative flex items-center gap-2"><ThreadConnector centered continued={continued || index < events.length - 1} /><span className="flex size-6 shrink-0 items-center justify-center"><JiraActivityEntryGlyph actor={event.actor} icon={event.icon} /></span><JiraActivityEvent entry={event} /></div></div>);
}
