import type { SkillsDirectorySkill } from "@/app/data/directory";

export const WORK_ITEM_SKILLS: readonly SkillsDirectorySkill[] = [
	{
		id: "summarize-work-item",
		name: "Summarize work item",
		description: "Summarize the work item's scope, status, and key details.",
		collectionId: "teamwork",
		icon: "page",
		source: "platform",
	},
	{
		id: "summarize-comments",
		name: "Summarize comments",
		description: "Summarize the discussion and its decisions or open questions.",
		collectionId: "teamwork",
		icon: "comment",
		source: "platform",
	},
	{
		id: "improve-description",
		name: "Improve description",
		description: "Rewrite the work item description for clarity and completeness.",
		collectionId: "product",
		icon: "edit",
		source: "platform",
	},
	{
		id: "suggest-child-work-items",
		name: "Suggest child work items",
		description: "Break the work into a practical set of child work items.",
		collectionId: "strategy",
		icon: "branch",
		source: "platform",
	},
	{
		id: "link-similar-work-items",
		name: "Link similar work items",
		description: "Find related work items that should be linked.",
		collectionId: "product",
		icon: "link",
		source: "platform",
	},
	{
		id: "draft-acceptance-criteria",
		name: "Draft acceptance criteria",
		description: "Turn the description into testable acceptance criteria.",
		collectionId: "software",
		icon: "skill",
		source: "platform",
	},
	{
		id: "draft-test-plan",
		name: "Draft test plan",
		description: "Outline the manual and automated checks this change needs.",
		collectionId: "software",
		icon: "curly-brackets",
		source: "platform",
	},
	{
		id: "estimate-effort",
		name: "Estimate effort",
		description: "Suggest an estimate from the scope and comparable past work.",
		collectionId: "strategy",
		icon: "chart-trend-up",
		source: "platform",
	},
	{
		id: "find-related-documents",
		name: "Find related documents",
		description: "Search Confluence for specs and decisions that affect this work.",
		collectionId: "teamwork",
		icon: "search",
		source: "platform",
	},
	{
		id: "check-mobile-impact",
		name: "Check mobile impact",
		description: "Flag the mobile web and native surfaces this change touches.",
		collectionId: "product",
		icon: "device-mobile",
		source: "platform",
	},
	{
		id: "draft-release-note",
		name: "Draft release note",
		description: "Write customer-facing release copy for this change.",
		collectionId: "software",
		icon: "megaphone",
		source: "platform",
	},
	{
		id: "schedule-follow-up",
		name: "Schedule follow-up",
		description: "Book a review slot with the assignee and reporter.",
		collectionId: "service",
		icon: "calendar",
		source: "platform",
	},
];

export const DEFAULT_PINNED_SPACE_AGENT_IDS = [
	"rfp-drafting-agent",
	"readiness-checker",
] as const;

export const DEFAULT_PINNED_WORK_ITEM_SKILL_IDS = [
	"summarize-comments",
	"improve-description",
] as const;

export const WORK_ITEM_PINNED_ITEMS_LABEL = "Pinned by space";

export function resolveWorkItemPickerOptions(
	overrides: { defaultPinnedAgentIds?: readonly string[]; pinnedItemsLabel?: string } | undefined,
	spacePinnedAgentIds: readonly string[] | undefined,
) {
	return {
		defaultPinnedAgentIds: overrides?.defaultPinnedAgentIds ?? spacePinnedAgentIds ?? DEFAULT_PINNED_SPACE_AGENT_IDS,
		pinnedItemsLabel: overrides?.pinnedItemsLabel ?? WORK_ITEM_PINNED_ITEMS_LABEL,
	};
}
