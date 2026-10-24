import type { ComponentDetail } from "@/app/data/component-detail-types";

export const UI_GENERATION_DETAIL: ComponentDetail = {
	description:
		"Plays an \"agent is generating this\" build over any UI, then hands over to the real thing. Nothing is faked: the drawing is measured from the children's own layout. A dot field ripples out with matrix rain and a probe line, construction guides and corner handles appear, the outline is traced in flowing dots while loose dots land on it, then every box, text line and inline icon is traced in document order with a targeting reticle and size labels on key elements. The real UI comes in top to bottom behind a scan line, fading and sharpening, while the drawing is wiped away. Recreated from Jakub Antalik's transitions.dev UI generation skill. The drawing is monochrome on ADS neutrals so it follows light and dark themes, is aria-hidden and takes no pointer input; the content is inert until its reveal. Under Reduce Motion the drawing is skipped and the UI shows at once.",
	demoLayout: { previewContentWidth: "full", previewHeight: "fit" },
	importStatement: `import { UIGeneration } from "@/components/visual/ui-generation";`,
	usage: `<UIGeneration playKey={result.id} onComplete={() => setReady(true)}>
	<ResultCard data={result} />
</UIGeneration>`,
	adsLinks: [{ label: "transitions.dev", url: "https://transitions.dev" }],
	props: [
		{
			name: "children",
			type: "ReactNode",
			required: true,
			description:
				"The real UI. Render it at its final size: boxes, text lines and icons are measured from it when the build starts. Mark a child with data-ui-generation-skip to leave it out of the drawing.",
		},
		{
			name: "playKey",
			type: "React.Key",
			description: "Change it to play the build again, for example when new data arrives. The build always plays on mount.",
		},
		{
			name: "duration",
			type: "number",
			default: "3200",
			description: "ms of drawing; every phase scales with it and the whole build is about duration × 1.09. Keep it between 1600 and 3600.",
		},
		{
			name: "delay",
			type: "number",
			default: "0",
			description: "ms before the build starts. Stagger a grid of results by about 260ms per item.",
		},
		{
			name: "maxParts",
			type: "number",
			default: "60",
			description: "Most parts traced; the largest are kept. Lower it for busy components so the parts phase reads as a sequence.",
		},
		{
			name: "keys",
			type: "number",
			default: "5",
			description: "Key elements (interactive boxes first, then the largest) that get their own guides, corner handles and size label.",
		},
		{
			name: "onComplete",
			type: "() => void",
			description: "Called once the real UI is fully in, or immediately under Reduce Motion.",
		},
		{
			name: "className",
			type: "string",
			description: "Class names merged onto the wrapper, which is relative and shrink-wraps its children.",
		},
	],
};
