import type { ComponentDetail } from "@/app/data/component-detail-types";

export const ANIMATED_ICON_DETAIL: ComponentDetail = {
	description:
		"A set of SVG-level animated AI action icons (Generate text, Summarize text, Search, AI sparkle, Code, Suggest, Rovo chat). Each icon stays static on mount and plays its bespoke per-stroke motion on hover or keyboard focus — or imperatively via a shared playToken, so a single control can replay a whole grid. Built with Motion for React; an optional singleColor=false mode reveals Rovo gradient accents.",
	usage: `import { AnimatedIcon } from "@/components/ui-custom/animated-icon";

// Render an animated icon by name; label it for assistive tech.
<AnimatedIcon name="ai-search" label="Search" />
<AnimatedIcon name="ai-sparkle" label="AI" />
<AnimatedIcon name="magic-wand" label="Suggest" size={32} />
<AnimatedIcon name="rovo-chat" label="Rovo chat" singleColor={false} />

// Replay many at once by bumping a shared token:
<AnimatedIcon name="ai-generative-text" label="Generate text" playToken={token} />`,
	props: [
		{
			name: "name",
			type: '"ai-generative-text" | "ai-generative-text-summary" | "ai-search" | "ai-sparkle" | "angle-brackets" | "magic-wand" | "rovo-chat"',
			description:
				"Which animated icon to render. Use the animatedIconNames export to enumerate them.",
		},
		{
			name: "label",
			type: "string",
			description:
				"Accessible label for the icon. Omit (or leave empty) to render it decoratively (aria-hidden).",
		},
		{
			name: "size",
			type: "number",
			default: "20",
			description: "Icon size in pixels.",
		},
		{
			name: "color",
			type: "string",
			default: '"currentColor"',
			description: "Icon color. Defaults to currentColor so it inherits the text color.",
		},
		{
			name: "singleColor",
			type: "boolean",
			default: "true",
			description: "When false, the icon reveals its multi-color Rovo gradient accents instead of a single solid color.",
		},
		{
			name: "replayOnHover",
			type: "boolean",
			default: "true",
			description: "Replay the motion while the pointer is over the icon.",
		},
		{
			name: "replayOnFocus",
			type: "boolean",
			default: "true",
			description: "Replay the motion while the icon is keyboard-focused.",
		},
		{
			name: "playToken",
			type: "number",
			description:
				"Change this value to replay the motion imperatively (e.g. a \"Replay all\" button bumping a shared token across many icons).",
		},
		{
			name: "className",
			type: "string",
			description: "Additional CSS classes applied to the wrapper (e.g. icon color).",
		},
	],
	examples: [
		{ title: "Basic", description: "AI action icons that stay static on mount, replay on hover, or replay all via a button.", demoSlug: "animated-icon" },
		{ title: "Gradient accents", description: "singleColor=false reveals each icon's Rovo gradient accents during the animation.", demoSlug: "animated-icon-demo-rainbow" },
	],
};
