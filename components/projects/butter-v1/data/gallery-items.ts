import type { GalleryItem } from "@/components/blocks/gallery";

export const BUTTER_GALLERY_ITEMS: readonly GalleryItem[] = [
	{
		id: "agent-selector",
		title: "Agent selector",
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
		id: "pull-request",
		title: "Pull request",
		description: "Review a pull request.",
		size: "portrait",
	},
	{
		id: "e2e-journey",
		title: "e2e Journey",
		description: "Follow PAY-999 from preparation through delivery.",
		size: "landscape",
	},
];
