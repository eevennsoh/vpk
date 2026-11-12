import type { ComponentDetail } from "@/app/data/component-detail-types";

export const ANIMATED_DOT_DETAIL: ComponentDetail = {
	description:
		"Animated dots with staggered opacity reveal, used as a loading or thinking indicator alongside text labels. Neutral (default) uses text-subtlest or the surrounding label color; Color uses the Rovo palette.",
	usage: `import { AnimatedDot } from "@/components/ui-custom/animated-dot";

<span className="inline-flex items-baseline text-sm text-text-subtlest">
  Thinking
  <AnimatedDot />
</span>
<AnimatedDot variant="color" />`,
	props: [
		{
			name: "variant",
			type: '"neutral" | "color"',
			default: '"neutral"',
			description:
				'"neutral" uses text-subtlest when that is the label colour, or inherits whatever text colour the label uses. "color" uses the Rovo palette (or `colors` when provided). Passing `colors` selects the color variant.',
		},
		{
			name: "colors",
			type: "readonly string[]",
			default: '["#1868db", "#bf63f3", "#fca700"]',
			description:
				"Array of CSS color values for each dot. Applies to the color variant; providing this prop selects that variant.",
		},
		{
			name: "duration",
			type: "number",
			default: "1.2",
			description: "Animation cycle duration in seconds.",
		},
		{
			name: "staggerDelay",
			type: "number",
			default: "0.2",
			description: "Delay between each dot's animation start in seconds.",
		},
		{
			name: "className",
			type: "string",
			description:
				"Additional classes applied to the wrapper span. Neutral dots inherit colour; pass a text class only when the parent does not already set one.",
		},
	],
	examples: [
		{ title: "Variants", description: "Neutral (text-subtlest or matching the label colour) and Color (Rovo palette).", demoSlug: "animated-dot-demo-variants" },
		{ title: "Custom colors", description: "Dots with alternative color palettes.", demoSlug: "animated-dot-demo-custom-colors" },
		{ title: "Timing", description: "Fast, default, and slow animation speeds.", demoSlug: "animated-dot-demo-timing" },
		{ title: "Sizes", description: "Dots at various text sizes from xs to lg.", demoSlug: "animated-dot-demo-sizes" },
	],
};
