import type { GalleryItem } from "@/components/blocks/gallery";

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
		id: "board",
		title: "Board",
		description: "The Jira board.",
		size: "1x1",
	},
	{
		id: "work-item",
		title: "Work item",
		description: "A Jira work item.",
		size: "landscape",
	},
	{
		id: "list",
		title: "List",
		description: "The Jira list.",
		size: "1x1",
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
