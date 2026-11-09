import type {
	JiraKanbanAgentData,
	JiraKanbanAssigneeData,
	JiraKanbanColumnData,
} from "@/components/blocks/jira-kanban";
import type { JiraIssueAgentActivity } from "@/components/blocks/jira-issue";
import type { JiraListRowData } from "@/components/blocks/jira-list";
import { AVATARS } from "@/components/projects/jira/data/avatars";
import {
	JIRA_FOR_YOU_SECTIONS,
} from "@/components/projects/jira-for-you/data";
import type {
	JiraForYouItem,
	JiraForYouStatus,
} from "@/components/projects/jira-for-you/jira-for-you-types";

const JIRA_DESIGN_STATUS_ORDER: readonly JiraForYouStatus[] = [
	"Review",
	"In progress",
	"In review",
	"To do",
	"Done",
];

const STATUS_VARIANT_BY_STATUS = {
	Review: "warning",
	"In progress": "information",
	"In review": "warning",
	"To do": "neutral",
	Done: "success",
} as const;

export const JIRA_DESIGN_WORKSPACE_SECTIONS = JIRA_FOR_YOU_SECTIONS;

const JIRA_DESIGN_WORK_ITEMS = JIRA_DESIGN_WORKSPACE_SECTIONS.flatMap(
	(section) => section.items,
);

const JIRA_DESIGN_ASSIGNEES = AVATARS.slice(0, 6).map(({ name, src }) => {
	const displayName = name.split(",", 1)[0];

	return {
		avatarSrc: src,
		id: displayName.toLocaleLowerCase().replaceAll(" ", "-"),
		name: displayName,
	};
});

const JIRA_DESIGN_ASSIGNEE_BY_ITEM_ID = new Map(
	JIRA_DESIGN_WORK_ITEMS.map((item, index) => [
		item.id,
		JIRA_DESIGN_ASSIGNEES[index % JIRA_DESIGN_ASSIGNEES.length],
	]),
);

const JIRA_DESIGN_AGENT_ACTIVITY_LABELS: Readonly<Record<string, readonly string[]>> = {
	"code-planner": [
		"Planning the implementation",
		"Checking component ownership",
		"Preparing the next steps",
	],
	"code-reviewer": [
		"Reviewing the implementation",
		"Checking edge cases",
		"Verifying test coverage",
	],
	"feedback-analyzer": [
		"Analyzing customer feedback",
		"Grouping recurring themes",
		"Preparing recommendations",
	],
	"progress-tracker": [
		"Tracking benchmark progress",
		"Checking the latest results",
		"Preparing a status update",
	],
	"readiness-checker": [
		"Checking release readiness",
		"Reviewing remaining dependencies",
		"Preparing the handoff",
	],
};

function getJiraDesignAssignee(itemId: string): JiraKanbanAssigneeData {
	const assignee = JIRA_DESIGN_ASSIGNEE_BY_ITEM_ID.get(itemId);
	if (!assignee) {
		throw new Error(`Jira Design work item "${itemId}" needs a human assignee.`);
	}

	return assignee;
}

function createJiraDesignAgentActivities(
	item: JiraForYouItem,
): readonly JiraIssueAgentActivity[] | undefined {
	if (!item.agents?.length) {
		return undefined;
	}

	const hasAwaitingAgent = item.status?.toLocaleLowerCase().includes("needs input") ?? false;

	return item.agents.map((agent, index) => {
		const labels = JIRA_DESIGN_AGENT_ACTIVITY_LABELS[agent.id ?? ""] ?? [
			"Working on the Jira issue",
			"Reviewing connected context",
			"Preparing the next update",
		];
		const state = hasAwaitingAgent && index === 0 ? "awaiting-input" as const : "working" as const;

		return {
			avatarSrc: agent.avatarSrc,
			id: `${item.id}:${agent.id ?? index}`,
			initialElapsedSeconds: item.elapsedSeconds,
			label: state === "awaiting-input" ? "Needs input" : labels[0],
			labels,
			message: state === "awaiting-input"
				? `${agent.name} needs input before continuing work on ${item.issueKey}.`
				: `${agent.name} is working on ${item.issueKey} and will add the next update to the issue.`,
			name: agent.name,
			state,
		};
	});
}

export const JIRA_DESIGN_WORK_ITEMS_BY_ID = new Map<string, JiraForYouItem>(
	JIRA_DESIGN_WORK_ITEMS.map((item) => [item.id, item]),
);

export const JIRA_DESIGN_WORK_ITEMS_BY_KEY = new Map<string, JiraForYouItem>(
	JIRA_DESIGN_WORK_ITEMS.map((item) => [item.issueKey, item]),
);

export const JIRA_DESIGN_KANBAN_COLUMNS: readonly JiraKanbanColumnData[] =
	JIRA_DESIGN_STATUS_ORDER.map((status) => {
		const cards = JIRA_DESIGN_WORK_ITEMS
			.filter((item) => item.jiraStatus === status)
			.map((item) => {
				const assignee = getJiraDesignAssignee(item.id);

				return {
					agentActivities: createJiraDesignAgentActivities(item),
					assignee,
					avatarSrc: assignee.avatarSrc,
					code: item.issueKey,
					priority: "medium" as const,
					tags: [
						{ color: "blue" as const, text: item.spaceName },
					],
					title: item.title,
				};
			});

		return {
			cards,
			count: cards.length,
			title: status,
		};
	});

export const JIRA_DESIGN_KANBAN_AGENTS: readonly JiraKanbanAgentData[] = [
	...new Map(
		JIRA_DESIGN_WORK_ITEMS
			.flatMap((item) => item.agents ?? [])
			.filter((agent) => agent.id)
			.map((agent) => [
				agent.id,
				{
					avatarSrc: agent.avatarSrc,
					byline: "Agent",
					id: agent.id ?? "",
					name: agent.name,
				} satisfies JiraKanbanAgentData,
			]),
	).values(),
];

export function createJiraDesignListRows(
	columns: readonly JiraKanbanColumnData[],
	workItemsByKey: ReadonlyMap<string, JiraForYouItem> = JIRA_DESIGN_WORK_ITEMS_BY_KEY,
): readonly JiraListRowData[] {
	return columns.flatMap((column) => column.cards.flatMap((card) => {
		const item = workItemsByKey.get(card.code);
		if (!item) {
			return [];
		}

		const status = JIRA_DESIGN_STATUS_ORDER.includes(column.title as JiraForYouStatus)
			? column.title as JiraForYouStatus
			: item.jiraStatus;

		const hasAwaitingAgent = item.status?.toLocaleLowerCase().includes("needs input") ?? false;

		return [{
			agentSessions: (item.agents ?? []).map((agent, index) => {
				const needsInput = hasAwaitingAgent && index === 0;
				return {
					id: agent.id ?? agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
					name: agent.name,
					...(agent.avatarSrc ? { avatarSrc: agent.avatarSrc } : {}),
					...(agent.brandName ? { brandName: agent.brandName } : {}),
					statusKind: needsInput ? "needs-input" as const : "working" as const,
					statusLabel: needsInput ? "Needs input" : "Working",
				};
			}),
			issueKey: item.issueKey,
			issueType: item.issueType,
			labels: [{ color: "blue", text: item.spaceName }],
			priority: card.priority,
			status,
			statusVariant: STATUS_VARIANT_BY_STATUS[status],
			summary: item.title,
		}];
	}));
}
