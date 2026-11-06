import type { ComponentDetail } from "@/app/data/component-detail-types";

export const AGENT_PROFILE_CARD_DETAIL: ComponentDetail = {
		description: "Figma-matched Rovo agent profile card with cover art, avatar attribution, partner byline, description, title actions, and an AI input affordance.",
		importStatement: `import { AgentProfileCard } from "@/components/blocks/agent-profile-card";`,
		usage: `import { AgentProfileCard } from "@/components/blocks/agent-profile-card";

<AgentProfileCard
  name="Task Improver"
  partnerName="Atlassian"
  description="Proactively assists by automatically suggesting subtasks when you start adding one and providing comment summaries."
/>`,
		examples: [
			{
				title: "Chat",
				description: "Default footer with the AI input affordance for talking to the agent.",
				demoSlug: "agent-profile-card-chat",
			},
			{
				title: "Preview",
				description: 'Footer swaps the chat box for a single "View agent" call-to-action button.',
				demoSlug: "agent-profile-card-preview",
			},
		],
		props: [
			{
				name: "name",
				type: "string",
				default: '"Task Improver"',
				description: "Agent name shown in the card header.",
			},
			{
				name: "partnerName",
				type: "string",
				default: '"Atlassian"',
				description: "Partner or creator name shown below the agent name.",
			},
			{
				name: "attributionKind",
				type: '"company" | "team" | "person"',
				default: '"company"',
				description:
					"Who published the agent. Drives the avatar badge: a company logo tile, a square team project tile, or a round person headshot.",
			},
			{
				name: "partnerLogoSrc",
				type: "string",
				description:
					"Logo or photo for the attribution badge (3p app tile, team project tile, or headshot). When omitted, a company falls back to the Atlassian glyph.",
			},
			{
				name: "verified",
				type: "boolean",
				default: "true",
				description: "Shows the verified check beside the partner name.",
			},
			{
				name: "variant",
				type: '"chat" | "preview"',
				default: '"chat"',
				description:
					'Footer affordance. "chat" shows the AI input box; "preview" swaps it for a "View agent" call-to-action button.',
			},
			{
				name: "previewActionLabel",
				type: "string",
				default: '"View agent"',
				description: 'Visible label for the "preview" variant button.',
			},
			{
				name: "onPreviewAction",
				type: "() => void",
				description: 'Called when the "preview" variant "View agent" button is selected.',
			},
			{
				name: "description",
				type: "string",
				description: "Agent summary copy shown in the body.",
			},
			{
				name: "avatarSrc",
				type: "string",
				default: '"/avatar-agent-new/blue/backlog-buddy.svg"',
				description: "Agent avatar asset.",
			},
			{
				name: "coverSrc",
				type: "string",
				description: "Cover artwork asset. Defaults to the avatar asset.",
			},
			{
				name: "inputPlaceholder",
				type: "string",
				default: '"Ask, @mention, or / for actions"',
				description: "Placeholder copy shown in the AI input affordance.",
			},
			{
				name: "inputActionLabel",
				type: "string",
				description: "Accessible label for the input affordance when it is actionable.",
			},
			{
				name: "swapActionLabel",
				type: "string",
				default: '"Chat with agent"',
				description: "Visible label for the compact header chat action.",
			},
			{
				name: "editActionLabel",
				type: "string",
				description: "Accessible label for the edit icon action.",
			},
			{
				name: "onInputAction",
				type: "(prompt: string) => void | Promise<void>",
				description: "Called with the submitted composer text.",
			},
			{
				name: "onSwapAction",
				type: "() => void",
				description: "Called when the compact header chat action is selected.",
			},
			{
				name: "onEditAction",
				type: "() => void",
				description: "Called when the edit icon action is selected.",
			},
			{
				name: "onMoreAction",
				type: "() => void",
				description: "Called when the more-actions icon button is selected.",
			},
			{
				name: "onVoiceInput",
				type: "() => void",
				description: "Called when the waveform icon button is selected.",
			},
		],
	};
