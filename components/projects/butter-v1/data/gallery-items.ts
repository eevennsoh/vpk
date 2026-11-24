import LightbulbIcon from "@atlaskit/icon/core/lightbulb";

import type { GalleryItem } from "@/components/blocks/gallery";
import { SUGGESTION_WORK_ITEM } from "@/components/blocks/jira-suggestion/data/suggestions";
import { defaultSuggestions, type RovoSuggestion } from "@/lib/rovo-suggestions";

export const BUTTER_AI_SUGGESTION_ITEM = { code: SUGGESTION_WORK_ITEM.key, title: SUGGESTION_WORK_ITEM.summary };
export const BUTTER_AI_SUGGESTION_STARTER_ID = "suggest-work-item-fields";

export const BUTTER_AI_SUGGESTION_GREETING = {
	suggestions: [
		{
			id: BUTTER_AI_SUGGESTION_STARTER_ID,
			label: "Suggest work item fields",
			icon: LightbulbIcon,
			type: "skill",
		},
		...defaultSuggestions.slice(1),
	] satisfies readonly RovoSuggestion[],
};

export const BUTTER_GALLERY_ITEMS: readonly GalleryItem[] = [
	{
		id: "e2e-journey",
		title: "e2e Journey",
		description: "Follow PAY-999 from preparation through delivery.",
		size: "landscape",
	},
	{
		id: "agent-selector",
		title: "Agent & app selector",
		titleLines: ["Agent", "& app", "selector"],
		description: "Choose an agent.",
		size: "portrait",
	},
	{
		id: "duplicative-sessions",
		title: "Duplicative sessions",
		description: "Choose an existing agent session or start a new one.",
		size: "landscape",
	},
	{
		id: "agent-sessions",
		title: "Agent sessions",
		description: "Agent session cards in short and long form, local and cloud.",
		size: "portrait",
	},
	{
		id: "board",
		title: "Board",
		description: "The Jira board.",
		size: "1x1",
	},
	{
		id: "board-card",
		title: "Board (Card)",
		titleLines: ["Board", "(Card)"],
		description: "A Jira kanban card on its own.",
		size: "1x1",
	},
	{
		id: "list",
		title: "List",
		description: "The Jira list.",
		size: "1x1",
	},
	{
		id: "jira-for-you",
		title: "Jira for you",
		titleLines: ["Jira for you"],
		description: "A personalized Jira workspace.",
		size: "landscape",
	},
	{
		id: "work-item",
		title: "Work item",
		description: "A Jira work item.",
		size: "landscape",
	},
	{
		id: "ai-suggestions",
		title: "AI suggestions",
		description: "Review Rovo suggestions for an empty work item.",
		size: "landscape",
	},
	{
		id: "pull-request",
		title: "Pull request",
		description: "Review a pull request.",
		size: "portrait",
	},
	{
		id: "development-panel",
		title: "Development panel",
		description: "View development activity and pull requests.",
		size: "landscape",
	},
];
