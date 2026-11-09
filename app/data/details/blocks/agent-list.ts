import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_LIST_DETAIL: ComponentDetail = {
	description:
		'A grouped list of single-row entries styled like the Jira "For you" feed. Each row leads with an identity — hexagon art for an agent, a circular photo for a person — and a title line whose treatment reflects the state: a running session shimmers the work-item title (the shimmer alone signals progress), an awaiting session replaces the title with "Needs input" plus animated dots, an `attention` row keeps its own title beside a warning glyph (for notifications such as "Priya mentioned you"), and a complete session shows a solid title. A metadata line lists optional leading metadata, the actor name, pull-request status (PR created / PR merged; omitted until a PR exists), and the time last. Optional `summary` copy wraps below that metadata. Local sessions swap the live runtime and agent name for a devices icon, and the machine name, followed by a static timestamp. Hovering or keyboard-focusing an agent-session row opens the shared session-details flyout; `flyout="composer"` swaps that for a per-row Agent State card with a prompt composer and agent at-mentions. Non-session rows can opt out via `flyout="none"`. Every actionable row offers a primary action — Reply on person rows, Resume on local sessions, View on cloud agent sessions — plus a hover Archive icon; the action opens the Rovo floating chat in the demo.',
	demoLayout: { previewHeight: "fit" },
	importStatement: `import { AgentList } from "@/components/blocks/agent-list";`,
	usage: `import { AgentList } from "@/components/blocks/agent-list";

<AgentList
  onView={(item) => console.log("view", item.id)}
/>`,
	examples: [
		{
			title: "Compact",
			description:
				"The same session states and actions in a denser row with a 24px agent avatar and 12px title.",
			demoSlug: "agent-list-demo-compact",
		},
		{
			title: "Composer flyout",
			description:
				'The `flyout="composer"` variant keeps a per-row Agent State card instead of the list\'s shared moving flyout, preserving local composer state while the viewer replies to the agent.',
			demoSlug: "agent-list-demo-composer",
		},
	],
	props: [
		{
			name: "items",
			type: "readonly AgentListItem[]",
			default: "built-in sample data",
			description:
				"Rows to render. Each item's `state` (\"running\" | \"complete\" | \"needs-input\" | \"attention\") drives the status treatment and row actions; `attention` keeps the item's own title and shows a warning glyph, for notification rows whose title is already the news. `agent.kind` (\"agent\" | \"person\") picks the hexagon or circular avatar, so agents and teammates can share one list. Optional `summary` adds wrapping body copy below the metadata row, `metadataPrefix` a leading metadata chunk (e.g. `\"Risk · PAY-112\"`), `timeLabel` a pre-formatted time in place of the live clock, and `actionLabel` overrides the default Reply / Resume / View primary action. Local rows (`host: \"local\"`) also take `machineName` and always show a static timestamp.",
		},
		{
			name: "flyout",
			type: '"session" | "composer" | "none"',
			default: '"session"',
			description:
				"Which flyout a row opens on hover or keyboard focus. `session` uses the list's shared moving session-details surface; `composer` keeps a stateful Agent State flyout per row; `none` opens nothing, for rows that are not agent sessions and have no session to preview.",
		},
		{
			name: "variant",
			type: '"default" | "compact"',
			default: '"default"',
			description:
				"Controls row density. Compact rows use a 24px agent avatar and 12px title.",
		},
		{
			name: "chrome",
			type: '"stroke" | "raised"',
			default: '"stroke"',
			description:
				"Outer list surface. `stroke` keeps the default bordered card. `raised` drops the outer border and applies elevation.shadow.raised so Needs input can sit beside Next best action without a double outline.",
		},
		{
			name: "selectedItemId",
			type: "string",
			description:
				"Id of the session currently selected by the consuming surface. The matching row renders in the selected state and hides its hover actions.",
		},
		{
			name: "composerChatSurface",
			type: '"floating" | "sidebar"',
			default: '"sidebar"',
			description:
				"Chat surface opened after sending from the Agent State composer flyout. Consumers with a floating Rovo launcher opt into floating; other surfaces fall back to sidebar chat.",
		},
		{
			name: "onView",
			type: "(item: AgentListItem) => void",
			description:
				"Called when a card body or its primary action is activated. Person rows label the action Reply; local sessions label it Resume; cloud agent sessions keep View. A row may override that copy with `actionLabel`. In the demo this opens the Rovo floating chat.",
		},
		{
			name: "onArchive",
			type: "(item: AgentListItem) => void",
			description:
				"Called when the hover Archive icon is activated. The catalog demo removes the row from the list.",
		},
		{
			name: "onSubmitPrompt",
			type: "(item: AgentListItem, prompt: string) => void | Promise<void>",
			description:
				"Overrides the default chat destination for submissions from the Agent State composer flyout.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the root container.",
		},
	],
};
