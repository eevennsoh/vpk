import type { GalleryItem } from "@/components/blocks/gallery";

/**
 * Jira Golden Journey v0 design-pattern catalog.
 *
 * Each entry is one design pattern the gallery carousel showcases. The card is a
 * labeled dock tile; selecting it reveals the pattern's design in the gallery
 * stage (see the `renderSelectedItem` prop in `../page.tsx`). Card Kanban shows a
 * single jira-issue card transitioning across agent activity states, while
 * Kanban and List show their full Jira blocks. Rovo reuses the `sidebar-chat`
 * project verbatim as an in-stage sidebar chat panel. For you shows the
 * personalized `jira-for-you` feed. Agent session shows the `agent-list`
 * block. The others are title placeholders until their design is added. Order:
 * Terminal, Rovo, Queue, For you, Card kanban, Kanban, List, Card work item,
 * Work item.
 */
export const ASX_GALLERY_ITEMS: readonly GalleryItem[] = [
	{
		id: "terminal",
		title: "Terminal",
		description: "A terminal-style view of agent sessions driven from the command line.",
		size: "landscape",
	},
	{
		id: "rovo",
		title: "Rovo",
		description: "A sidebar chat panel for conversing with Rovo agents.",
		size: "1x1",
	},
	{
		id: "queue",
		title: "Queue",
		description: "A prioritized queue of agent sessions waiting to run.",
		size: "portrait",
	},
	{
		id: "for-you",
		title: "For you",
		description: "A personalized feed of agent-session updates and suggestions.",
		size: "1x1",
	},
	{
		id: "card",
		title: "Card kanban",
		description: "A single work-item card that transitions across agent activity states.",
		size: "landscape",
	},
	{
		id: "kanban",
		title: "Kanban",
		description: "A board of agent-session work items grouped into status columns.",
		size: "portrait",
	},
	{
		id: "list",
		title: "List",
		description: "A single-column list view of agent-session work items.",
		size: "1x1",
	},
	{
		id: "agent-session",
		title: "Card work item",
		description: "A single agent session viewed end to end.",
		size: "1x1",
	},
	{
		id: "work-item",
		title: "Work item",
		description: "A single agent-session work item opened in detail.",
		size: "landscape",
	},
];
