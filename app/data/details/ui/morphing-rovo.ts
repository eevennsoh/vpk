import type { ComponentDetail } from "@/app/data/component-detail-types";

export const MORPHING_ROVO_DETAIL: ComponentDetail = {
	description:
		"A morphing shape indicator that smoothly transitions between circle, square, triangle, and hexagon. Uses Motion's native path interpolation with compatible cubic bezier paths — no external shape-morphing library needed.",
	demoLayout: { previewContentWidth: "full" },
	usage: `import { MorphingRovo } from "@/components/ui/morphing-rovo";

<MorphingRovo.Shape size={32} />
<MorphingRovo.Shape size={64} duration={0.8} rotationPerStep={180} />`,
	props: [
		{
			name: "size",
			type: "number",
			default: "32",
			description: "Width and height of the shape in pixels.",
		},
		{
			name: "duration",
			type: "number",
			default: "0.6",
			description: "Duration of each morph step in seconds.",
		},
		{
			name: "ease",
			type: "string",
			default: "backOut",
			description: "Easing function for each morph transition (e.g. backOut, easeInOut, circOut, linear).",
		},
		{
			name: "rotationPerStep",
			type: "number",
			default: "180",
			description: "Clockwise rotation in degrees applied during each morph step.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional CSS classes applied to the wrapper.",
		},
	],
	examples: [
		{ title: "Interactive", description: "Control size, duration, easing, rotation, and blur with GUI sliders.", demoSlug: "morphing-rovo" },
	],
};
