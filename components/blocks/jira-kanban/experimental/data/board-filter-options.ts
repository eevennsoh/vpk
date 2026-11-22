import { PULSE_EPICS, PULSE_SPRINTS } from "../pulse/data/pulse-scopes";
import type { BoardFilterDaysPreset, BoardFilterFieldId } from "../lib/board-filter";

export type BoardFilterOptionIcon = "epic" | "sprint" | "sub-task" | "task";

export interface BoardFilterOption {
	avatarShape?: "circle" | "square";
	avatarSrc?: string;
	description?: string;
	icon?: BoardFilterOptionIcon;
	iconClassName?: string;
	id: string;
	label: string;
	lozenge?: "danger" | "neutral" | "success";
}

/** Parent rows are epics; each epic keeps its own hue so the picker is scannable. */
const PARENT_EPIC_ICON_TONES: Readonly<Record<string, string>> = {
	"epic-pay-90": "text-icon-accent-purple",
	"epic-pay-91": "text-icon-accent-magenta",
	"epic-pay-93": "text-icon-accent-blue",
};

const SPRINT_ICON_TONES: Readonly<Record<string, string>> = {
	"sprint-23": "text-icon-accent-teal",
	"sprint-24": "text-icon-accent-green",
};

export const BOARD_FILTER_FIELD_LABELS: Readonly<Record<BoardFilterFieldId, string>> = {
	assignee: "Assignee",
	days: "Filter by days",
	labels: "Labels",
	parent: "Epic",
	project: "Atlassian Project",
	sprint: "Sprint",
	status: "Status",
	"work-type": "Work type",
};

export const BOARD_FILTER_DAYS_OPTIONS: readonly Readonly<{
	id: BoardFilterDaysPreset;
	label: string;
}>[] = [
	{ id: "today", label: "Today" },
	{ id: "yesterday", label: "Yesterday" },
	{ id: "last-3-days", label: "Last 3 days" },
	{ id: "last-7-days", label: "Last 7 days" },
	{ id: "last-30-days", label: "Last 30 days" },
	{ id: "custom", label: "Custom date range" },
];

export const BOARD_FILTER_OPTIONS: Readonly<
	Record<Exclude<BoardFilterFieldId, "assignee" | "days">, readonly BoardFilterOption[]>
> = {
	labels: [
		{ id: "no-label", label: "No label" },
		{ id: "qualification", label: "qualification" },
		{ id: "enterprise", label: "enterprise" },
		{ id: "payments-sdk", label: "payments-sdk" },
		{ id: "guest-checkout", label: "guest-checkout" },
		{ id: "ai-native-design-org", label: "ai-native-design-org" },
	],
	// Parent and Sprint are the two fields Insights actually reads. They are
	// derived from the Pulse scope fixture rather than hand-listed, so a picker
	// can never offer a scope the article cannot open — the failure a static
	// option list makes invisible until someone clicks the row.
	parent: PULSE_EPICS.map((epic) => ({
		description: epic.key,
		icon: "epic" as const,
		iconClassName: PARENT_EPIC_ICON_TONES[epic.id] ?? "text-icon-accent-purple",
		id: epic.id,
		label: epic.name,
	})),
	sprint: PULSE_SPRINTS.map((sprint) => ({
		description: sprint.key,
		icon: "sprint" as const,
		iconClassName: SPRINT_ICON_TONES[sprint.id] ?? "text-icon-accent-green",
		id: sprint.id,
		label: sprint.name,
	})),
	project: [
		{ id: "no-project", label: "No project" },
		{
			avatarShape: "square",
			avatarSrc: "/avatar-project/rocket.svg",
			id: "jira-design",
			label: "Jira Design",
		},
		{
			avatarShape: "square",
			avatarSrc: "/avatar-project/bank.svg",
			id: "pay",
			label: "Payments SDK v2 migration",
		},
		{
			avatarShape: "square",
			avatarSrc: "/avatar-project/storefront.svg",
			id: "shop",
			label: "Shop storefront",
		},
	],
	status: [
		{ id: "rfp-intake", label: "RFP Intake", lozenge: "neutral" },
		{ id: "in-progress", label: "In progress", lozenge: "neutral" },
		{ id: "in-review", label: "In review", lozenge: "neutral" },
		{ id: "blocked", label: "Blocked", lozenge: "danger" },
		{ id: "done", label: "Done", lozenge: "success" },
		{ id: "backlog", label: "Backlog", lozenge: "neutral" },
	],
	"work-type": [
		{ icon: "epic", iconClassName: "text-icon-accent-purple", id: "epic", label: "Epic" },
		{ icon: "task", iconClassName: "text-icon-accent-blue", id: "task", label: "Task" },
		{ icon: "sub-task", iconClassName: "text-icon-accent-teal", id: "sub-task", label: "Sub-task" },
	],
};
