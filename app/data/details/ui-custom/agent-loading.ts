import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_LOADING_DETAIL: ComponentDetail = {
	description:
		"A compact multi-agent status indicator with a cycling avatar stack or a vertically rolling avatar.",
	usage: `import { AgentLoading } from "@/components/ui-custom/agent-loading";

<AgentLoading
  agents={[
    {
      id: "cursor",
      name: "Cursor",
      status: "working",
      avatar: { brandName: "cursor" },
    },
    {
      id: "jira-coding-agent",
      name: "Jira Coding agent",
      status: "finished",
      avatar: {
        avatarSrc: "/avatar-agent-new/lime/auto-dev.svg",
      },
    },
  ]}
  label="Needs input…"
/>`,
	props: [
		{
			name: "agents",
			type: "readonly AgentLoadingAgent[]",
			required: true,
			description:
				"Agents to display. Fewer than two agents render nothing; multiple agents cycle while at least one has a working status.",
		},
		{
			name: "size",
			type: '"default" | "small"',
			default: '"default"',
			description: "Canvas size. Default is the authored 24×24 Ferris; small scales the same geometry to 16×16.",
		},
		{
			name: "variant",
			type: '"stack" | "vertical"',
			default: '"stack"',
			description: "Choose the overlapping avatar stack or a single avatar that rolls vertically through a gradient fade.",
		},
		{
			name: "label",
			type: "ReactNode",
			description: "Optional visible status copy rendered beside the agent visual.",
		},
		{
			name: "intro",
			type: "{ agentId: string; avatarSize: 20 | 24 }",
			description: "Animate the front agent from its original avatar size into the stack. Put the selected agent first, remount the loader to replay, and clear the intro after it finishes.",
		},
		{
			name: "aria-label",
			type: "string",
			description: "Overrides the derived agent-count, state, and names announcement.",
		},
		{
			name: "announce",
			type: "boolean",
			default: "true",
			description: "Controls whether the component exposes a polite status live region.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the status row.",
		},
	],
	examples: [
		{
			title: "Vertical",
			description: "Agents roll upward one at a time through a soft gradient fade.",
			demoSlug: "agent-loading-demo-vertical",
		},
		{
			title: "Finished",
			description: "All agents are finished, so the avatar stack remains still.",
			demoSlug: "agent-loading-demo-finished",
		},
		{
			title: "Small",
			description: "16×16 scaled-down canvas for compact rows such as a Jira issue chin.",
			demoSlug: "agent-loading-demo-small",
		},
	],
	adsLinks: [
		{
			label: "wiv-v2 TeamEU source",
			url: "https://bitbucket.org/atlassian/prototyping/branch/wiv-v2/main",
		},
	],
};
