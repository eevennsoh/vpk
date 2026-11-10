import type { ComponentDetail } from "@/app/data/component-detail-types";

export const GLIMM_DETAIL: ComponentDetail = {
	description: "A scoped Glimm transition reveals a change behind an iridescent band and bends the content as it passes where HTML-in-Canvas is available. Other browsers receive the same reveal with a plain sweep.",
	importStatement: `import Glimm, { type GlimmHandle } from "@/components/visual/glimm";`,
	usage: `const ref = useRef<GlimmHandle>(null);

<Glimm ref={ref} palette="prism" direction="ttb" curve={0.12} style={{ height: 300 }}>
  <Button onClick={() => ref.current?.play({ change: () => setView("next") })}>
    Continue
  </Button>
</Glimm>`,
	demoLayout: { previewContentWidth: "full", previewHeight: "fit", examplesContentWidth: "full" },
	examples: [
		{ title: "Palettes", description: "All seven built-in color palettes.", demoSlug: "glimm-palettes" },
		{ title: "Directions", description: "Sweep left, right, down, or up.", demoSlug: "glimm-directions" },
		{ title: "Renderers", description: "Compare the decorative sweep, mesh, and traveling namedrop shaders.", demoSlug: "glimm-renderers" },
		{ title: "Scoped change", description: "Coordinate a content update with Glimm, with a plain sweep fallback.", demoSlug: "glimm-scope" },
		{ title: "Custom palette", description: "Create a palette from a pair of accent colors and add a wave.", demoSlug: "glimm-custom" },
	],
	props: [
		{ name: "children / style", type: "ReactNode / CSSProperties", description: "The content to reveal and move. Give the scope a definite height; scrolling content must scroll inside it." },
		{ name: "palette", type: "PaletteName | Palette", default: '"spectrum"', description: "Choose spectrum, prism, berry, lagoon, citrus, azure, ember, or a custom palette from accentPair or accentChain." },
		{ name: "direction", type: '"ltr" | "rtl" | "ttb" | "btt"', default: '"ttb"', description: "Direction of travel." },
		{ name: "sweepMs / gatherMs", type: "number", description: "Traversal and gather durations in milliseconds." },
		{ name: "curve / span / fade", type: "number / number / [number, number]", description: "Band curvature, coverage across the scope, and the progress range over which the band fades." },
		{ name: "intensity", type: "number", description: "Strength of content movement in browsers that support HTML-in-Canvas." },
		{ name: "origin / originOffset", type: "[number, number]", description: "Gather point as fractions of the scope, plus a CSS pixel offset. Override per action using play({ at })." },
		{ name: "bandTight / peakAlpha / brightness / swellAmount", type: "number", description: "Band sharpness, maximum opacity, brightness, and iridescent depth." },
		{ name: "pageEffect", type: "boolean", default: "true", description: "Allows content movement where supported; false keeps the decorative sweep." },
		{ name: "ref", type: "React.Ref<GlimmHandle>", description: "play({ work, change, at, anticipate, fromOld, onBurst, onFail, onLeave }) coordinates work and changes with the effect. It returns cancel and fastForward." },
		{ name: "GlimmSweep", type: "React component", description: "Optional decorative-only renderer, with sweep, mesh and namedrop shaders. Its options accept palette, direction, easing, sweepMs, outroMs, midpoint, bandTight, peakAlpha, brightness, waveAmount, rippleAmount, waveSpeed, swellAmount and callbacks; feather controls edge fading for sweep and mesh." },
	],
};
