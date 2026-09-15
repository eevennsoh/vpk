import dynamic from "next/dynamic";
import type { ComponentType } from "react";

export const VISUAL_DEMOS: Record<string, ComponentType> = {
	gooey: dynamic(() => import("../demos/visual/gooey-demo"), { ssr: false }),
	typography: dynamic(() => import("../demos/visual/typography-demo"), {
		ssr: false,
	}),
	color: dynamic(() => import("../demos/visual/color-demo"), { ssr: false }),
	shadow: dynamic(() => import("../demos/visual/shadow-demo"), { ssr: false }),
	"shadow-overlay": dynamic(() => import("../demos/visual/shadow-overlay-demo"), {
		ssr: false,
	}),
	"card-glow": dynamic(() => import("../demos/visual/card-glow-demo"), {
		ssr: false,
	}),
	"border-beam": dynamic(() => import("../demos/visual/border-beam-demo"), {
		ssr: false,
	}),
	"dropzone-effect": dynamic(() => import("../demos/visual/dropzone-effect-demo"), {
		ssr: false,
	}),
	heatmap: dynamic(() => import("../demos/visual/heatmap-demo"), {
		ssr: false,
	}),
	squircle: dynamic(() => import("../demos/visual/squircle-demo"), {
		ssr: false,
	}),
	"svg-tracing": dynamic(() => import("../demos/visual/svg-tracing-demo"), {
		ssr: false,
	}),
	"visual-tracing": dynamic(() => import("../demos/visual/visual-tracing-demo"), {
		ssr: false,
	}),
	"thinking-orbs": dynamic(() => import("../demos/visual/thinking-orbs-demo"), {
		ssr: false,
	}),
	"scroll-mask": dynamic(() => import("../demos/visual/scroll-mask-demo"), {
		ssr: false,
	}),
	scrolling: dynamic(() => import("../demos/visual/scrolling-demo"), {
		ssr: false,
	}),
	motion: dynamic(() => import("../demos/visual/motion-demo"), {
		ssr: false,
	}),
	"text-effects": dynamic(() => import("../demos/visual/text-effects-demo"), {
		ssr: false,
	}),
	"text-morphing": dynamic(() => import("../demos/visual/text-morphing-demo"), {
		ssr: false,
	}),
	"text-continuity": dynamic(() => import("../demos/visual/text-continuity-demo"), {
		ssr: false,
	}),
	ascii: dynamic(() => import("../demos/visual/ascii-demo"), {
		ssr: false,
	}),
	bloom: dynamic(() => import("../demos/visual/bloom-demo"), {
		ssr: false,
	}),
	"blob-tracking": dynamic(() => import("../demos/visual/blob-tracking-demo"), {
		ssr: false,
	}),
	"circuit-bent": dynamic(() => import("../demos/visual/circuit-bent-demo"), {
		ssr: false,
	}),
	"custom-shader": dynamic(() => import("../demos/visual/custom-shader-demo"), {
		ssr: false,
	}),
	"directional-blur": dynamic(
		() => import("../demos/visual/directional-blur-demo"),
		{ ssr: false },
	),
	"chromatic-aberration": dynamic(
		() => import("../demos/visual/chromatic-aberration-demo"),
		{ ssr: false },
	),
	"chromatic-aberration-v2": dynamic(
		() => import("../demos/visual/chromatic-aberration-v2-demo"),
		{ ssr: false },
	),
	crt: dynamic(() => import("../demos/visual/crt-demo"), {
		ssr: false,
	}),
	"displacement-map": dynamic(
		() => import("../demos/visual/displacement-map-demo"),
		{ ssr: false },
	),
	dithering: dynamic(() => import("../demos/visual/dithering-demo"), {
		ssr: false,
	}),
	"edge-detect": dynamic(() => import("../demos/visual/edge-detect-demo"), {
		ssr: false,
	}),
	"fluted-glass": dynamic(
		() => import("../demos/visual/fluted-glass-demo"),
		{ ssr: false },
	),
	"fluted-glass-v2": dynamic(
		() => import("../demos/visual/fluted-glass-v2-demo"),
		{ ssr: false },
	),
	fluid: dynamic(() => import("../demos/visual/fluid-demo"), {
		ssr: false,
	}),
	halftone: dynamic(() => import("../demos/visual/halftone-demo"), {
		ssr: false,
	}),
	ink: dynamic(() => import("../demos/visual/ink-demo"), {
		ssr: false,
	}),
	"ink-wash": dynamic(() => import("../demos/visual/ink-wash-demo"), {
		ssr: false,
	}),
	"liquid-metal": dynamic(() => import("../demos/visual/liquid-metal-demo"), {
		ssr: false,
	}),
	peel: dynamic(() => import("../demos/visual/peel-demo"), {
		ssr: false,
	}),
	"magnify-lens": dynamic(() => import("../demos/visual/magnify-lens-demo"), {
		ssr: false,
	}),
	melt: dynamic(() => import("../demos/visual/melt-demo"), {
		ssr: false,
	}),
	"scribbles": dynamic(() => import("../demos/visual/scribbles-demo"), {
		ssr: false,
	}),
	"mesh-gradient": dynamic(() => import("../demos/visual/mesh-gradient-demo"), {
		ssr: false,
	}),
	"particle-grid": dynamic(
		() => import("../demos/visual/particle-grid-demo"),
		{ ssr: false },
	),
	"pattern-tile": dynamic(() => import("../demos/visual/pattern-tile-demo"), {
		ssr: false,
	}),
	pattern: dynamic(() => import("../demos/visual/pattern-demo"), {
		ssr: false,
	}),
	pixelation: dynamic(() => import("../demos/visual/pixelation-demo"), {
		ssr: false,
	}),
	"pixel-sorting": dynamic(
		() => import("../demos/visual/pixel-sorting-demo"),
		{ ssr: false },
	),
	"pixel-trail": dynamic(() => import("../demos/visual/pixel-trail-demo"), {
		ssr: false,
	}),
	plotter: dynamic(() => import("../demos/visual/plotter-demo"), {
		ssr: false,
	}),
	posterize: dynamic(() => import("../demos/visual/posterize-demo"), {
		ssr: false,
	}),
	"scramble-text": dynamic(() => import("../demos/visual/scramble-text-demo"), {
		ssr: false,
	}),
	slice: dynamic(() => import("../demos/visual/slice-demo"), {
		ssr: false,
	}),
	smear: dynamic(() => import("../demos/visual/smear-demo"), {
		ssr: false,
	}),
	threshold: dynamic(() => import("../demos/visual/threshold-demo"), {
		ssr: false,
	}),
	voxel: dynamic(() => import("../demos/visual/voxel-demo"), {
		ssr: false,
	}),
	particles: dynamic(() => import("../demos/visual/particles-demo"), {
		ssr: false,
	}),
	noise: dynamic(() => import("../demos/visual/noise-demo"), {
		ssr: false,
	}),
	"wave-gradient": dynamic(() => import("../demos/visual/wave-gradient-demo"), {
		ssr: false,
	}),
	"liquid-gradient": dynamic(
		() => import("../demos/visual/liquid-gradient-demo"),
		{ ssr: false },
	),
	"logo-gradient": dynamic(() => import("../demos/visual/logo-gradient-demo"), {
		ssr: false,
	}),
	"logo-spectrum": dynamic(
		() => import("../demos/visual/logo-spectrum-demo"),
		{ ssr: false },
	),
	"logo-crystal": dynamic(
		() => import("../demos/visual/logo-crystal-demo"),
		{ ssr: false },
	),
	bands: dynamic(() => import("../demos/visual/bands-demo"), { ssr: false }),
	rings: dynamic(() => import("../demos/visual/rings-demo"), { ssr: false }),
	ripple: dynamic(() => import("../demos/visual/ripple-demo"), { ssr: false }),
	blockify: dynamic(() => import("../demos/visual/blockify-demo"), {
		ssr: false,
	}),
	pixels: dynamic(() => import("../demos/visual/pixels-demo"), { ssr: false }),
	truchet: dynamic(() => import("../demos/visual/truchet-demo"), { ssr: false }),
	"glass-tabs": dynamic(() => import("../demos/visual/glass-tabs-demo"), {
		ssr: false,
	}),
	"glass-slider": dynamic(
		() => import("../demos/visual/glass-slider-demo"),
		{ ssr: false },
	),
	graph: dynamic(() => import("../demos/visual/graph-demo"), {
		ssr: false,
	}),
	"liquid-glass": dynamic(() => import("../demos/visual/liquid-glass-demo"), {
		ssr: false,
	}),
	"logo-glass": dynamic(() => import("../demos/visual/logo-glass-demo"), {
		ssr: false,
	}),
	holo: dynamic(() => import("../demos/visual/holo-demo"), { ssr: false }),
	mesh: dynamic(() => import("../demos/visual/mesh-demo"), { ssr: false }),
	"mesh-v2": dynamic(() => import("../demos/visual/mesh-v2-demo"), {
		ssr: false,
	}),
	"paper-color-panels": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-dithering": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-dot-grid": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-dot-orbit": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-fluted-glass": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-gem-smoke": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-god-rays": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-grain-gradient": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-halftone-cmyk": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-halftone-dots": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-heatmap": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-image-dithering": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-liquid-metal": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-mesh-gradient": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-metaballs": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-neuro-noise": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-paper-texture": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-perlin-noise": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-pulsing-border": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-simplex-noise": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-smoke-ring": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-spiral": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-static-mesh-gradient": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-static-radial-gradient": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-swirl": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-voronoi": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-warp": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-water": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
	"paper-waves": dynamic(() => import("../demos/visual/shaders-paper-demo"), {
		ssr: false,
	}),
};

export const VISUAL_VARIANT_DEMOS: Record<string, ComponentType> = {
	"gooey-morph-menu": dynamic(
		() => import("../demos/visual/gooey-demo").then((mod) => ({ default: mod.GooeyMorphMenuExample })),
		{ ssr: false },
	),
	"gooey-morph-email": dynamic(
		() => import("../demos/visual/gooey-demo").then((mod) => ({ default: mod.GooeyMorphEmailExample })),
		{ ssr: false },
	),
	"gooey-morph-avatars": dynamic(
		() => import("../demos/visual/gooey-demo").then((mod) => ({ default: mod.GooeyMorphAvatarExample })),
		{ ssr: false },
	),
	"gooey-melt-cards": dynamic(
		() => import("../demos/visual/gooey-demo").then((mod) => ({ default: mod.GooeyMeltCardsExample })),
		{ ssr: false },
	),
	"gooey-bend-card": dynamic(
		() => import("../demos/visual/gooey-demo").then((mod) => ({ default: mod.GooeyBendCardExample })),
		{ ssr: false },
	),
	"gooey-move-tabs": dynamic(
		() => import("../demos/visual/gooey-demo").then((mod) => ({ default: mod.GooeyMoveTabsExample })),
		{ ssr: false },
	),
	"gooey-move-slider": dynamic(
		() => import("../demos/visual/gooey-demo").then((mod) => ({ default: mod.GooeyMoveSliderExample })),
		{ ssr: false },
	),
	"thinking-orbs-demo-working": dynamic(
		() =>
			import("../demos/visual/thinking-orbs-demo").then((mod) => ({
				default: mod.ThinkingOrbsDemoWorking,
			})),
		{ ssr: false },
	),
	"thinking-orbs-demo-searching": dynamic(
		() =>
			import("../demos/visual/thinking-orbs-demo").then((mod) => ({
				default: mod.ThinkingOrbsDemoSearching,
			})),
		{ ssr: false },
	),
	"thinking-orbs-demo-solving": dynamic(
		() =>
			import("../demos/visual/thinking-orbs-demo").then((mod) => ({
				default: mod.ThinkingOrbsDemoSolving,
			})),
		{ ssr: false },
	),
	"thinking-orbs-demo-listening": dynamic(
		() =>
			import("../demos/visual/thinking-orbs-demo").then((mod) => ({
				default: mod.ThinkingOrbsDemoListening,
			})),
		{ ssr: false },
	),
	"thinking-orbs-demo-connecting": dynamic(
		() =>
			import("../demos/visual/thinking-orbs-demo").then((mod) => ({
				default: mod.ThinkingOrbsDemoConnecting,
			})),
		{ ssr: false },
	),
	"thinking-orbs-demo-weaving": dynamic(
		() =>
			import("../demos/visual/thinking-orbs-demo").then((mod) => ({
				default: mod.ThinkingOrbsDemoWeaving,
			})),
		{ ssr: false },
	),
	"thinking-orbs-demo-composing": dynamic(
		() =>
			import("../demos/visual/thinking-orbs-demo").then((mod) => ({
				default: mod.ThinkingOrbsDemoComposing,
			})),
		{ ssr: false },
	),
	"thinking-orbs-demo-breathing": dynamic(
		() =>
			import("../demos/visual/thinking-orbs-demo").then((mod) => ({
				default: mod.ThinkingOrbsDemoBreathing,
			})),
		{ ssr: false },
	),
	"thinking-orbs-demo-shaping": dynamic(
		() =>
			import("../demos/visual/thinking-orbs-demo").then((mod) => ({
				default: mod.ThinkingOrbsDemoShaping,
			})),
		{ ssr: false },
	),
	"border-beam-demo-rotate-large": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoRotateLarge,
			})),
		{ ssr: false },
	),
	"border-beam-demo-rotate-small": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoRotateSmall,
			})),
		{ ssr: false },
	),
	"border-beam-demo-line-search": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoLineSearch,
			})),
		{ ssr: false },
	),
	"border-beam-demo-pulse-inner-working": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoPulseInnerWorking,
			})),
		{ ssr: false },
	),
	"border-beam-demo-pulse-pill": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoPulsePill,
			})),
		{ ssr: false },
	),
	"border-beam-demo-pulse-outside": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoPulseOutside,
			})),
		{ ssr: false },
	),
	"border-beam-demo-mono-pulse-search": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoMonoPulseSearch,
			})),
		{ ssr: false },
	),
	"border-beam-demo-compact-gallery": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoCompactGallery,
			})),
		{ ssr: false },
	),
	"border-beam-demo-play-pause": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoPlayPause,
			})),
		{ ssr: false },
	),
	"border-beam-demo-strength-ladder": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoStrengthLadder,
			})),
		{ ssr: false },
	),
	"border-beam-demo-reflection": dynamic(
		() =>
			import("../demos/visual/border-beam-demo").then((mod) => ({
				default: mod.BorderBeamDemoReflection,
			})),
		{ ssr: false },
	),
	"ink-wash-demo-landscape": dynamic(
		() =>
			import("../demos/visual/ink-wash-demo").then((mod) => ({
				default: mod.InkWashDemoLandscapeWash,
			})),
		{ ssr: false },
	),
	"heatmap-demo-shapes": dynamic(
		() =>
			import("../demos/visual/heatmap-demo").then((mod) => ({
				default: mod.HeatmapDemoShapes,
			})),
		{ ssr: false },
	),
	"heatmap-demo-color-ramp": dynamic(
		() =>
			import("../demos/visual/heatmap-demo").then((mod) => ({
				default: mod.HeatmapDemoColorRamp,
			})),
		{ ssr: false },
	),
	"heatmap-demo-glow-balance": dynamic(
		() =>
			import("../demos/visual/heatmap-demo").then((mod) => ({
				default: mod.HeatmapDemoGlowBalance,
			})),
		{ ssr: false },
	),
	"heatmap-demo-contour-and-grain": dynamic(
		() =>
			import("../demos/visual/heatmap-demo").then((mod) => ({
				default: mod.HeatmapDemoContourAndGrain,
			})),
		{ ssr: false },
	),
	"heatmap-demo-angle": dynamic(
		() =>
			import("../demos/visual/heatmap-demo").then((mod) => ({
				default: mod.HeatmapDemoAngle,
			})),
		{ ssr: false },
	),
	"ink-wash-demo-flow-comparison": dynamic(
		() =>
			import("../demos/visual/ink-wash-demo").then((mod) => ({
				default: mod.InkWashDemoFlowComparison,
			})),
		{ ssr: false },
	),
	"ink-wash-demo-drying-window": dynamic(
		() =>
			import("../demos/visual/ink-wash-demo").then((mod) => ({
				default: mod.InkWashDemoDryingWindow,
			})),
		{ ssr: false },
	),
	"ink-wash-demo-bleed-chroma": dynamic(
		() =>
			import("../demos/visual/ink-wash-demo").then((mod) => ({
				default: mod.InkWashDemoBleedChroma,
			})),
		{ ssr: false },
	),
	"ink-wash-demo-layered-white": dynamic(
		() =>
			import("../demos/visual/ink-wash-demo").then((mod) => ({
				default: mod.InkWashDemoLayeredWhiteInk,
			})),
		{ ssr: false },
	),
	"ink-wash-demo-gallery": dynamic(
		() =>
			import("../demos/visual/ink-wash-demo").then((mod) => ({
				default: mod.InkWashDemoGallery,
			})),
		{ ssr: false },
	),
	"liquid-metal-demo-chromatic-pill": dynamic(
		() =>
			import("../demos/visual/liquid-metal-demo").then((mod) => ({
				default: mod.LiquidMetalDemoChromaticPill,
			})),
		{ ssr: false },
	),
	"liquid-metal-demo-silver-pill": dynamic(
		() =>
			import("../demos/visual/liquid-metal-demo").then((mod) => ({
				default: mod.LiquidMetalDemoSilverPill,
			})),
		{ ssr: false },
	),
	"liquid-metal-demo-gold-send": dynamic(
		() =>
			import("../demos/visual/liquid-metal-demo").then((mod) => ({
				default: mod.LiquidMetalDemoGoldSend,
			})),
		{ ssr: false },
	),
	"liquid-metal-demo-chat-reflection": dynamic(
		() =>
			import("../demos/visual/liquid-metal-demo").then((mod) => ({
				default: mod.LiquidMetalDemoChatReflection,
			})),
		{ ssr: false },
	),
};
