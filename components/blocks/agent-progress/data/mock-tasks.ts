export interface ProgressTask {
	id: string;
	label: string;
	description: string;
	agentName?: string;
	agentAvatarSrc?: string;
}

export interface ProgressStatusGroups {
	done: ProgressTask[];
	inReview: ProgressTask[];
	inProgress: ProgressTask[];
	failed: ProgressTask[];
	todo: ProgressTask[];
}

export const MOCK_TASKS: ProgressStatusGroups = {
	done: [],
	inReview: [
		{
			id: "task-1",
			label: "Task 1",
			description: "Description",
		},
		{
			id: "task-2",
			label: "Task 1",
			description: "Description",
		},
		{
			id: "task-3",
			label: "Task 1",
			description: "Description",
			agentName: "Agent name",
			agentAvatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
		},
	],
	inProgress: [
		{
			id: "task-4",
			label: "Task 4",
			description: "Implement search indexing",
		},
		{
			id: "task-5",
			label: "Task 5",
			description: "Update API endpoints",
		},
		{
			id: "task-6",
			label: "Task 6",
			description: "Add error handling",
			agentName: "Backend Agent",
			agentAvatarSrc: "/avatar-agent-new/lime/auto-review.svg",
		},
	],
	failed: [
		{
			id: "task-6b",
			label: "Task 6b",
			description: "Recover failed API contract migration",
		},
	],
	todo: [
		{
			id: "task-7",
			label: "Task 7",
			description: "Write integration tests",
		},
		{
			id: "task-8",
			label: "Task 8",
			description: "Update documentation",
		},
		{
			id: "task-9",
			label: "Task 9",
			description: "Deploy to staging",
		},
	],
};
