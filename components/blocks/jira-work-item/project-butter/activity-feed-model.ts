import type { JiraActivityActor, JiraActivityCommentEntry, JiraActivityEntry, JiraActivityEventEntry, JiraActivityReply, JiraActivitySegment } from "@/components/blocks/jira-activity";
import type { ProjectButterSessionItem } from "@/components/blocks/jira-work-item/project-butter/data";
import { PROJECT_BUTTER_SESSION_EPOCH } from "@/components/blocks/jira-work-item/project-butter/data";
import { projectButterPersonAvatar } from "@/components/blocks/jira-work-item/project-butter/people";

export type ProjectButterActivityView = "Activity" | "Audit";
export type ProjectButterActivitySort = "newest" | "oldest";
/** Explore WIP filter menu: which kinds of activity the feed shows. */
export type ProjectButterActivityFilters = Readonly<{ updates: boolean; agents: boolean; comments: boolean }>;
export const PROJECT_BUTTER_ACTIVITY_FILTERS_ALL: ProjectButterActivityFilters = { updates: true, agents: true, comments: true };

const INVOCATION_PREFIX = "invocation-";
const AGENT_ADDED_PREFIX = "agent-added-";
const UPDATE_GROUP_PREFIX = "updates-";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function agentMention(agent: ProjectButterSessionItem["agent"]): JiraActivitySegment {
	return { type: "agent-mention", text: agent.name, avatarSrc: agent.avatarSrc, brandName: agent.brandName, vpkLogo: agent.vpkLogo };
}

export function projectButterSessionIdFromEntry(id: string): string | null {
	return id.startsWith(INVOCATION_PREFIX) ? id.slice(INVOCATION_PREFIX.length) : null;
}

export function projectButterSessionFollowUp(session: Pick<ProjectButterSessionItem, "title" | "followUp">): string {
	return session.followUp ?? `I'll work on ${session.title} and report back here with updates as I make progress.`;
}

function relativeLabel(atMs: number, fallback: string): string {
	const age = Math.max(0, PROJECT_BUTTER_SESSION_EPOCH - atMs);
	if (age < MINUTE) return "just now";
	if (age < HOUR) return `${Math.floor(age / MINUTE)} ${Math.floor(age / MINUTE) === 1 ? "min" : "mins"} ago`;
	if (age < 24 * HOUR) return `${Math.floor(age / HOUR)} ${Math.floor(age / HOUR) === 1 ? "hour" : "hours"} ago`;
	return fallback;
}

function agentActor(session: ProjectButterSessionItem): JiraActivityActor {
	return { id: `butter-agent-${session.agent.id ?? session.id}`, name: session.agent.name, kind: "agent", appearance: "coding", avatarSrc: session.agent.avatarSrc, brandName: session.agent.brandName, vpkLogo: session.agent.vpkLogo };
}

function personActor(name: string, avatarSrc?: string): JiraActivityActor {
	return { id: `butter-person-${name}`, name, kind: "person", avatarSrc: avatarSrc ?? projectButterPersonAvatar(name) };
}

function invoker(session: ProjectButterSessionItem): JiraActivityActor {
	const name = session.invokedBy?.name ?? "Annie Cook";
	return personActor(name, session.invokedBy?.avatarSrc);
}

/**
 * Explore WIP session start: "{Invoker} added {Agent}" on the rail, then the
 * agent's own thread — "I started a session [chip] and I am looking into it."
 * Seeded dialogue replies follow; a session without dialogue ends on its latest message.
 */
export function projectButterSessionInvocation(session: ProjectButterSessionItem): readonly [JiraActivityEventEntry, JiraActivityCommentEntry] {
	const createdAtMs = session.invokedAtMs ?? PROJECT_BUTTER_SESSION_EPOCH;
	const timestamp = relativeLabel(createdAtMs, session.timeLabel ?? "Just now");
	const person = invoker(session);
	const agent = agentActor(session);
	const added: JiraActivityEventEntry = { id: `${AGENT_ADDED_PREFIX}${session.id}`, kind: "event", actor: person, timestamp, createdAtMs: createdAtMs - 1, icon: "delegated", segments: [{ type: "text", text: `added ${session.agent.name}` }] };
	const reply = (id: string, actor: JiraActivityActor, body: string, atMs: number): JiraActivityReply => ({ id, actor, body, timestamp: relativeLabel(atMs, session.timeLabel ?? ""), createdAtMs: atMs });
	const prompt = session.prompt ? [reply(`prompt-${session.id}`, person, session.prompt, createdAtMs)] : [];
	const dialogue = (session.activityReplies ?? []).map((item) => reply(item.id, item.author === session.agent.name ? agent : personActor(item.author), item.body, createdAtMs + item.minutesAfter * MINUTE));
	const latest = dialogue.length === 0 && session.state !== "running" ? [reply(`response-${session.id}`, agent, session.message, createdAtMs + MINUTE)] : [];
	const thread: JiraActivityCommentEntry = {
		id: `${INVOCATION_PREFIX}${session.id}`, kind: "comment", actor: agent, timestamp, createdAtMs,
		body: [{ type: "text", text: `I started a session ${session.title} and I am looking into it. ${projectButterSessionFollowUp(session)}` }],
		replies: [...prompt, ...dialogue, ...latest],
		allowReply: true, defaultRepliesExpanded: false, replyPreviewCount: 1,
	};
	return [added, thread];
}

function entryKind(entry: JiraActivityEntry): keyof ProjectButterActivityFilters {
	if (entry.id.startsWith(INVOCATION_PREFIX) || entry.id.startsWith(AGENT_ADDED_PREFIX)) return "agents";
	return entry.kind === "comment" ? "comments" : "updates";
}

export function selectProjectButterActivity(entries: readonly JiraActivityEntry[], filters: ProjectButterActivityFilters, sort: ProjectButterActivitySort) {
	return entries
		.filter((entry) => filters[entryKind(entry)])
		.sort((a, b) => ((a.createdAtMs ?? 0) - (b.createdAtMs ?? 0)) * (sort === "oldest" ? 1 : -1));
}

const PINNED_TAG = { text: "Pinned", color: "gray" } as const;

/** Pinned comments lead the feed in pin order and carry a "Pinned" tag; everything else keeps its order. */
export function pinProjectButterComments(entries: readonly JiraActivityEntry[], pinnedIds: readonly string[]): readonly JiraActivityEntry[] {
	if (pinnedIds.length === 0) return entries;
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const pinned = pinnedIds.flatMap((id) => {
		const entry = byId.get(id);
		return entry?.kind === "comment" ? [{ ...entry, tag: PINNED_TAG }] : [];
	});
	const pinnedSet = new Set(pinned.map((entry) => entry.id));
	return [...pinned, ...entries.filter((entry) => !pinnedSet.has(entry.id))];
}

function joinNames(names: readonly string[]): string {
	return names.length < 2 ? names[0] ?? "" : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** "4 updates: added Claude, changed status, assignee and description." */
export function projectButterUpdateSummary(events: readonly JiraActivityEventEntry[], fieldLabels: (entry: JiraActivityEventEntry) => readonly string[]): string {
	const added = events.filter((entry) => entry.id.startsWith(AGENT_ADDED_PREFIX)).map((entry) => (entry.segments[0]?.type === "text" ? entry.segments[0].text : ""));
	const fields = [...new Set(events.filter((entry) => !entry.id.startsWith(AGENT_ADDED_PREFIX)).flatMap((entry) => fieldLabels(entry).map((label) => label.toLowerCase())))];
	const parts = [...added, ...(fields.length ? [`changed ${joinNames(fields)}`] : [])];
	return `${events.length} updates${parts.length ? `: ${parts.join(", ")}` : ""}.`;
}

export type ProjectButterUpdateGroups = ReadonlyMap<string, readonly JiraActivityEventEntry[]>;

/**
 * Collapses each run of two or more adjacent events into one summary row, as
 * Explore WIP does between comment threads. Single events stay on their own line.
 */
export function groupProjectButterUpdates(entries: readonly JiraActivityEntry[], fieldLabels: (entry: JiraActivityEventEntry) => readonly string[]) {
	const groups = new Map<string, readonly JiraActivityEventEntry[]>();
	const grouped: JiraActivityEntry[] = [];
	let run: JiraActivityEventEntry[] = [];
	const flush = () => {
		if (run.length === 1) grouped.push(run[0]);
		else if (run.length > 1) {
			const head = run[0];
			const id = `${UPDATE_GROUP_PREFIX}${head.id}`;
			groups.set(id, run);
			grouped.push({ id, kind: "event", actor: head.actor, timestamp: head.timestamp, createdAtMs: head.createdAtMs, icon: "edit", segments: [{ type: "text", text: projectButterUpdateSummary(run, fieldLabels) }] });
		}
		run = [];
	};
	for (const entry of entries) {
		// "created this work item" is the item's origin and always keeps its own row.
		if (entry.kind === "event" && entry.icon !== "created") run.push(entry);
		else {
			flush();
			grouped.push(entry);
		}
	}
	flush();
	return { entries: grouped, groups: groups as ProjectButterUpdateGroups };
}
