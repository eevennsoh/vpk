import type { ComponentDetail } from "@/app/data/component-detail-types";

export const HUMAN_AGENT_AVATAR_DETAIL: ComponentDetail = {
	description:
		"A human photo and an agent hexagon in a 24×24 or 32×32 identity. Static by default, with the original clockwise size-and-position swap. Animated targets default to a 24px agent and 20px human, then both return to their original sizes and positions.",
	demoLayout: { examplesContentWidth: "full" },
	usage: `import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";

<HumanAgentAvatar
  agent={{ name: "Cursor", brandName: "cursor" }}
  human={{
    name: "Priya Raman",
    avatarSrc: "/avatar-user/ting-chen/color/asow-strategy-orange-64.png",
  }}
/>

// Compact 24×24 variant. Omit sizePx for the default 32×32 variant.
<HumanAgentAvatar agent={agent} human={human} sizePx={24} />

// Optional repeating swap at either size, with a static reduced-motion fallback.
<HumanAgentAvatar
  agent={agent}
  human={human}
  animate
  sizePx={24}
  motion={{
    variant: "orbit",
    durationMs: 300,
    initialDelayMs: 0,
    betweenTurnsMs: 50,
    repeatDelayMs: 1200,
    repeat: "infinite",
    ease: [0.4, 0, 0, 1],
    direction: "clockwise",
    curvature: 2,
    scaleAmount: 1,
    pauseWhenOffscreen: true,
  }}
/>`,
	props: [
		{
			name: "agent",
			type: "{ name: string; avatarSrc?: string; brandName?: ThirdPartyLogoName; logoName?: AtlassianLogoName; vpkLogo?: 'rovo'; fallbackText?: string }",
			required: true,
			description:
				"Agent name and visual source, rendered through AgentAvatarVisual.",
		},
		{
			name: "human",
			type: "{ name: string; avatarSrc?: string }",
			required: true,
			description:
				"Human name and optional photo. Missing photos use initials.",
		},
		{
			name: "animate",
			type: "boolean",
			default: "false",
			description:
				"Use the original eased swap and return, with animated targets of a 24px agent and 20px human. Both variants restore their original resting sizes afterward. Stops offscreen and falls back to static under reduced motion.",
		},
		{
			name: "composition",
			type: '"compact" | "horizontal-group"',
			description:
				"Controlled destination for one-shot transitions. Set horizontal-group to open and hold the equal-size group in attributionOrder; animate enables the transition. Reduced motion shows the destination immediately.",
		},
		{
			name: "motion",
			type: "Partial<HumanAgentAvatarMotionOptions>",
			description:
				"Live motion options: orbit or horizontal-group variation, shared turn duration, initial delay, pause between turns, pause after returning, repeats, cubic-bezier easing, direction, curvature, capped size-swap amount, and offscreen pausing. Layer handoff follows the size crossover. All timing values use milliseconds. The Animated example exposes every option through GUI controls, with Replay, Reset, and Copy JSON.",
		},
		{
			name: "attributionOrder",
			type: '"agent-first" | "human-first"',
			default: '"agent-first"',
			description:
				"The first identity owns the larger top-left footprint; the other becomes the smaller bottom-right badge. Horizontal groups preserve this order.",
		},
		{
			name: "sizePx",
			type: "number",
			default: "32",
			description:
				"Figma variants: 24×24 with a 24px agent and 12px human, or 32×32 with a 30px agent and 16px human. The human badge extends 2px beyond the bottom right and has a 2px white stroke. Legacy 40px and 48px footprints remain supported.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes on the identity frame.",
		},
	],
	examples: [
		{
			title: "Sizes",
			description: "24×24 and 32×32 variants use the Figma agent proportions and human-badge overlap.",
			demoSlug: "human-agent-avatar-demo-sizes",
		},
		{
			title: "Animated",
			description:
				"Choose 24×24 or 32×32 and tune the original swap motion. Animated targets default to a 24px agent and 20px human. Use Agent target size and Human target size to adjust their animated destinations. Both return to their original resting sizes. Both turns share their easing and duration, with a short 50ms pause between them. The human's 2px white stroke keeps a constant thickness through the swap. Copy the values as JSON to reuse them through the motion prop.",
			demoSlug: "human-agent-avatar-demo-animated",
		},
		{
			title: "Horizontal group",
			description:
				"The compact identity becomes an equal-size AvatarGroup, with the agent first and human second by default, then returns. Supports both sizes, uses the same timing controls, and respects reduced motion.",
			demoSlug: "human-agent-avatar-demo-horizontal-group",
		},
		{
			title: "Human first",
			description:
				"The human takes the larger top-left footprint, and the agent becomes the smaller bottom-right badge.",
			demoSlug: "human-agent-avatar-demo-human-first",
		},
	],
};
