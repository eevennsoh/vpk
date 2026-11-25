/** Demo people and subtasks shared by the Jira issue block demos. */

export const JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS = [
	{
		id: "andrea-wilson",
		name: "Andrea Wilson",
		avatarSrc: "/avatar-user/andrea-wilson/color/asow-service-yellow.png",
		avatarShape: "circle",
	},
	{
		id: "andrew-park",
		name: "Andrew Park",
		avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
		avatarShape: "circle",
	},
	{
		id: "priya-hansra",
		name: "Priya Hansra",
		avatarSrc: "/avatar-user/priya-hansra/color/asow-service-yellow.png",
		avatarShape: "circle",
	},
] as const;

export const JIRA_ISSUE_DEMO_SUBTASKS = [
	{
		summary: "Review Venn's test design pattern proposal",
		issueKey: "JDSN-230",
		status: "To Do",
		assigneeUnassignedKind: "person",
	},
] as const;

export const PROJECT_BUTTER_DEMO_SUBTASKS = [
	...JIRA_ISSUE_DEMO_SUBTASKS,
	{
		issueKey: "PD-41",
		summary: "Build the date-range picker",
		status: "Done",
		priority: "major",
		assigneeAvatarSrc: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[0].avatarSrc,
		assigneeAvatarLabel: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[0].name,
	},
	{
		issueKey: "PD-42",
		summary: "Support keyboard navigation",
		status: "In Progress",
		priority: "critical",
		assigneeAvatarSrc: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[1].avatarSrc,
		assigneeAvatarLabel: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[1].name,
	},
	{
		issueKey: "PD-43",
		summary: "Add preset date ranges",
		status: "Done",
		priority: "medium",
		assigneeAvatarSrc: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[2].avatarSrc,
		assigneeAvatarLabel: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[2].name,
	},
	{
		issueKey: "PD-44",
		summary: "Handle timezone boundaries",
		status: "In Progress",
		priority: "major",
		assigneeAvatarSrc: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[1].avatarSrc,
		assigneeAvatarLabel: JIRA_ISSUE_UNCAPTURED_WORK_PARTICIPANTS[1].name,
	},
	{
		issueKey: "PD-45",
		summary: "Test date-range edge cases",
		status: "To Do",
		priority: "minor",
		assigneeUnassignedKind: "person",
	},
] as const;
