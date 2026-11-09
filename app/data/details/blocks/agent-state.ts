import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_STATE_DETAIL: ComponentDetail = {
	description:
		"A reusable agent-state flyout for Jira work. It combines the agent identity and runtime, a state-aware update, an optional question card, a View action, and the shared compact prompt composer.",
	demoLayout: { previewHeight: "fit" },
	importStatement: `import { AgentState } from "@/components/blocks/agent-state";`,
	usage: `import { AgentState } from "@/components/blocks/agent-state";

<AgentState
  agent={{ id: "service-impact-agent", name: "Service impact agent" }}
  state="working"
  onView={() => console.log("view")}
  onSubmit={(prompt) => console.log(prompt)}
/>`,
	props: [
		{
			name: "agent",
			type: "AgentStateAgent",
			description: "Identity and avatar metadata shown in the flyout header.",
		},
		{
			name: "state",
			type: '"working" | "awaiting-input" | "completed"',
			description: "Controls the default update copy and whether an awaiting-input question can render.",
		},
		{
			name: "message",
			type: "string",
			description: "Optional state update shown beneath the agent header.",
		},
		{
			name: "question",
			type: "QuestionCardQuestion",
			description: "Optional question rendered for the awaiting-input state.",
		},
		{
			name: "onView",
			type: "() => void",
			description: "Shows the View action and handles its activation.",
		},
		{
			name: "onSubmit",
			type: "(prompt: string) => void",
			description: "Handles submissions from the compact agent composer.",
		},
	],
};
