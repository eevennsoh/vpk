import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SHIMMER_WAVE_DETAIL: ComponentDetail = {
	demoLayout: { previewContentWidth: "full" },
	description:
		"A per-character 3D wave, inspired by Motion Primitives. Each glyph translates, scales, and rotates on a staggered delay while a highlight copy fades in and out over it, with full geometry, timing, and color controls. This is a sibling of Shimmer rather than a mode of it — the two share no rendering. Reach for Shimmer when you want a gradient sweep; reach for Shimmer Wave when you want per-glyph motion. Degrades to static text under prefers-reduced-motion.",
	usage: `import { ShimmerWave } from "@/components/ui-custom/shimmer-wave";

<ShimmerWave>Thinking...</ShimmerWave>
<ShimmerWave as="span" duration={1.2}>Faster wave</ShimmerWave>
<ShimmerWave
  baseColor="var(--color-muted-foreground)"
  baseGradientColor={["#1868db", "#bf63f3", "#fca700"]}
  xDistance={3}
  yDistance={-2}
  zDistance={12}
  scaleDistance={1.12}
  rotateYDistance={14}
  blurDistance={1.5}
  transition={{ ease: "easeInOut", repeatDelay: 0.1 }}
>
  Full wave configuration
</ShimmerWave>`,
	props: [
		{
			name: "children",
			type: "string",
			required: true,
			description: "The text content receiving the wave effect. Split per character.",
		},
		{
			name: "as",
			type: "ElementType",
			default: '"p"',
			description: "HTML element or React component to render as.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional CSS classes for styling.",
		},
		{
			name: "duration",
			type: "number",
			default: "1",
			description: "Animation duration in seconds for one wave cycle.",
		},
		{
			name: "spread",
			type: "number",
			default: "1",
			description: "How staggered the characters are across the wave.",
		},
		{
			name: "baseColor",
			type: "string",
			default: '"var(--color-muted-foreground)"',
			description: "Base/resting text color.",
		},
		{
			name: "baseGradientColor",
			type: "string | string[]",
			description:
				"Highlight color, or color stops interpolated across the characters.",
		},
		{
			name: "zDistance",
			type: "number",
			default: "10",
			description: "Wave depth translation on the Z axis.",
		},
		{
			name: "xDistance",
			type: "number",
			default: "2",
			description: "Wave horizontal translation distance.",
		},
		{
			name: "yDistance",
			type: "number",
			default: "-2",
			description: "Wave vertical translation distance.",
		},
		{
			name: "scaleDistance",
			type: "number",
			default: "1.1",
			description: "Peak scale multiplier for wave characters.",
		},
		{
			name: "rotateYDistance",
			type: "number",
			default: "10",
			description: "Peak Y-axis rotation for wave characters.",
		},
		{
			name: "blurDistance",
			type: "number",
			default: "0",
			description: "Peak blur in px as the wave passes each character, which then comes back into focus. 0 keeps the text sharp.",
		},
		{
			name: "transition",
			type: "Transition",
			description: "Optional Motion transition overrides for wave characters.",
		},
	],
	subComponents: [
		{
			name: "ShimmerWave",
			description:
				"Memoized Motion component that splits text per character and animates each glyph on a staggered delay, with a fading highlight copy layered over it.",
		},
	],
	examples: [
		{ title: "Basic", description: "Default wave, and a faster variant.", demoSlug: "shimmer-wave-demo-basic" },
		{ title: "Colors", description: "Neutral wave plus a dot-inspired gradient highlight using baseColor/baseGradientColor.", demoSlug: "shimmer-wave-demo-colors" },
		{ title: "Geometry", description: "Compare xDistance and yDistance permutations.", demoSlug: "shimmer-wave-demo-geometry" },
		{ title: "Depth", description: "Compare zDistance, scaleDistance, and rotateYDistance permutations.", demoSlug: "shimmer-wave-demo-depth" },
		{ title: "Timing and spread", description: "Compare duration and spread permutations.", demoSlug: "shimmer-wave-demo-timing-spread" },
		{ title: "Full config", description: "Single showcase combining all wave controls including transition override.", demoSlug: "shimmer-wave-demo-full-config" },
	],
};
