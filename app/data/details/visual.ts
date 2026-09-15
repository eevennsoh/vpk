import type { ComponentDetail } from "@/app/data/component-detail-types";
import {
	SHADER_LAB_RUNTIME_LAYER_TYPES,
	type ShaderLabRuntimeEffectType,
	type ShaderLabRuntimeLayerType,
	createShaderLabEffectPropDocs,
	getShaderLabEffectDescription,
	getShaderLabEffectImportStatement,
	getShaderLabEffectUsage,
} from "@/components/website/demos/visual/shader-lab-effect-definitions";
import { MOTION_DETAIL } from "./visual/motion";
import { TYPOGRAPHY_DETAIL } from "./visual/typography";
import { COLOR_DETAIL } from "./visual/color";
import { SHADOW_DETAIL } from "./visual/shadow";
import { SHADOW_OVERLAY_DETAIL } from "./visual/shadow-overlay";
import { CARD_GLOW_DETAIL } from "./visual/card-glow";
import { MELT_DETAIL } from "./visual/melt";
import { SCRIBBLES_DETAIL } from "./visual/scribbles";
import { SCRAMBLE_TEXT_DETAIL } from "./visual/scramble-text";
import { GRAPH_DETAIL } from "./visual/graph";
import { SQUIRCLE_DETAIL } from "./visual/squircle";
import { SVG_TRACING_DETAIL } from "./visual/svg-tracing";
import { VISUAL_TRACING_DETAIL } from "./visual/visual-tracing";
import { THINKING_ORBS_DETAIL } from "./visual/thinking-orbs";
import { SCROLL_MASK_DETAIL } from "./visual/scroll-mask";
import { SCROLLING_DETAIL } from "./visual/scrolling";
import { TEXT_EFFECTS_DETAIL } from "./visual/text-effects";
import { TEXT_MORPHING_DETAIL } from "./visual/text-morphing";
import { TEXT_CONTINUITY_DETAIL } from "./visual/text-continuity";
import { ASCII_DETAIL } from "./visual/ascii";
import { DITHERING_DETAIL } from "./visual/dithering";
import { PARTICLES_DETAIL } from "./visual/particles";
import { WAVE_GRADIENT_DETAIL } from "./visual/wave-gradient";
import { LIQUID_GRADIENT_DETAIL } from "./visual/liquid-gradient";
import { LOGO_GRADIENT_DETAIL } from "./visual/logo-gradient";
import { LOGO_SPECTRUM_DETAIL } from "./visual/logo-spectrum";
import { LOGO_CRYSTAL_DETAIL } from "./visual/logo-crystal";
import { BANDS_DETAIL } from "./visual/bands";
import { RINGS_DETAIL } from "./visual/rings";
import { RIPPLE_DETAIL } from "./visual/ripple";
import { BLOCKIFY_DETAIL } from "./visual/blockify";
import { PIXELS_DETAIL } from "./visual/pixels";
import { TRUCHET_DETAIL } from "./visual/truchet";
import { FLUTED_GLASS_DETAIL } from "./visual/fluted-glass";
import { LIQUID_GLASS_DETAIL } from "./visual/liquid-glass";
import { LOGO_GLASS_DETAIL } from "./visual/logo-glass";
import { GLASS_TABS_DETAIL } from "./visual/glass-tabs";
import { GLASS_SLIDER_DETAIL } from "./visual/glass-slider";
import { HOLO_DETAIL } from "./visual/holo";
import { MESH_DETAIL } from "./visual/mesh";
import { MESH_V2_DETAIL } from "./visual/mesh-v2";
import { CHROMATIC_ABERRATION_DETAIL } from "./visual/chromatic-aberration";
import { PATTERN_TILE_DETAIL } from "./visual/pattern-tile";
import { BORDER_BEAM_DETAIL } from "./visual/border-beam";
import { DROPZONE_EFFECT_DETAIL } from "./visual/dropzone-effect";
import { HEATMAP_DETAIL } from "./visual/heatmap";
import { INK_WASH_DETAIL } from "./visual/ink-wash";
import { LIQUID_METAL_DETAIL } from "./visual/liquid-metal";
import { PEEL_DETAIL } from "./visual/peel";
import { NOISE_DETAIL } from "./visual/noise";
import { GOOEY_DETAIL } from "./visual/gooey";

const SHADER_LAB_V2_EFFECT_TYPES = new Set<ShaderLabRuntimeEffectType>([
	"chromatic-aberration",
	"fluted-glass",
]);

function isShaderLabV2EffectType(layerType: ShaderLabRuntimeLayerType): layerType is ShaderLabRuntimeEffectType {
	return SHADER_LAB_V2_EFFECT_TYPES.has(layerType as ShaderLabRuntimeEffectType);
}

function createShaderLabLayerDetail(layerType: ShaderLabRuntimeLayerType): ComponentDetail {
	return {
		description: getShaderLabEffectDescription(layerType),
		importStatement: getShaderLabEffectImportStatement(),
		usage: getShaderLabEffectUsage(layerType),
		props: createShaderLabEffectPropDocs(layerType),
	};
}

const SHADER_LAB_LAYER_DETAILS = Object.fromEntries(
	SHADER_LAB_RUNTIME_LAYER_TYPES
		.filter((layerType) => !isShaderLabV2EffectType(layerType))
		.map((layerType) => [layerType, createShaderLabLayerDetail(layerType)]),
) as Record<string, ComponentDetail>;

const SHADER_LAB_V2_EFFECT_DETAILS = Object.fromEntries(
	Array.from(SHADER_LAB_V2_EFFECT_TYPES).map((effectType) => [
		`${effectType}-v2`,
		createShaderLabLayerDetail(effectType),
	]),
) as Record<string, ComponentDetail>;

interface PaperShaderDetailSource {
	slug: string;
	name: string;
	exportName: string;
	description: string;
	hasImage?: boolean;
}

const PAPER_SHADER_DETAILS_SOURCE: PaperShaderDetailSource[] = [
	{ slug: "paper-color-panels", name: "Color Panels", exportName: "ColorPanels", description: "Paper Design animated panel shader with layered color bands for bold background fields." },
	{ slug: "paper-dithering", name: "Dithering", exportName: "Dithering", description: "Paper Design procedural dithering shader with animated pattern sources and two-color palettes." },
	{ slug: "paper-dot-grid", name: "Dot Grid", exportName: "DotGrid", description: "Paper Design dot grid shader with configurable shapes, color, spacing, and responsive sizing." },
	{ slug: "paper-dot-orbit", name: "Dot Orbit", exportName: "DotOrbit", description: "Paper Design animated dot field where each dot orbits inside its grid cell." },
	{ slug: "paper-fluted-glass", name: "Fluted Glass", exportName: "FlutedGlass", description: "Paper Design image filter that bends source pixels through ribbed fluted-glass distortion.", hasImage: true },
	{ slug: "paper-gem-smoke", name: "Gem Smoke", exportName: "GemSmoke", description: "Paper Design smoky color-field shader for logo masks or bundled abstract shapes.", hasImage: true },
	{ slug: "paper-god-rays", name: "God Rays", exportName: "GodRays", description: "Paper Design radial light-ray shader for animated beams, glow, and atmosphere." },
	{ slug: "paper-grain-gradient", name: "Grain Gradient", exportName: "GrainGradient", description: "Paper Design multi-color gradient shader with animated grain and distorted abstract forms." },
	{ slug: "paper-halftone-cmyk", name: "Halftone CMYK", exportName: "HalftoneCmyk", description: "Paper Design CMYK print halftone image filter with channel dots and grain.", hasImage: true },
	{ slug: "paper-halftone-dots", name: "Halftone Dots", exportName: "HalftoneDots", description: "Paper Design halftone-dot image filter with grid, palette, dot style, and contrast controls.", hasImage: true },
	{ slug: "paper-heatmap", name: "Heatmap", exportName: "Heatmap", description: "Paper Design image-driven glowing heatmap shader that flows color across source intensity.", hasImage: true },
	{ slug: "paper-image-dithering", name: "Image Dithering", exportName: "ImageDithering", description: "Paper Design image dithering filter with palette, luminance, and pixel-size controls.", hasImage: true },
	{ slug: "paper-liquid-metal", name: "Liquid Metal", exportName: "LiquidMetal", description: "Paper Design liquid-metal shader for image masks or abstract shapes with animated stripe distortion.", hasImage: true },
	{ slug: "paper-mesh-gradient", name: "Mesh Gradient", exportName: "MeshGradient", description: "Paper Design animated mesh gradient with multi-point color blending and organic motion." },
	{ slug: "paper-metaballs", name: "Metaballs", exportName: "Metaballs", description: "Paper Design metaballs shader with soft merging blobs and color transitions." },
	{ slug: "paper-neuro-noise", name: "Neuro Noise", exportName: "NeuroNoise", description: "Paper Design neural noise shader for flowing organic texture and atmospheric backgrounds." },
	{ slug: "paper-paper-texture", name: "Paper Texture", exportName: "PaperTexture", description: "Paper Design layered noise texture for paper, cardboard, and abstract surface treatments.", hasImage: true },
	{ slug: "paper-perlin-noise", name: "Perlin Noise", exportName: "PerlinNoise", description: "Paper Design Perlin noise shader for soft procedural fields and animated texture." },
	{ slug: "paper-pulsing-border", name: "Pulsing Border", exportName: "PulsingBorder", description: "Paper Design animated border shader with pulsing edge glow and aspect-ratio controls." },
	{ slug: "paper-simplex-noise", name: "Simplex Noise", exportName: "SimplexNoise", description: "Paper Design simplex noise shader for smooth animated texture and gradient-like fields." },
	{ slug: "paper-smoke-ring", name: "Smoke Ring", exportName: "SmokeRing", description: "Paper Design smoke-ring shader with animated circular turbulence and color haze." },
	{ slug: "paper-spiral", name: "Spiral", exportName: "Spiral", description: "Paper Design spiral shader with radial twist, color, and motion controls." },
	{ slug: "paper-static-mesh-gradient", name: "Static Mesh Gradient", exportName: "StaticMeshGradient", description: "Paper Design static mesh gradient for non-animated color-field backgrounds." },
	{ slug: "paper-static-radial-gradient", name: "Static Radial Gradient", exportName: "StaticRadialGradient", description: "Paper Design static radial gradient shader for layered focal color fields." },
	{ slug: "paper-swirl", name: "Swirl", exportName: "Swirl", description: "Paper Design swirl shader with rotational color distortion and animated flow." },
	{ slug: "paper-voronoi", name: "Voronoi", exportName: "Voronoi", description: "Paper Design Voronoi shader for cellular texture, outlines, and animated seed motion." },
	{ slug: "paper-warp", name: "Warp", exportName: "Warp", description: "Paper Design warp shader with configurable pattern distortion and animated displacement." },
	{ slug: "paper-water", name: "Water", exportName: "Water", description: "Paper Design water shader for caustic texture or source-image distortion.", hasImage: true },
	{ slug: "paper-waves", name: "Waves", exportName: "Waves", description: "Paper Design static wave-line shader for crisp repeating line textures." },
];

function createPaperShaderUsage({ exportName, hasImage }: PaperShaderDetailSource): string {
	return `<${exportName}
	width={640}
	height={420}${hasImage ? `\n\timage="/illustration-ai/chat/light.svg"` : ""}
	fit="cover"
/>`;
}

function createPaperShaderDetail(source: PaperShaderDetailSource): ComponentDetail {
	return {
		description: source.description,
		importStatement: `import { ${source.exportName} } from "@paper-design/shaders-react";`,
		usage: createPaperShaderUsage(source),
		demoLayout: {
			previewContentWidth: "full",
			previewHeight: "fixed",
		},
		props: [
			...(source.hasImage ? [{ name: "image", type: "HTMLImageElement | string", description: "Source image element or URL used by image-backed shaders. String values are loaded as image uniforms by the Paper shader mount." }] : []),
			{ name: "width", type: "string | number", description: "Inline CSS width for the mounted shader surface." },
			{ name: "height", type: "string | number", description: "Inline CSS height for the mounted shader surface." },
			{ name: "fit", type: `"none" | "contain" | "cover"`, default: `"cover"`, description: "How object, pattern, or image UVs fit inside the shader surface." },
			{ name: "scale", type: "number", description: "Zoom applied to the shader coordinates." },
			{ name: "rotation", type: "number", description: "Coordinate rotation in degrees." },
			{ name: "offsetX / offsetY", type: "number", description: "Horizontal and vertical coordinate offsets." },
			{ name: "worldWidth / worldHeight", type: "number", description: "Virtual graphic dimensions used by responsive sizing." },
			{ name: "minPixelRatio", type: "number", description: "Lower bound for the WebGL render pixel ratio." },
			{ name: "maxPixelCount", type: "number", description: "Caps the render target size for dense or full-bleed surfaces." },
			{ name: "className / style", type: "string | React.CSSProperties", description: "Standard root element styling props forwarded to the shader host." },
		],
	};
}

const PAPER_SHADER_DETAILS = Object.fromEntries(
	PAPER_SHADER_DETAILS_SOURCE.map((source) => [source.slug, createPaperShaderDetail(source)]),
) as Record<string, ComponentDetail>;

export const VISUAL_DETAILS: Record<string, ComponentDetail> = {
	motion: MOTION_DETAIL,
	typography: TYPOGRAPHY_DETAIL,
	color: COLOR_DETAIL,
	shadow: SHADOW_DETAIL,
	"shadow-overlay": SHADOW_OVERLAY_DETAIL,
	"dropzone-effect": DROPZONE_EFFECT_DETAIL,
	"card-glow": CARD_GLOW_DETAIL,
	melt: MELT_DETAIL,
	scribbles: SCRIBBLES_DETAIL,
	"scramble-text": SCRAMBLE_TEXT_DETAIL,
	graph: GRAPH_DETAIL,
	squircle: SQUIRCLE_DETAIL,
	"svg-tracing": SVG_TRACING_DETAIL,
	"visual-tracing": VISUAL_TRACING_DETAIL,
	"thinking-orbs": THINKING_ORBS_DETAIL,
	"scroll-mask": SCROLL_MASK_DETAIL,
	scrolling: SCROLLING_DETAIL,
	"text-effects": TEXT_EFFECTS_DETAIL,
	"text-morphing": TEXT_MORPHING_DETAIL,
	"text-continuity": TEXT_CONTINUITY_DETAIL,
	ascii: ASCII_DETAIL,
	dithering: DITHERING_DETAIL,
	particles: PARTICLES_DETAIL,
	"wave-gradient": WAVE_GRADIENT_DETAIL,
	"liquid-gradient": LIQUID_GRADIENT_DETAIL,
	"logo-gradient": LOGO_GRADIENT_DETAIL,
	"logo-spectrum": LOGO_SPECTRUM_DETAIL,
	"logo-crystal": LOGO_CRYSTAL_DETAIL,
	bands: BANDS_DETAIL,
	rings: RINGS_DETAIL,
	ripple: RIPPLE_DETAIL,
	blockify: BLOCKIFY_DETAIL,
	pixels: PIXELS_DETAIL,
	truchet: TRUCHET_DETAIL,
	"fluted-glass": FLUTED_GLASS_DETAIL,
	"liquid-glass": LIQUID_GLASS_DETAIL,
	"logo-glass": LOGO_GLASS_DETAIL,
	"glass-tabs": GLASS_TABS_DETAIL,
	"glass-slider": GLASS_SLIDER_DETAIL,
	holo: HOLO_DETAIL,
	mesh: MESH_DETAIL,
	"mesh-v2": MESH_V2_DETAIL,
	"chromatic-aberration": CHROMATIC_ABERRATION_DETAIL,
	"pattern-tile": PATTERN_TILE_DETAIL,
	"border-beam": BORDER_BEAM_DETAIL,
	heatmap: HEATMAP_DETAIL,
	"ink-wash": INK_WASH_DETAIL,
	"liquid-metal": LIQUID_METAL_DETAIL,
	peel: PEEL_DETAIL,
	noise: NOISE_DETAIL,
	gooey: GOOEY_DETAIL,
	...PAPER_SHADER_DETAILS,
	...SHADER_LAB_LAYER_DETAILS,
	...SHADER_LAB_V2_EFFECT_DETAILS,
};
