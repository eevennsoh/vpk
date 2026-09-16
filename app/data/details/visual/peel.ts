import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PEEL_DETAIL: ComponentDetail = {
		description: "A reversible paper peel adapted from jaksenc.com/about. The Illustration object shows an ambient communication illustration that curls off the page on click and lays back down on the next click. Switch Object to Agent session for one standalone Claude card beside a Jira work item. Dragging keeps the existing compact card and adds a paper wave with an avatar-colored flash glow; approaching the work item traces its border, and dropping links Claude with a flash across the new activity row. Reset repeats the gesture. Reduced motion keeps the native card and drop behavior without the wave or flash.",
		importStatement: `import { Peel } from "@/components/visual/peel";`,
		usage: `<Peel
	src="/ambient/atlassian/pictorial/communication/primary/blue.svg"
	alt="Blue illustration of overlapping speech bubbles. Click to lift it off the page."
	width={240}
	height={135}
	finish="foil"
/>`,
		demoLayout: {
			previewContentWidth: "full",
		},
		subComponents: [{
			name: "PeelSurface",
			description: "Decorative drag preview that bends an existing component's rendered pixels. One prepared print and renderer are retained while idle and released on unmount or reduced motion. The original source owns interaction and accessibility.",
			props: [
				{ name: "children", type: "ReactNode", required: true, description: "Existing drag card or other visual to bend, including its original colors, type and rounded silhouette." },
				{ name: "captureChildren", type: "ReactNode", description: "Optional stable version of the preview to capture while its visible copy morphs." },
				{ name: "active", type: "boolean", required: true, description: "Starts the peel as soon as the preview's card and avatar entrance finish. False or reduced motion shows the native DOM preview." },
				{ name: "contentKey", type: "string", required: true, description: "Stable object identity; changing it starts a fresh capture and fold." },
				{ name: "flashColor", type: "string", description: "Optional avatar accent as a hex, rgb color or CSS variable. A narrow, translucent flash crosses the card's face over 0.55 seconds while the paper ripple continues." },
				{ name: "pointerX", type: "MotionValue<number>", required: true, description: "Viewport-space drag follower x, sampled once per frame to drive the paper flex." },
				{ name: "pointerY", type: "MotionValue<number>", required: true, description: "Viewport-space drag follower y." },
				{ name: "tuning", type: "Partial<PeelTuning>", description: "Optional curl, ripple and billow overrides. Defaults to a gentle wave suitable for a compact card." },
			],
		}],
		props: [
			{ name: "src", type: "string", description: "Artwork printed on the sheet. It sits inside the cream paper margin — a uniform 3.03 CSS px band of bare stock all the way round, measured off the reference — so the print box comes out at the source image's own 0.75 aspect. A missing or failed image renders as blank stock rather than breaking." },
			{ name: "alt", type: "string", required: true, description: "Describes the sheet. Becomes its accessible name — the canvas itself is hidden from assistive technology." },
			{ name: "width", type: "number", default: "98", description: "Sheet width in CSS pixels. The default is the reference stamp's own paper width." },
			{ name: "height", type: "number", description: "Sheet height in CSS pixels. Defaults to `width / PEEL_STAMP_RATIO` — 0.7617, measured off the reference's 98.12 x 128.61 paper, and itself a consequence of a 0.75-aspect print inside a uniform margin." },
			{ name: "finish", type: `"foil" | "oil-slick" | "pearl" | "uv-gloss"`, default: `"foil"`, description: "Coating. Each preset retunes film thickness, gloss coverage, sheen gain and grain — `uv-gloss` is a near-clear varnish with a sharp highlight, `oil-slick` is a thick uneven film with broad hue sweeps." },
			{ name: "draggable", type: "boolean", default: "true", description: "Whether the sheet responds to input at all. When false it renders the rest and hover states only and is not focusable." },
			{ name: "rotation", type: "number", default: "0", description: "Resting angle in degrees. Pointer coordinates are un-rotated before becoming sheet UV, so the sheen stays exact at any angle." },
			{ name: "surfaceColor", type: "string", default: `"#F0E0BA"`, description: "Paper stock colour: the margin around the print, and the whole surface when no `src` is given. The default is the reference's measured stock, modal (240, 224, 186) over the margin band. Resolved rather than read through `token()` because WebGL needs a literal at material-build time." },
			{ name: "tuning", type: "Partial<PeelTuning>", description: "Overrides merged over the finish preset. Covers the optics (`filmScale`, `glossCoverage`, `sheenGain`, `grain`, `restSheen`) and the motion (`liftHeight`, `peelPivot`, `waveAmplitude`, `waveLength`, `waveSpeed`, `waveShear`, `flutter`, `tilt`, `shadowStrength`). `peelPivot` sets the curl angle in radians. Ripple and billow controls add optional accents; billow defaults to 0 so lifted paper settles flat." },
			{ name: "onPeel", type: "() => void", description: "Fires as the sheet comes off the page, from a click, a drag or the keyboard." },
			{ name: "onLand", type: "() => void", description: "Fires as it is set back down." },
			{ name: "className", type: "string", description: "Class names applied to the layout slot. The slot keeps its size while the sheet is moved, so surrounding content never reflows." },
			{ name: "style", type: "React.CSSProperties", description: "Inline styles merged onto the layout slot. The component owns its width and height." },
			{ name: "ref", type: "React.Ref<HTMLDivElement>", description: "Ref for the layout slot, using the repo's React 19 ref-as-prop convention. It is merged with the component's own ref rather than replacing it." },
		],
	};
