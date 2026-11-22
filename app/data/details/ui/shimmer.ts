import type { ComponentDetail } from "@/app/data/component-detail-types";

export const SHIMMER_DETAIL: ComponentDetail = {
	description:
		"Adds a shimmer effect to text, for loading and in-progress states. Shimmer renders the `shimmer` utility from shadcn's Tailwind stylesheet, which is pure CSS: the text is painted with `background-clip: text` and the highlight, derived from `currentColor`, sweeps across it in a seamless loop and brightens automatically in dark mode. Every utility modifier (color, duration, spread, angle, reverse, once, none) composes through `className`, including under variants like `md:`, and the utility also works on any text element without the component. When the user prefers reduced motion the animation is disabled automatically and the text renders normally. For the per-character 3D wave, use Shimmer Wave.",
	usage: `import { Shimmer } from "@/components/ui/shimmer";

<Shimmer>Generating response…</Shimmer>
<Shimmer as="span" duration={1}>Generating response…</Shimmer>
<Shimmer className="shimmer-color-blue-500/60 shimmer-angle-45">Generating response…</Shimmer>

// The effect is a utility, so it also works without the component
<MarkerContent className="shimmer">Thinking…</MarkerContent>`,
	props: [
		{
			name: "children",
			type: "string",
			required: true,
			description: "The text content receiving the shimmer effect.",
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
			description:
				"Additional CSS classes. Accepts the shimmer utility modifiers: shimmer-color-*, shimmer-duration-*, shimmer-spread-*, shimmer-angle-*, shimmer-once, shimmer-reverse, and shimmer-none.",
		},
		{
			name: "duration",
			type: "number",
			description:
				"Seconds for one sweep. Overrides the utility default (2s). Omit to leave shimmer-duration-* free to control it.",
		},
		{
			name: "spread",
			type: "number",
			description:
				"Highlight band width as a multiplier of text length (resolves to children.length * spread pixels). Overrides the utility default (3ch + 40px). Omit to leave shimmer-spread-* free to control it.",
		},
		{
			name: "baseColor",
			type: "string",
			default: "text-muted-foreground",
			description:
				"Resting text color. The utility derives both the gradient base and its highlight from currentColor, so this sets color rather than a bespoke variable.",
		},
	],
	subComponents: [
		{
			name: "Shimmer",
			description:
				"Memoized polymorphic element carrying the shimmer utility class. Forwards remaining HTML attributes, so dir, role, and aria-* pass through.",
		},
	],
	examples: [
		{ title: "With Marker", description: "The utility composes with any component that renders text, such as a Marker showing a live status while the assistant is working.", demoSlug: "shimmer-demo-marker" },
		{ title: "Color", description: "Set the highlight color with shimmer-color-*: a theme color with an optional opacity modifier, or any arbitrary color value.", demoSlug: "shimmer-demo-color" },
		{ title: "Duration", description: "Set the length of one sweep with the duration prop in seconds (or shimmer-duration-* in milliseconds). The default is 2s.", demoSlug: "shimmer-demo-duration" },
		{ title: "Spread", description: "Set the width of the highlight band on the spacing scale with shimmer-spread-*, or an arbitrary length such as shimmer-spread-[5rem]. The default is calc(3ch + 40px).", demoSlug: "shimmer-demo-spread" },
		{ title: "Spread multiplier", description: "The spread prop sizes the band relative to the text length instead: narrow, wide, and extra wide.", demoSlug: "shimmer-demo-spread-multiplier" },
		{ title: "Angle", description: "Set the tilt of the highlight band in degrees with shimmer-angle-*. The default is 20.", demoSlug: "shimmer-demo-angle" },
		{ title: "Reverse", description: "Sweep the highlight in the opposite direction with shimmer-reverse.", demoSlug: "shimmer-demo-reverse" },
		{ title: "Play Once", description: "Play a single sweep with shimmer-once, useful as a reveal when streaming completes. Pair it with duration to control how long the sweep takes.", demoSlug: "shimmer-demo-once" },
		{ title: "Disabling the Shimmer", description: "Turn the effect off with shimmer-none. It works in any class order, so the typical use is responsive or stateful.", demoSlug: "shimmer-demo-disabled" },
		{ title: "Fallback", description: "Older browsers without relative color syntax and color-mix() can render the text transparent. Apply shimmer conditionally with a supports-* variant on a plain element.", demoSlug: "shimmer-demo-fallback" },
		{ title: "RTL", description: "The sweep follows the reading direction, left to right in LTR and right to left in RTL, with no extra classes.", demoSlug: "shimmer-demo-rtl" },
		{ title: "Polymorphic", description: "Render as a heading or span with the as prop.", demoSlug: "shimmer-demo-polymorphic" },
		{ title: "Playground", description: "Tune the duration and spread props live.", demoSlug: "shimmer-demo-playground" },
	],
};
