import type { ComponentDetail } from "@/app/data/component-detail-types";

export const HUMAN_AGENT_AVATAR_DETAIL: ComponentDetail = {
	description:
		"A human photo and an agent hexagon in one 32×32 identity. Static by default, with an optional clockwise animation that exchanges their positions and sizes, then continues rotating to the original composition.",
	demoLayout: { examplesContentWidth: "full" },
	usage: `import { HumanAgentAvatar } from "@/components/ui-custom/human-agent-avatar";

<HumanAgentAvatar
  agent={{ name: "Cursor", brandName: "cursor" }}
  human={{
    name: "Priya Raman",
    avatarSrc: "/avatar-user/ting-chen/color/asow-strategy-orange-64.png",
  }}
/>

// Optional repeating swap, with a static reduced-motion fallback.
<HumanAgentAvatar
  agent={agent}
  human={human}
  animate
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
    foregroundSwapAt: 0.5,
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
				"Rotate clockwise to exchange the 24px and 16px slots, hold, then continue in the same direction to return. Stops offscreen and falls back to static under reduced motion.",
		},
		{
			name: "composition",
			type: '"compact" | "horizontal-group"',
			description:
				"Controlled destination for one-shot transitions. Set horizontal-group to open and hold the equal-size human-first group; animate enables the transition. Reduced motion shows the destination immediately.",
		},
		{
			name: "motion",
			type: "Partial<HumanAgentAvatarMotionOptions>",
			description:
				"Live motion options: orbit or horizontal-group variation, shared turn duration, initial delay, pause between turns, pause after returning, repeats, cubic-bezier easing, direction, curvature, size swap amount, foreground timing, and offscreen pausing. All timing values use milliseconds. The Animated example exposes every option through GUI controls, with Replay, Reset, and Copy JSON.",
		},
		{
			name: "attributionOrder",
			type: '"agent-first" | "human-first"',
			default: '"agent-first"',
			description:
				"Initial composition: agent at the top left or human at the top left.",
		},
		{
			name: "sizePx",
			type: "number",
			default: "32",
			description:
				"Identity footprint in pixels. Also preserves AgentListIdentity’s existing size variants.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes on the identity frame.",
		},
	],
	examples: [
		{
			title: "Animated",
			description:
				"Tune the motion properties below. Both turns share their duration and easing, with a short 50ms pause between them. The human border and separation ring keep a constant thickness. Copy the values as JSON to reuse them through the motion prop.",
			demoSlug: "human-agent-avatar-demo-animated",
		},
		{
			title: "Horizontal group",
			description:
				"The compact identity becomes the shared 16px AvatarGroup, with the human first and agent second, then returns. Uses the same timing controls and respects reduced motion.",
			demoSlug: "human-agent-avatar-demo-horizontal-group",
		},
		{
			title: "Human first",
			description:
				"The same static identity with the human at the top left, as used by tracked Agent List work.",
			demoSlug: "human-agent-avatar-demo-human-first",
		},
	],
};
