const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readWebsiteRegistrySource } = require(process.cwd() + "/components/website/registry/test-source.cjs");
const { readDetailCategorySource } = require(process.cwd() + "/app/data/details/test-source.cjs");

const SHADER_SOURCE = fs.readFileSync(path.join(__dirname, "shaders/ascii.tsx"), "utf8");
const CORE_SOURCE = fs.readFileSync(path.join(__dirname, "shaders/ascii-core.ts"), "utf8");
const DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "ascii-demo.tsx"), "utf8");
const CONTROL_MODEL_SOURCE = fs.readFileSync(path.join(__dirname, "ascii-control-model.ts"), "utf8");
const COMPONENTS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../../app/data/components.ts"),
	"utf8",
);
const MANIFEST_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../../app/data/component-manifest.ts"),
	"utf8",
);
const DETAILS_SOURCE = readDetailCategorySource("visual");
const NAV_UTILS_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../../../app/data/nav-utils.ts"),
	"utf8",
);
const REGISTRY_SOURCE = readWebsiteRegistrySource();

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("ASCII is registered as a visual shader component", () => {
	assert.match(
		COMPONENTS_SOURCE,
		/visualComponent\("ascii", "ASCII", "@\/components\/website\/demos\/visual\/shaders\/ascii"\)/,
	);
	assert.match(
		MANIFEST_SOURCE,
		/visualComponent\("ascii", "ASCII", "@\/components\/website\/demos\/visual\/shaders\/ascii"\)/,
	);
	assert.match(REGISTRY_SOURCE, /ascii: dynamic\(\(\) => import\("\.\/demos\/visual\/ascii-demo"\)/);
	assert.match(DETAILS_SOURCE, /(?:"ascii"|ascii): \{/);
	assert.match(NAV_UTILS_SOURCE, /shaders: \[[^\]]*"ascii"/);
});

test("ASCII demo exposes the shader-lab style ASCII controls", () => {
	assert.match(DEMO_SOURCE, /import Ascii/);
	assert.match(CONTROL_MODEL_SOURCE, /ASCII_ANIMATION_STYLES/);
	assert.match(CONTROL_MODEL_SOURCE, /ASCII_BACKGROUND_MODES/);
	assert.match(CONTROL_MODEL_SOURCE, /ASCII_CONTROL_BLEND_MODES/);
	assert.match(CONTROL_MODEL_SOURCE, /ASCII_COLOR_SOURCE_MODES/);
	assert.match(DEMO_SOURCE, /ASCII_DEFAULT_SOURCE_COLORS/);
	assert.match(DEMO_SOURCE, /ASCII_MAX_SOURCE_COLORS/);
	assert.match(CONTROL_MODEL_SOURCE, /ASCII_TONE_MAPPING_MODES/);
	assert.match(CONTROL_MODEL_SOURCE, /ASCII_MASK_SOURCES/);
	assert.match(CONTROL_MODEL_SOURCE, /ASCII_MASK_MODES/);
	assert.match(DEMO_SOURCE, /label="Blend"/);
	assert.match(DEMO_SOURCE, /label="Mode"/);
	assert.match(DEMO_SOURCE, /label="Mask Mode"/);
	assert.match(DEMO_SOURCE, /label="Mask Invert"/);
	assert.match(DEMO_SOURCE, /label="Density"/);
	assert.match(DEMO_SOURCE, /label="Charset"/);
	assert.match(DEMO_SOURCE, /DEFAULT_CHARSET_VALUES/);
	assert.match(DEMO_SOURCE, /charsetCharacters/);
	assert.match(DEMO_SOURCE, /activeCharsetCharacters/);
	assert.match(DEMO_SOURCE, /label="Characters"/);
	assert.match(DEMO_SOURCE, /characters=\{activeCharsetCharacters\}/);
	assert.match(DEMO_SOURCE, /label="Font Weight"/);
	assert.match(DEMO_SOURCE, /label="Brightness"/);
	assert.match(DEMO_SOURCE, /label="Contrast"/);
	assert.match(DEMO_SOURCE, /label="Character Opacity"/);
	assert.match(DEMO_SOURCE, /label="Dot Grid Overlay"/);
	assert.match(DEMO_SOURCE, /label="Randomize Characters"/);
	assert.match(DEMO_SOURCE, /label="Animated ASCII"/);
	assert.match(DEMO_SOURCE, /label="Playback"/);
	assert.match(DEMO_SOURCE, /label="Animation Style"/);
	assert.match(DEMO_SOURCE, /handleSourceModeChange/);
	assert.match(DEMO_SOURCE, /applyImageBackgroundDefaults/);
	assert.match(DEMO_SOURCE, /label="Background Color"/);
	assert.match(DEMO_SOURCE, /label="Background Mode"/);
	assert.match(DEMO_SOURCE, /label="Blur Radius"/);
	assert.match(DEMO_SOURCE, /label="Source Background"/);
	assert.match(DEMO_SOURCE, /label="Edge Emphasis"/);
	assert.match(DEMO_SOURCE, /label="Tone Mapping"/);
	assert.match(DEMO_SOURCE, /label="Glyph Signal"/);
	assert.match(DEMO_SOURCE, /label="Color Signal"/);
	assert.match(DEMO_SOURCE, /label="Source Channel"/);
	assert.match(DEMO_SOURCE, /label="Colors"/);
	assert.match(DEMO_SOURCE, /allowAddRemove/);
	assert.match(DEMO_SOURCE, /colorMode === "source"/);
	assert.match(DEMO_SOURCE, /label="Black Point"/);
	assert.match(DEMO_SOURCE, /label="White Point"/);
	assert.match(DEMO_SOURCE, /label="Coverage"/);
	assert.match(DEMO_SOURCE, /label="Invert"/);
	assert.match(DEMO_SOURCE, /label="Bloom"/);
	assert.match(DEMO_SOURCE, /label="RGB Split"/);
	assert.match(DEMO_SOURCE, /GUI\.PercentControl/);
	assert.match(DEMO_SOURCE, /GUI\.ColorInput/);
});

test("ASCII demo exposes ASCII Magic background, intensity, animation, and post-processing controls", () => {
	for (const label of ["Blurred Image", "Solid Black", "Original Image", "None (Transparent)"]) {
		assert.match(CONTROL_MODEL_SOURCE, new RegExp(`label: "${escapeRegExp(label)}"`));
	}

	for (const label of ["Coverage", "Edge Emphasis", "Density", "Brightness", "Contrast"]) {
		assert.match(DEMO_SOURCE, new RegExp(`label="${escapeRegExp(label)}"`));
	}

	for (const label of [
		"Animated ASCII",
		"Playback",
		"Animation Style",
		"Speed",
		"Intensity",
		"Randomness",
		"Source Speed",
		"Shimmer Amount",
		"Shimmer Speed",
	]) {
		assert.match(DEMO_SOURCE, new RegExp(`label="${escapeRegExp(label)}"`));
	}

	for (const label of [
		"Wave",
		"Cascade Left -> Right",
		"Cascade Right -> Left",
		"Cascade Top -> Bottom",
		"Reveal",
		"Pulse",
	]) {
		assert.match(CONTROL_MODEL_SOURCE, new RegExp(`label: "${escapeRegExp(label)}"`));
	}

	for (const label of [
		"Color Overlay",
		"Vignette",
		"Scan Lines",
		"CRT Curvature",
		"Chromatic",
		"Bloom",
		"Character Bloom",
		"Character Chromatic",
		"Film Grain",
		"Glitch",
		"RGB Split",
		"Blur",
		"Pixelate",
		"Halftone",
		"Film Dust",
	]) {
		assert.match(DEMO_SOURCE, new RegExp(`label="${escapeRegExp(label)}"`));
	}

	for (const id of [
		"ascii-colorOverlayOpacity",
		"ascii-colorOverlayBlendMode",
		"ascii-vignetteIntensity",
		"ascii-scanLinesIntensity",
		"ascii-crtCurvatureIntensity",
		"ascii-chromaticOffset",
		"ascii-bloomIntensity",
		"ascii-characterBloomIntensity",
		"ascii-characterChromaticOffset",
		"ascii-filmGrainIntensity",
		"ascii-glitchIntensity",
		"ascii-rgbSplitOffset",
		"ascii-blurRadius",
		"ascii-pixelateSize",
		"ascii-halftoneSize",
		"ascii-filmDustDensity",
		"ascii-animationStyle",
		"ascii-animationSpeedSeconds",
		"ascii-animationIntensity",
		"ascii-animationRandomness",
		"ascii-sourceSpeed",
		"ascii-shimmerAmount",
		"ascii-shimmerSpeed",
	]) {
		assert.match(DEMO_SOURCE, new RegExp(`id="${escapeRegExp(id)}"`));
	}

	assert.match(DEMO_SOURCE, /GUI\.SegmentedControl/);
	assert.match(DEMO_SOURCE, /VideoPlayIcon/);
	assert.match(DEMO_SOURCE, /VideoStopIcon/);
	assert.match(DEMO_SOURCE, /animationDurationToCycleSpeed/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_ANIMATION_SPEED_SECONDS = 4\.3/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_ANIMATION_INTENSITY = 0\.83/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_ANIMATION_RANDOMNESS = 0\.5/);
	assert.match(DEMO_SOURCE, /const \[animationPlaying, setAnimationPlaying\] = useState\(true\)/);
	assert.match(DEMO_SOURCE, /const \[animationStyle, setAnimationStyle\] = useState<AsciiAnimationStyle>\("wave"\)/);
	assert.match(DEMO_SOURCE, /characterCycleSpeed=\{resolvedCharacterCycleSpeed\}/);
	assert.match(DEMO_SOURCE, /animationStyle=\{animationStyle\}/);
	assert.match(DEMO_SOURCE, /animationIntensity=\{animationIntensity\}/);
	assert.match(DEMO_SOURCE, /animationRandomness=\{animationRandomness\}/);
	assert.doesNotMatch(DEMO_SOURCE, /animatedCharacters \? \([\s\S]*id="ascii-animationStyle"/);
	assert.match(DEMO_SOURCE, /id="ascii-animationStyle"[\s\S]*setAnimationStyle\(next as AsciiAnimationStyle\);[\s\S]*setAnimatedCharacters\(true\);/);
	assert.match(DEMO_SOURCE, /id="ascii-animationSpeedSeconds"[\s\S]*setAnimationSpeedSeconds\(next\);[\s\S]*setAnimatedCharacters\(true\);/);
	assert.match(DEMO_SOURCE, /id="ascii-animationIntensity"[\s\S]*setAnimationIntensity\(next\);[\s\S]*setAnimatedCharacters\(true\);/);
	assert.match(DEMO_SOURCE, /id="ascii-animationRandomness"[\s\S]*setAnimationRandomness\(next\);[\s\S]*setAnimatedCharacters\(true\);/);
	assert.match(DEMO_SOURCE, /COLOR_OVERLAY_BLEND_OPTIONS/);
	assert.match(CONTROL_MODEL_SOURCE, /value: "multiply", label: "Multiply"/);
	assert.match(CONTROL_MODEL_SOURCE, /value: "color-dodge", label: "Color Dodge"/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_COLOR_OVERLAY_OPACITY = 0\.3/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_VIGNETTE_INTENSITY = 0\.5/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_SCAN_LINES_INTENSITY = 0\.4/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_CRT_CURVATURE_INTENSITY = 0\.3/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_CHROMATIC_OFFSET = 3/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_BLOOM_INTENSITY = 0\.4/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_CHARACTER_BLOOM_INTENSITY = 0\.6/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_CHARACTER_CHROMATIC_OFFSET = 3/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_FILM_GRAIN_INTENSITY = 0\.3/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_GLITCH_INTENSITY = 0\.2/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_RGB_SPLIT_OFFSET = 2/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_BLUR_RADIUS = 2/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_PIXELATE_SIZE = 4/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_HALFTONE_SIZE = 4/);
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_FILM_DUST_DENSITY = 0\.2/);
	assert.match(DEMO_SOURCE, /label="RGB Offset"/);
	assert.match(DEMO_SOURCE, /colorOverlay=\{colorOverlay \? colorOverlayOpacity : 0\}/);
	assert.match(DEMO_SOURCE, /vignette=\{vignette \? vignetteIntensity : 0\}/);
	assert.match(DEMO_SOURCE, /scanLines=\{scanLines \? scanLinesIntensity : 0\}/);
	assert.match(DEMO_SOURCE, /crtCurvature=\{crtCurvature \? crtCurvatureIntensity : 0\}/);
	assert.match(DEMO_SOURCE, /characterBloom=\{characterBloom \? characterBloomIntensity : 0\}/);
	assert.match(DEMO_SOURCE, /filmDust=\{filmDust \? filmDustDensity : 0\}/);
	assert.match(DEMO_SOURCE, /const \[animatedCharacters, setAnimatedCharacters\] = useState\(false\)/);
	assert.match(DEMO_SOURCE, /label="Animated ASCII"[\s\S]*checked=\{animatedCharacters\}/);
	assert.doesNotMatch(DEMO_SOURCE, /sourceMode === "field"[\s\S]{0,1200}label="Animated ASCII"/);
	assert.doesNotMatch(DEMO_SOURCE, /<GUI.Section title="Shimmer">/);
	assert.match(CONTROL_MODEL_SOURCE, /IMAGE_BACKGROUND_OPACITY = 0\.61/);
	assert.match(CONTROL_MODEL_SOURCE, /IMAGE_BACKGROUND_BLUR_RADIUS = 60/);
	assert.match(DEMO_SOURCE, /resolveImageBackgroundDefaults/);
	assert.match(DEMO_SOURCE, /setBackgroundMode\("solid-black"\)/);
});

test("ASCII shader implements ASCII Magic style creative controls", () => {
	assert.match(CORE_SOURCE, /ASCII_ANIMATION_STYLES = \["wave", "cascade-left-right", "cascade-right-left", "cascade-top-bottom", "reveal", "pulse"\]/);
	assert.match(CORE_SOURCE, /ASCII_BACKGROUND_MODES = \["blurred-image", "solid-black", "original-image", "transparent"\]/);
	assert.match(SHADER_SOURCE, /densityToCellSize/);
	assert.match(SHADER_SOURCE, /edgeEmphasis/);
	assert.match(SHADER_SOURCE, /1 - clampNumber\(coverage, 0, 1\)/);
	assert.match(SHADER_SOURCE, /uniform float u_brightness/);
	assert.match(SHADER_SOURCE, /uniform float u_contrast/);
	assert.match(SHADER_SOURCE, /uniform float u_characterOpacity/);
	assert.match(SHADER_SOURCE, /uniform float u_randomizeCharacters/);
	assert.match(SHADER_SOURCE, /uniform float u_animatedCharacters/);
	assert.match(SHADER_SOURCE, /uniform float u_animationStyle/);
	assert.match(SHADER_SOURCE, /uniform float u_animationIntensity/);
	assert.match(SHADER_SOURCE, /uniform float u_animationRandomness/);
	assert.match(SHADER_SOURCE, /uniform float u_dotGridOverlay/);
	assert.match(SHADER_SOURCE, /uniform float u_backgroundMode/);
	assert.match(SHADER_SOURCE, /uniform float u_backgroundBlurRadius/);
	assert.match(SHADER_SOURCE, /uniform float u_colorOverlay/);
	assert.match(SHADER_SOURCE, /uniform vec3 u_colorOverlayColor/);
	assert.match(SHADER_SOURCE, /uniform float u_colorOverlayBlendMode/);
	assert.match(SHADER_SOURCE, /uniform float u_vignette/);
	assert.match(SHADER_SOURCE, /uniform float u_scanLines/);
	assert.match(SHADER_SOURCE, /uniform float u_crtCurvature/);
	assert.match(SHADER_SOURCE, /uniform float u_chromatic/);
	assert.match(SHADER_SOURCE, /uniform float u_chromaticOffset/);
	assert.match(SHADER_SOURCE, /uniform float u_characterBloom/);
	assert.match(SHADER_SOURCE, /uniform float u_characterChromatic/);
	assert.match(SHADER_SOURCE, /uniform float u_characterChromaticOffset/);
	assert.match(SHADER_SOURCE, /uniform float u_chromaticAberration/);
	assert.match(SHADER_SOURCE, /uniform float u_rgbSplit/);
	assert.match(SHADER_SOURCE, /uniform float u_rgbSplitOffset/);
	assert.match(SHADER_SOURCE, /uniform float u_glitch/);
	assert.match(SHADER_SOURCE, /uniform float u_blur/);
	assert.match(SHADER_SOURCE, /uniform float u_blurRadius/);
	assert.match(SHADER_SOURCE, /uniform float u_pixelate/);
	assert.match(SHADER_SOURCE, /uniform float u_pixelateSize/);
	assert.match(SHADER_SOURCE, /uniform float u_halftone/);
	assert.match(SHADER_SOURCE, /uniform float u_halftoneSize/);
	assert.match(SHADER_SOURCE, /uniform float u_filmGrain/);
	assert.match(SHADER_SOURCE, /uniform float u_filmDust/);
	assert.match(SHADER_SOURCE, /applyIntensity/);
	assert.match(SHADER_SOURCE, /sampleBlurredSource/);
	assert.match(SHADER_SOURCE, /backgroundFromMode/);
	assert.match(SHADER_SOURCE, /resolveBackgroundModeIndex/);
	assert.match(SHADER_SOURCE, /hash21/);
	assert.match(SHADER_SOURCE, /applyDotGridOverlay/);
	assert.match(SHADER_SOURCE, /applyCrtCurvature/);
	assert.match(SHADER_SOURCE, /applyGlitch/);
	assert.match(SHADER_SOURCE, /applyHalftone/);
	assert.match(SHADER_SOURCE, /animationStylePhase/);
	assert.match(SHADER_SOURCE, /animationPhaseWithRandomness/);
	assert.match(SHADER_SOURCE, /animationWrappedDistance/);
	assert.match(SHADER_SOURCE, /animationMaskMultiplier/);
	assert.match(SHADER_SOURCE, /u_animationStyle < 1\.5/);
	assert.match(SHADER_SOURCE, /u_animationStyle < 3\.5/);
	assert.match(SHADER_SOURCE, /u_animationStyle > 3\.5 && u_animationStyle < 4\.5/);
	assert.match(SHADER_SOURCE, /u_animationStyle > 4\.5/);
	assert.match(SHADER_SOURCE, /float sweepHead = 1\.0 - smoothstep/);
	assert.match(SHADER_SOURCE, /float styledAnimationPhase = animationPhaseWithRandomness/);
	assert.doesNotMatch(SHADER_SOURCE, /animationPhase \* clamp\(u_animationIntensity[\s\S]{0,120}\+ animationRandomPhase/);
	assert.doesNotMatch(SHADER_SOURCE, /float active =/);
	assert.match(SHADER_SOURCE, /renderAsciiBase/);
	assert.match(SHADER_SOURCE, /float characterMask;/);
	assert.match(SHADER_SOURCE, /return AsciiRender\(clamp\(outputColor, 0\.0, 1\.0\), outputAlpha, finalMask\)/);
	assert.match(SHADER_SOURCE, /sampleRenderedBaseRender/);
	assert.match(SHADER_SOURCE, /sampleRenderedBase/);
	assert.match(SHADER_SOURCE, /sampleBlurredRender/);
	assert.match(SHADER_SOURCE, /applyRenderedChannelSplit/);
	assert.match(SHADER_SOURCE, /applyCharacterChannelSplit/);
	assert.match(SHADER_SOURCE, /applyFilmDust/);
	assert.match(SHADER_SOURCE, /applyPostEffects/);
	assert.match(SHADER_SOURCE, /vec3 splitColor = vec3\(redSample\.r, greenSample\.g, blueSample\.b\)/);
	assert.match(SHADER_SOURCE, /float splitMask = max\(max\(redRender\.characterMask, greenRender\.characterMask\), blueRender\.characterMask\)/);
	assert.match(SHADER_SOURCE, /color = applyCharacterChannelSplit\(color, uv, characterOffset, characterChromaticAmount\)/);
	assert.doesNotMatch(SHADER_SOURCE, /color = applyRenderedChannelSplit\(color, uv, characterOffset, characterChromaticAmount\)/);
	assert.match(SHADER_SOURCE, /color = applyRenderedChannelSplit\(color, uv, splitOffset, splitAmount\)/);
	assert.match(SHADER_SOURCE, /clamp\(u_chromaticOffset, 1\.0, 20\.0\)/);
	assert.match(SHADER_SOURCE, /clamp\(u_rgbSplitOffset, 1\.0, 20\.0\)/);
	assert.match(SHADER_SOURCE, /clamp\(u_blurRadius, 1\.0, 20\.0\)/);
	assert.match(SHADER_SOURCE, /clamp\(u_pixelateSize, 2\.0, 30\.0\)/);
	assert.match(SHADER_SOURCE, /clamp\(u_halftoneSize, 2\.0, 20\.0\)/);
	assert.match(SHADER_SOURCE, /color = mix\(color, blurredRender, blurAmount\)/);
	assert.match(SHADER_SOURCE, /float dustFrame = floor\(u_time \* 0\.45\)/);
	assert.match(SHADER_SOURCE, /float dustScratchFrame = floor\(u_time \* 0\.22\)/);
	assert.match(SHADER_SOURCE, /float dustFleckGate = step/);
	assert.match(SHADER_SOURCE, /float dustScratch = 0\.0/);
	assert.match(SHADER_SOURCE, /color = applyFilmDust\(color, uv, pixelCoord\)/);
	assert.doesNotMatch(SHADER_SOURCE, /floor\(u_time \* 8\.0\)/);
	assert.doesNotMatch(SHADER_SOURCE, /pixelCoord \* 0\.38/);
	assert.doesNotMatch(SHADER_SOURCE, /vec3 blurredSource = applyIntensity\(toneMap\(sampleBlurredSource\(sampleUV/);
	assert.doesNotMatch(SHADER_SOURCE, /color\.r = mix\(color\.r, redSource\.r/);
	assert.doesNotMatch(SHADER_SOURCE, /vec3\(warmSource\.r, color\.g, coolSource\.b\)/);
	assert.match(SHADER_SOURCE, /max\(u_rgbSplit, u_chromaticAberration\)/);
	assert.match(SHADER_SOURCE, /u_transparentBackground/);
});

test("ASCII demo defaults to the requested source color palette", () => {
	const requestedPalette = /\["#1868DB", "#FCA700", "#AF59E1", "#6A9A23"\]/;

	assert.match(CORE_SOURCE, new RegExp(`ASCII_DEFAULT_SOURCE_COLORS = ${requestedPalette.source}`));
	assert.match(DETAILS_SOURCE, requestedPalette);
	assert.doesNotMatch(CORE_SOURCE, /"#05070F"/);
	assert.doesNotMatch(CORE_SOURCE, /"#66D9E8"/);
});

test("ASCII image mode does not keep the generated VPK backdrop as a fallback", () => {
	assert.match(SHADER_SOURCE, /createEmptyTexture/);
	assert.match(SHADER_SOURCE, /const applyImage = \(src: string \| undefined, mode: typeof initialProps\.sourceMode\) =>/);
	assert.match(SHADER_SOURCE, /mode === "image" && src/);
	assert.match(SHADER_SOURCE, /shouldUseAnonymousCrossOrigin\(src\)/);
	assert.doesNotMatch(SHADER_SOURCE, /createDefaultTexture/);
	assert.doesNotMatch(SHADER_SOURCE, /fillText\("VPK"/);
	assert.match(DETAILS_SOURCE, /image mode starts from an empty source rather than a bundled demo texture/);
});

test("ASCII uploaded image preview uses the source aspect ratio", () => {
	assert.match(CONTROL_MODEL_SOURCE, /DEFAULT_PREVIEW_ASPECT_RATIO = "16 \/ 9"/);
	assert.match(DEMO_SOURCE, /interface UploadedImage/);
	assert.match(DEMO_SOURCE, /image\.naturalWidth/);
	assert.match(DEMO_SOURCE, /image\.naturalHeight/);
	assert.match(DEMO_SOURCE, /getPreviewAspectRatio\(uploadedImage\)/);
	assert.match(DEMO_SOURCE, /style=\{\{ aspectRatio: previewAspectRatio/);
	assert.doesNotMatch(DEMO_SOURCE, /className="aspect-video w-full overflow-hidden rounded-lg"/);
});

test("ASCII shader uses a generated glyph atlas and luminance pass", () => {
	assert.match(SHADER_SOURCE, /createAsciiAtlas/);
	assert.match(SHADER_SOURCE, /u_asciiAtlas/);
	assert.match(SHADER_SOURCE, /u_characterCount/);
	assert.match(CORE_SOURCE, /ASCII_CHARACTER_MODES = \["signal", "sequence"\]/);
	assert.match(SHADER_SOURCE, /characterMode \?\? "signal"/);
	assert.doesNotMatch(SHADER_SOURCE, /charset === "custom" \? "sequence"/);
	assert.match(SHADER_SOURCE, /u_characterMode/);
	assert.match(SHADER_SOURCE, /floor\(clamp\(biasedGlyphSignal, 0\.0, 1\.0\) \* characterCount\)/);
	assert.doesNotMatch(SHADER_SOURCE, /biasedGlyphSignal \* \(characterCount - 1\.0\)/);
	assert.match(SHADER_SOURCE, /sequenceCharacterIndex = floor\(mod\(cellID\.x \+ cellID\.y \* cellCount\.x, characterCount\)\)/);
	assert.match(SHADER_SOURCE, /u_characterMode > 0\.5 \? sequenceCharacterIndex : signalCharacterIndex/);
	assert.match(SHADER_SOURCE, /Math\.ceil\(Math\.sqrt\(glyphs\.length\)\)/);
	assert.doesNotMatch(SHADER_SOURCE, /ASCII_ATLAS_MAX_COLUMNS/);
	assert.match(SHADER_SOURCE, /dot\(color, vec3\(0\.2126, 0\.7152, 0\.0722\)\)/);
	assert.match(SHADER_SOURCE, /sampleCoverTexture/);
	assert.match(SHADER_SOURCE, /blendColor/);
	assert.match(SHADER_SOURCE, /maskValue/);
	assert.match(SHADER_SOURCE, /toneMap/);
	assert.match(SHADER_SOURCE, /shapedSignal/);
	assert.match(SHADER_SOURCE, /u_colorSourceMode/);
	assert.match(SHADER_SOURCE, /sourceColorFromMode/);
	assert.match(SHADER_SOURCE, /u_sourceColors/);
	assert.match(SHADER_SOURCE, /u_sourceColorCount/);
	assert.match(DETAILS_SOURCE, /colorSourceMode/);
	assert.match(DETAILS_SOURCE, /sourceColors/);
});
