import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_SESSION_FLYOUT_DETAIL: ComponentDetail = {
	description:
		"The `/jira-golden-journeys-v0` queue session flyout, presented as one compact chat-history list. Every row feeds one shared, anchored flyout viewport, so hovering vertically between sessions moves and resizes the popup while its content crossfades. The default demo is the session-details hover card. Separate catalog examples cover the Agent States composer, an untracked-work suggestion, and a coding-lifecycle walkthrough. By default the block renders the four `/jira-golden-journeys-v0` sessions — awaiting user response, in progress, PR open, and PR merged.",
	demoLayout: { previewHeight: "fit" },
	importStatement: `import { AgentSessionFlyout } from "@/components/blocks/agent-session-flyout";`,
	usage: `import { AgentSessionFlyout } from "@/components/blocks/agent-session-flyout";

<AgentSessionFlyout />`,
	examples: [
		{
			title: "Details",
			description:
				"The default compact session hover card: host, agent Tag, PR icon and title, and checks when present.",
			demoSlug: "agent-session-flyout-demo-details",
		},
		{
			title: "Composer flyout",
			description:
				'The `content="composer"` variant replaces session details with the Agent States card so the viewer can reply without leaving the list.',
			demoSlug: "agent-session-flyout-demo-composer",
		},
		{
			title: "Untracked work",
			description:
				"AgentSession uncaptured-work cards across Needs input, Working, and Finished. Hovering a card opens the untracked-work flyout with lifecycle metadata, a corner status indicator, and an embedded PR summary so the viewer can link, create, or add as a subtask.",
			demoSlug: "agent-session-flyout-demo-untracked-work",
		},
		{
			title: "Coding lifecycle",
			description:
				"Local coding sessions sharing one details flyout: branch only, PR open with CI, CI failed, PR merged, and PR failed. Hovering between rows moves and crossfades the card as the PR icon and checks change.",
			demoSlug: "agent-session-flyout-demo-coding-lifecycle",
		},
	],
	props: [
		{
			name: "sessions",
			type: "readonly JiraSidebarSessionItem[]",
			default: "the four /jira-golden-journeys-v0 queue sessions",
			description:
				"Sessions to render, one trigger per item feeding the shared flyout. Each item's `status` (\"awaiting-input\" | \"running\" | \"pr-open\" | \"merged\" | \"stopped\") drives the work-item status and Agent States lifecycle.",
		},
		{
			name: "content",
			type: '"details" | "composer" | "untracked-work"',
			default: '"details"',
			description:
				"Hover flyout body. `details` is the session property card; `composer` is the Agent States card; `untracked-work` embeds the PR summary and suggests a Jira relationship.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the compact session-list container.",
		},
		{
			name: "showUntrackedWorkFooter",
			type: "boolean",
			default: "true",
			description:
				"Shows the untracked-work action controls and the fallback rationale when no suggested relationship is available.",
		},
		{
			name: "onLinkWorkItem",
			type: "(session: JiraSidebarSessionItem, workItemKey: string) => void",
			description: "Links the session to the suggested work item. When omitted, the action is exposed as unavailable.",
		},
		{
			name: "onCreateWorkItem",
			type: "(session: JiraSidebarSessionItem) => void",
			description: "Creates a work item from the session. When omitted, the action is exposed as unavailable.",
		},
		{
			name: "onAddAsSubtask",
			type: "(session: JiraSidebarSessionItem, workItemKey: string) => void",
			description: "Adds the session below the suggested work item. When omitted, the menu option is exposed as unavailable.",
		},
	],
};
