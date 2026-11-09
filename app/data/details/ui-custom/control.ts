import type { ComponentDetail } from "@/app/data/component-detail-types";

export const CONTROL_DETAIL: ComponentDetail = {
	description:
		"Themed zoom and fit-view controls for React Flow canvases. Wraps @xyflow/react Controls with ADS-aligned card styling, rounded buttons, and hover states.",
	usage: `import { Canvas } from "@/components/ui-custom/canvas";
import { Control } from "@/components/ui-custom/control";

<Canvas nodes={nodes} edges={edges}>
  <Control />
</Canvas>`,
	demoLayout: {
		previewContentWidth: "full",
		examplesContentWidth: "full",
	},
	props: [
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the controls container.",
		},
		{
			name: "showZoom",
			type: "boolean",
			default: "true",
			description: "Show zoom in/out buttons.",
		},
		{
			name: "showFitView",
			type: "boolean",
			default: "true",
			description: "Show fit-view button to center and scale content.",
		},
		{
			name: "showInteractive",
			type: "boolean",
			default: "true",
			description: "Show interactive toggle (lock/unlock) button.",
		},
		{
			name: "position",
			type: '"top-left" | "top-right" | "bottom-left" | "bottom-right"',
			default: '"bottom-left"',
			description: "Position of the controls overlay within the canvas.",
		},
	],
	subComponents: [
		{ name: "Control", description: "Themed React Flow controls with card background, rounded buttons, and secondary hover states." },
	],
	examples: [
		{ title: "Default", description: "Controls with zoom, fit-view, and interactive toggle in bottom-left position.", demoSlug: "control-demo-default" },
		{ title: "Position", description: "Controls placed in the bottom-right corner of the canvas.", demoSlug: "control-demo-position" },
		{ title: "Zoom only", description: "Only zoom in/out buttons, fit-view and interactive toggle hidden.", demoSlug: "control-demo-zoom-only" },
		{ title: "Fit only", description: "Only fit-view button, zoom and interactive toggle hidden.", demoSlug: "control-demo-fit-only" },
	],
};
