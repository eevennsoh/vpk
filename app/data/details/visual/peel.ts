import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PEEL_DETAIL: ComponentDetail = {
		description: "A printed stamp you can lift off the page, copied from the photo stamps at jaksenc.com/about. Click it and it peels — the corner you clicked comes up first, the sheet keeps flexing for as long as it is up, and the contact shadow detaches and spreads. Click again and it sets back down with a landing ripple. While it is up you can also drag it, and it stays where you leave it. One WebGL plane carries the die-cut, the print, the flex and the foil, so the sheen bends over the fold instead of floating above it. The term that makes the flex legible is in-plane gather: paper does not stretch, so a bowing sheet contracts its footprint and the outline itself ripples — displacing only in z on a plane viewed face-on is very nearly invisible. Geometry, lift and shadow are all measured off the reference rather than chosen by eye; the constants carry their numbers.",
		importStatement: `import { Peel, PEEL_STAMP_RATIO, type PeelTuning } from "@/components/visual/peel";`,
		usage: `<Peel
	src="/illustration/jaksenc-bagel-stamp.webp"
	alt="Engraved postage stamp. Click to lift it off the page."
	width={98}
	finish="foil"
/>`,
		demoLayout: {
			previewContentWidth: "full",
		},
		props: [
			{ name: "src", type: "string", description: "Artwork printed on the sheet. It sits inside the cream paper margin — a uniform 3.03 CSS px band of bare stock all the way round, measured off the reference — so the print box comes out at the source image's own 0.75 aspect. A missing or failed image renders as blank stock rather than breaking." },
			{ name: "alt", type: "string", required: true, description: "Describes the sheet. Becomes its accessible name — the canvas itself is hidden from assistive technology." },
			{ name: "width", type: "number", default: "98", description: "Sheet width in CSS pixels. The default is the reference stamp's own paper width." },
			{ name: "height", type: "number", description: "Sheet height in CSS pixels. Defaults to `width / PEEL_STAMP_RATIO` — 0.7617, measured off the reference's 98.12 x 128.61 paper, and itself a consequence of a 0.75-aspect print inside a uniform margin." },
			{ name: "finish", type: `"foil" | "oil-slick" | "pearl" | "uv-gloss"`, default: `"foil"`, description: "Coating. Each preset retunes film thickness, gloss coverage, sheen gain and grain — `uv-gloss` is a near-clear varnish with a sharp highlight, `oil-slick` is a thick uneven film with broad hue sweeps." },
			{ name: "draggable", type: "boolean", default: "true", description: "Whether the sheet responds to input at all. When false it renders the rest and hover states only and is not focusable." },
			{ name: "rotation", type: "number", default: "0", description: "Resting angle in degrees. Pointer coordinates are un-rotated before becoming sheet UV, so the sheen stays exact at any angle." },
			{ name: "surfaceColor", type: "string", default: `"#F0E0BA"`, description: "Paper stock colour: the margin around the print, and the whole surface when no `src` is given. The default is the reference's measured stock, modal (240, 224, 186) over the margin band. Resolved rather than read through `token()` because WebGL needs a literal at material-build time." },
			{ name: "tuning", type: "Partial<PeelTuning>", description: "Overrides merged over the finish preset. Covers the optics (`filmScale`, `glossCoverage`, `sheenGain`, `grain`, `restSheen`) and the motion (`liftHeight`, `peelPivot`, `waveAmplitude`, `waveLength`, `waveSpeed`, `waveShear`, `flutter`, `tilt`, `shadowStrength`). `peelPivot` is the rock — grabbed corner up, far corner down — and `waveShear` is the in-plane gather; set either to 0 and the peel stops reading." },
			{ name: "onPeel", type: "() => void", description: "Fires as the sheet comes off the page, from a click, a drag or the keyboard." },
			{ name: "onLand", type: "() => void", description: "Fires as it is set back down." },
			{ name: "className", type: "string", description: "Class names applied to the layout slot. The slot keeps its size while the sheet is moved, so surrounding content never reflows." },
			{ name: "style", type: "React.CSSProperties", description: "Inline styles merged onto the layout slot. The component owns its width and height." },
			{ name: "ref", type: "React.Ref<HTMLDivElement>", description: "Ref for the layout slot, using the repo's React 19 ref-as-prop convention. It is merged with the component's own ref rather than replacing it." },
		],
	};
