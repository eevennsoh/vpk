export interface ProgressTask {
	id: string;
	label: string;
	description: string;
	/** Assigned by `flattenStatusGroups` — optional in raw group data */
	status?: "done" | "in-progress" | "failed" | "todo";
	agentName?: string;
	agentAvatarSrc?: string;
}

export type FlatTask = ProgressTask & { status: "done" | "in-progress" | "failed" | "todo" };

export interface ProgressStatusGroups {
	done: ProgressTask[];
	inReview: ProgressTask[];
	inProgress: ProgressTask[];
	failed: ProgressTask[];
	todo: ProgressTask[];
}

/** Helper: build a flat ordered task list from status groups */
export function flattenStatusGroups(groups: ProgressStatusGroups): FlatTask[] {
	return [
		...groups.done.map((t) => ({ ...t, status: "done" as const })),
		...groups.inReview.map((t) => ({ ...t, status: "in-progress" as const })),
		...groups.inProgress.map((t) => ({ ...t, status: "in-progress" as const })),
		...groups.failed.map((t) => ({ ...t, status: "failed" as const })),
		...groups.todo.map((t) => ({ ...t, status: "todo" as const })),
	];
}

export const MOCK_TASKS: ProgressStatusGroups = {
	done: [
		{
			id: "task-1",
			label: "Finished analysing your question",
			description: "",
		},
		{
			id: "task-2",
			label: "Broken down tasks into smaller subtasks",
			description: "",
		},
	],
	inReview: [],
	inProgress: [
		{
			id: "task-3",
			label: "Looking through feedback",
			description: "Figuring out which services are affected",
			agentName: "Agent name",
			agentAvatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
		},
	],
	failed: [],
	todo: [
		{
			id: "task-4",
			label: "Group feedback by theme",
			description: "",
		},
		{
			id: "task-5",
			label: "Generate bar chart based on time",
			description: "",
		},
		{
			id: "task-6",
			label: "Summarise analysis",
			description: "",
		},
		{
			id: "task-7",
			label: "Ask follow up questions",
			description: "",
		},
	],
};
