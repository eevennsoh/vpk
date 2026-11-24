"use client";

import { useState } from "react";
import { JiraBacklog, type JiraBacklogInlineCreate, type JiraBacklogItem, type JiraBacklogSprintMove } from "@/components/blocks/jira-backlog";
import { PROJECT_BUTTER_AGENTS } from "@/components/blocks/jira-issue/project-butter-agents";
import type { JiraListAssignedAgent, JiraListPerson } from "@/components/blocks/jira-list/jira-list-types";

const PEOPLE = [
	{ id: "dirk", name: "Dirk Pink", avatarSrc: "/avatar-user/dirk-pink/color/asow-dev-lime.png" },
	{ id: "fay", name: "Fay Dingaway", avatarSrc: "/avatar-user/fay-dingaway/color/asow-product-purple.png" },
	{ id: "laila", name: "Laila Ali", avatarSrc: "/avatar-user/laila-ali/color/asow-teamwork-blue.png" },
	{ id: "roshini", name: "Roshini Malik", avatarSrc: "/avatar-user/roshini-malik/color/asow-strategy-orange.png" },
] as const satisfies readonly JiraListPerson[];

const AGENTS_BY_ID = new Map(PROJECT_BUTTER_AGENTS.map((agent) => [agent.id, agent]));

function demoSessions(item: JiraBacklogItem, agentIds: readonly string[]): JiraListAssignedAgent[] {
	return agentIds.flatMap((id) => {
		const existing = item.agentSessions?.find((session) => session.id === id);
		if (existing) return [existing];

		const agent = AGENTS_BY_ID.get(id);
		return agent ? [{ ...agent, sessionTitle: item.summary, statusKind: "working", statusLabel: "Working" }] : [];
	});
}

function initialItems(): JiraBacklogItem[] {
	return INITIAL_ITEMS.map((item) => {
		switch (item.issueKey) {
			case "R1S-1": return { ...item, agentSessions: demoSessions(item, ["cursor"]) };
			case "R1S-5": return { ...item, agentSessions: demoSessions(item, ["claude"]) };
			case "R1S-8": return {
				...item,
				agentSessions: demoSessions(item, ["rovoSupport"]).map((session) => ({
					...session,
					statusKind: "needs-input",
					statusLabel: "Needs input",
				})),
			};
			default: return item;
		}
	});
}

const INITIAL_ITEMS: JiraBacklogItem[] = [
	{ id: "1", issueKey: "R1S-1", summary: "Center console HMI zone redesign", issueType: "story", priority: "major", status: "In progress", assignee: PEOPLE[0] },
	{ id: "3", issueKey: "R1S-3", summary: "Finalise 2026 exterior color palette", issueType: "task", priority: "minor", status: "In review", assignee: PEOPLE[1] },
	{ id: "8", issueKey: "R1S-8", summary: "DRL headlamp brand validation", issueType: "task", priority: "major", status: "In review" },
	{ id: "2", issueKey: "R1S-2", summary: "Design ambient interior lighting zones", issueType: "task", priority: "medium", status: "To do", assignee: PEOPLE[2] },
	{ id: "4", issueKey: "R1S-4", summary: "Launch Edition interior material brief", issueType: "task", priority: "major", status: "To do", assignee: PEOPLE[3] },
	{ id: "6", issueKey: "R1S-6", summary: "Wading mode driver feedback patterns", issueType: "task", priority: "medium", status: "To do" },
	{ id: "9", issueKey: "R1S-9", summary: "Instrument cluster night-mode legibility", issueType: "task", priority: "minor", status: "To do" },
	{ id: "10", issueKey: "R1S-10", summary: "Powered frunk microinteraction design", issueType: "task", priority: "major", status: "To do" },
	{ id: "5", issueKey: "R1S-5", summary: "Adventure trim badge specification", issueType: "story", priority: "trivial", status: "In progress", assignee: PEOPLE[0] },
	{ id: "11", issueKey: "R1S-11", summary: "Off-road HUD telemetry display", issueType: "story", priority: "major", status: "In progress" },
	{ id: "7", issueKey: "R1S-7", summary: "Gear Guard camera view redesign", issueType: "story", priority: "major", status: "Done", assignee: PEOPLE[1] },
	{ id: "12", issueKey: "R1S-12", summary: "Seat ergonomics benchmark report", issueType: "task", priority: "trivial", status: "Done" },
];

export default function JiraBacklogDemo() {
	const [items, setItems] = useState(initialItems);
	const [sprintSize, setSprintSize] = useState(3);
	const sprint = items.slice(0, sprintSize);
	const backlog = items.slice(sprintSize);
	function moveBoundary({ itemIds, destination }: JiraBacklogSprintMove) {
		const movedIds = new Set(itemIds);
		const movedIssueKeys = new Set(items.filter(({ id }) => movedIds.has(id)).map(({ issueKey }) => issueKey));
		const moves = (item: JiraBacklogItem) => movedIds.has(item.id) || (item.parentIssueKey !== undefined && movedIssueKeys.has(item.parentIssueKey));
		const moved = items.filter(moves);
		const nextSprint = destination === "sprint" ? [...sprint, ...moved] : sprint.filter((item) => !moves(item));
		const nextBacklog = destination === "sprint" ? backlog.filter((item) => !moves(item)) : [...moved, ...backlog];
		setItems([...nextSprint, ...nextBacklog]);
		setSprintSize(nextSprint.length);
	}
	function createItem({ sectionId, summary, parentIssueKey, insertion }: JiraBacklogInlineCreate) {
		const inSprint = sectionId === "sprint-4";
		const anchor = items.findIndex(({ issueKey }) => issueKey === insertion?.relativeToIssueKey);
		const index = anchor >= 0 ? anchor + Number(insertion?.position === "after") : inSprint ? sprintSize : items.length;
		const id = `R1S-${Math.max(...items.map(({ issueKey }) => Number(issueKey.split("-").at(-1)))) + 1}`;
		const item: JiraBacklogItem = { id, issueKey: id, summary, parentIssueKey, issueType: parentIssueKey ? "subtask" : "task", status: "To do", priority: "medium" };
		setItems([...items.slice(0, index), item, ...items.slice(index)]);
		if (inSprint) setSprintSize(sprintSize + 1);
		return id;
	}
	function reorderItems(sectionId: string, keys: readonly string[]) {
		const inSprint = sectionId === "sprint-4";
		const section = inSprint ? sprint : backlog;
		const byKey = new Map(section.map((item) => [item.issueKey, item]));
		const ordered = keys.flatMap((key) => {
			const item = byKey.get(key);
			byKey.delete(key);
			return item ? [item] : [];
		});
		const next = [...ordered, ...byKey.values()];
		setItems(inSprint ? [...next, ...backlog] : [...sprint, ...next]);
	}
	return (
		<div className="min-w-0 bg-surface p-4 md:p-6">
			<JiraBacklog
				sprints={[{ id: "sprint-4", title: "R1S Design Sprint 4", dateLabel: "3 Mar – 17 Mar", items: sprint }]}
				backlog={backlog}
				sprintBoundary={{
					sprintId: "sprint-4",
					onMove: moveBoundary,
				}}
				people={PEOPLE}
				onCreate={createItem}
				onReorder={reorderItems}
				onAssignedAgentIdsChange={(issueKey, agentIds) => setItems((current) => current.map((item) => (
					item.issueKey === issueKey ? { ...item, agentSessions: demoSessions(item, agentIds) } : item
				)))}
				onStatusChange={(id, status) => setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item))}
				onAssigneeChange={(id, assignee) => setItems((current) => current.map((item) => item.id === id ? { ...item, assignee } : item))}
			/>
		</div>
	);
}
