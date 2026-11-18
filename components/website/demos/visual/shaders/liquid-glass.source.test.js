const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const LIQUID_GLASS_SOURCE = fs.readFileSync(
	path.join(__dirname, "liquid-glass.tsx"),
	"utf8",
);
const LIQUID_GLASS_BUTTON_SOURCE = fs.readFileSync(
	path.join(__dirname, "liquid-glass-button.tsx"),
	"utf8",
);
const LIQUID_GLASS_DEMO_SOURCE = fs.readFileSync(
	path.join(__dirname, "../liquid-glass-demo.tsx"),
	"utf8",
);

test("LiquidGlass starts with a deterministic blur fallback before support detection", () => {
	assert.match(
		LIQUID_GLASS_SOURCE,
		/const FALLBACK_BACKDROP_FILTER = "blur\(14px\) saturate\(1\.4\)";/,
	);
	assert.match(LIQUID_GLASS_SOURCE, /backdropSupported === null/);
	assert.match(LIQUID_GLASS_SOURCE, /backdropFilter: FALLBACK_BACKDROP_FILTER/);
	assert.match(LIQUID_GLASS_SOURCE, /WebkitBackdropFilter: FALLBACK_BACKDROP_FILTER/);
	assert.doesNotMatch(
		LIQUID_GLASS_SOURCE,
		/no backdrop-filter"\s+fallback on the server and first client render/,
	);
});

test("LiquidGlass initializes SVG support before the first client paint", () => {
	assert.match(
		LIQUID_GLASS_SOURCE,
		/import type \{ CSSProperties, ReactNode, RefObject \} from "react";/,
	);
	assert.match(
		LIQUID_GLASS_SOURCE,
		/import \{ useCallback, useEffect, useId, useLayoutEffect, useRef, useState \} from "react";/,
	);
	assert.match(
		LIQUID_GLASS_SOURCE,
		/const useIsomorphicLayoutEffect =\s+typeof window === "undefined" \? useEffect : useLayoutEffect;/,
	);
	assert.match(
		LIQUID_GLASS_SOURCE,
		/useIsomorphicLayoutEffect\(\(\) => \{\s+updateDisplacementMap\(\);/,
	);
	assert.match(LIQUID_GLASS_SOURCE, /useIsomorphicLayoutEffect\(\(\) => \{\s+const check = \(\) => \{/);
});

test("LiquidGlass only applies the SVG filter after a displacement map exists", () => {
	assert.match(LIQUID_GLASS_SOURCE, /const \[filterReady, setFilterReady\] = useState\(false\);/);
	assert.match(
		LIQUID_GLASS_SOURCE,
		/if \(!href\) \{\s+setFilterReady\(false\);\s+return;\s+\}/,
	);
	assert.match(LIQUID_GLASS_SOURCE, /setFilterReady\(true\);/);
	assert.match(LIQUID_GLASS_SOURCE, /if \(svgSupported && filterReady\) \{/);
	assert.doesNotMatch(LIQUID_GLASS_SOURCE, /if \(svgSupported\) \{/);
});

test("LiquidGlass keeps pointer-reactive layers opt-in", () => {
	assert.match(LIQUID_GLASS_SOURCE, /pointerLayers = false,/);
	assert.match(LIQUID_GLASS_SOURCE, /pointerSmoothing = 1,/);
	assert.match(
		LIQUID_GLASS_SOURCE,
		/const pointerTrackingEnabled = resolvedPointerLayers\.length > 0 \|\| pointerInput !== null;/,
	);
	assert.match(
		LIQUID_GLASS_SOURCE,
		/\{resolvedPointerLayers\.length > 0 \? \(/,
	);
});

test("LiquidGlass can smooth pointer layer movement without changing the default", () => {
	assert.match(LIQUID_GLASS_SOURCE, /pointerSmoothing\?: number;/);
	assert.match(LIQUID_GLASS_SOURCE, /const POINTER_SMOOTHING_REST_DELTA = 0\.01;/);
	assert.match(LIQUID_GLASS_SOURCE, /function getSmoothedPointerState/);
	assert.match(LIQUID_GLASS_SOURCE, /function getShortestAngleDelta/);
	assert.match(LIQUID_GLASS_SOURCE, /const smoothingAmount = clamp\(pointerSmoothing, 0\.01, 1\);/);
	assert.match(LIQUID_GLASS_SOURCE, /requestAnimationFrame\(animatePointer\)/);
	assert.match(LIQUID_GLASS_SOURCE, /cancelAnimationFrame\(pointerAnimationFrameRef\.current\)/);
});

test("LiquidGlass demo enables advanced layer and stage tracking by default", () => {
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_POINTER_LAYERS = true;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_POINTER_CONTAINER_TRACKING = true;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_POINTER_SMOOTHING = 0\.2;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /useState\(DEFAULT_POINTER_LAYERS\)/);
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/useState\(\s+DEFAULT_POINTER_CONTAINER_TRACKING,\s+\)/,
	);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /useState\(DEFAULT_POINTER_SMOOTHING\)/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /pointerSmoothing=\{pointerSmoothing\}/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /id="lg-pointer-smoothing"/);
});

test("LiquidGlass demo applies shared visual settings and stage tracking to both glass surfaces", () => {
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/import LiquidGlass, \{\s+type LiquidGlassPointerInput,\s+type LiquidGlassProps,\s+\} from "\.\/shaders\/liquid-glass";/,
	);
	const { LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS } = require("./liquid-glass-button-config.ts");
	assert.deepEqual(LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS, {
		borderRadius: 9999, borderWidth: 0.05, brightness: 50, opacity: 0.9,
		blur: 4, backgroundOpacity: 0.18, saturation: 1, distortionScale: -40,
		dispersion: 4, borderColor: "var(--ds-border)", borderOpacity: 1, dropShadow: false,
	});
	assert.match(
		LIQUID_GLASS_BUTTON_SOURCE,
		/\{\.\.\.LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\}/,
	);
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/import \{\s+LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS,\s+LiquidGlassButton,\s+\} from "\.\/shaders\/liquid-glass-button";/,
	);
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/const DEFAULT_BORDER_RADIUS = LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\.borderRadius;/,
	);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_OPACITY = LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\.opacity;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_BLUR = LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\.blur;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_BG_OPACITY = LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\.backgroundOpacity;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_DISTORTION_SCALE = LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\.distortionScale;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_DISPERSION = LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\.dispersion;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_RED_OFFSET = 0;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_GREEN_OFFSET = 0;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_BLUE_OFFSET = 0;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const DEFAULT_BORDER_OPACITY = LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\.borderOpacity;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const SHARED_GLASS_BORDER_COLOR = LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\.borderColor;/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const SHARED_GLASS_DROP_SHADOW = LIQUID_GLASS_BUTTON_DEFAULT_GLASS_PROPS\.dropShadow;/);
	const sharedPropsStart = LIQUID_GLASS_DEMO_SOURCE.indexOf("const sharedGlassVisualProps");
	const sharedPropsEnd = LIQUID_GLASS_DEMO_SOURCE.indexOf("const buttonGlassProps");
	assert.notEqual(sharedPropsStart, -1);
	assert.notEqual(sharedPropsEnd, -1);
	const sharedPropsSource = LIQUID_GLASS_DEMO_SOURCE.slice(sharedPropsStart, sharedPropsEnd);
	assert.match(
		sharedPropsSource,
		/borderWidth,[\s\S]*brightness,[\s\S]*opacity,[\s\S]*blur,[\s\S]*displace,[\s\S]*backgroundOpacity,[\s\S]*saturation,[\s\S]*distortionScale,[\s\S]*dispersion,[\s\S]*redOffset,[\s\S]*greenOffset,[\s\S]*blueOffset,/,
	);
	assert.match(sharedPropsSource, /xChannel: "R",[\s\S]*yChannel: "G",/);
	assert.match(sharedPropsSource, /borderColor: SHARED_GLASS_BORDER_COLOR,/);
	assert.match(sharedPropsSource, /borderOpacity,/);
	assert.match(sharedPropsSource, /dropShadow: SHARED_GLASS_DROP_SHADOW,/);
	const buttonPropsSource = LIQUID_GLASS_DEMO_SOURCE.slice(sharedPropsEnd);
	assert.match(
		buttonPropsSource,
		/const buttonGlassProps = useMemo<Partial<LiquidGlassProps>>\(\s+\(\) => \(\{\s+\.\.\.sharedGlassVisualProps,/,
	);
	assert.match(buttonPropsSource, /borderRadius,/);
	assert.match(buttonPropsSource, /pointerInput: pointerLayers \? buttonPointerInput : null,/);
	assert.match(buttonPropsSource, /pointerActivationRadius: resolvedPointerActivationRadius,[\s\S]*pointerLayers,[\s\S]*pointerSmoothing,/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const \[buttonPointerInput, setButtonPointerInput\]\s+=\s+useState<LiquidGlassPointerInput \| null>\(null\);/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /const buttonRef = useRef<HTMLButtonElement>\(null\);/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /getGlassPointerInput\(buttonRef\.current, event\.clientX, event\.clientY\)/);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /setButtonPointerInput\(null\);/);
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/<LiquidGlass\s+\{\.\.\.sharedGlassVisualProps\}\s+width=\{width\}/,
	);
	assert.match(LIQUID_GLASS_DEMO_SOURCE, /pointerActivationRadius=\{resolvedPointerActivationRadius\}/);
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/<LiquidGlassButton[\s\S]*ref=\{buttonRef\}[\s\S]*glassProps=\{buttonGlassProps\}/,
	);
});

test("LiquidGlassButton stage-tracks its edge layer when glass pointer props are provided", () => {
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /mouseContainer: glassMouseContainer = null,/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerActivationRadius: glassPointerActivationRadius,/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerInput: glassPointerInput = null,/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerLayers: glassPointerLayers,/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerSmoothing: glassPointerSmoothing,/);
	assert.match(
		LIQUID_GLASS_BUTTON_SOURCE,
		/const edgePointerTrackingEnabled = \(\s+glassPointerInput !== null\s+\|\| \(glassPointerLayers !== undefined && glassPointerLayers !== false\)\s+\);/,
	);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /const edgePointerActivationRadius = glassPointerActivationRadius \?\? hoverArea;/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /const edgePointerSmoothing = glassPointerSmoothing \?\? 1;/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /const smoothingAmount = clamp\(edgePointerSmoothing, 0\.01, 1\);/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /if \(edgePointerTrackingEnabled\) return;[\s\S]*document\.addEventListener\("pointermove", handlePointerMove/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /const target = glassMouseContainer\?\.current \?\? buttonRef\.current;/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /target\.addEventListener\("pointermove", handlePointerMove, \{ passive: true \}\);/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /updatePointer\(event\.clientX, event\.clientY, true, edgePointerActivationRadius\);/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /const magnetStrength = disabled[\s\S]*getPointerStrength\(x, y, rect\.width, rect\.height, hoverArea\);/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /if \(edgePointerTrackingEnabled\) \{\s+resetMagnetMotion\(\);/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /mouseContainer=\{glassMouseContainer\}/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerActivationRadius=\{glassPointerActivationRadius\}/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerInput=\{glassPointerInput\}/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerLayers=\{glassPointerLayers\}/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerSmoothing=\{glassPointerSmoothing\}/);
});

test("LiquidGlassButton can keep stage-tracked edge light separate from button fill", () => {
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerFill\?: boolean;/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointerFill = true,/);
	assert.match(
		LIQUID_GLASS_BUTTON_SOURCE,
		/pointerFill\s+\? "calc\(var\(--liquid-glass-button-strength, 0\) \* 0\.14 \+ var\(--liquid-glass-button-pressed, 0\) \* 0\.12\)"\s+: "calc\(var\(--liquid-glass-button-pressed, 0\) \* 0\.12\)"/,
	);
});

test("LiquidGlass demo stage tracking uses viewport input without pointer-radius gating", () => {
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/const resolvedPointerActivationRadius = pointerContainerTracking\s+\?\s+Number\.POSITIVE_INFINITY\s+:\s+pointerActivationRadius;/,
	);
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/if \(pointerContainerTracking\) \{[\s\S]*const viewportWidth = window\.innerWidth;[\s\S]*const viewportHeight = window\.innerHeight;[\s\S]*active:[\s\S]*clientX >= 0 &&[\s\S]*clientX <= viewportWidth &&[\s\S]*clientY >= 0 &&[\s\S]*clientY <= viewportHeight,/,
	);
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/Tracks pointer movement across the whole browser viewport instead of only the glass card\./,
	);
	assert.match(
		LIQUID_GLASS_DEMO_SOURCE,
		/id="lg-pointer-activation-radius"[\s\S]*Disabled while Stage tracking reads the whole browser viewport\.[\s\S]*disabled=\{pointerContainerTracking\}/,
	);
});

test("LiquidGlass pointer defaults use VPK token colors instead of copied overlays", () => {
	const pointerDefaultsStart = LIQUID_GLASS_SOURCE.indexOf("const DEFAULT_POINTER_EDGE_COLOR");
	const pointerDefaultsEnd = LIQUID_GLASS_SOURCE.indexOf("const useIsomorphicLayoutEffect");
	const pointerDefaults = LIQUID_GLASS_SOURCE.slice(pointerDefaultsStart, pointerDefaultsEnd);
	const defaultLayersStart = LIQUID_GLASS_SOURCE.indexOf("const DEFAULT_POINTER_LAYERS");
	const defaultLayersEnd = LIQUID_GLASS_SOURCE.indexOf("function formatCssLength");
	const defaultLayers = LIQUID_GLASS_SOURCE.slice(defaultLayersStart, defaultLayersEnd);

	assert.match(pointerDefaults, /var\(--ds-surface-overlay\)/);
	assert.match(pointerDefaults, /var\(--ds-text\)/);
	assert.match(pointerDefaults, /var\(--ds-text-inverse\)/);
	assert.match(defaultLayers, /type: "edge"/);
	assert.doesNotMatch(defaultLayers, /type: "spot"/);
	assert.doesNotMatch(defaultLayers, /radial-gradient/);
	assert.doesNotMatch(pointerDefaults, /bg-black|bg-white|text-white/);
	assert.doesNotMatch(pointerDefaults, /rgba\(\s*(0|255)\s*,\s*(0|255)\s*,\s*(0|255)/);
});

test("LiquidGlass does not copy upstream elastic transform behavior", () => {
	assert.doesNotMatch(LIQUID_GLASS_SOURCE, /calculateElasticTranslation/);
	assert.doesNotMatch(LIQUID_GLASS_SOURCE, /calculateDirectionalScale/);
	assert.doesNotMatch(LIQUID_GLASS_SOURCE, /transformStyle/);
	assert.doesNotMatch(LIQUID_GLASS_SOURCE, /translate\(calc\(-50%/);
	assert.doesNotMatch(LIQUID_GLASS_SOURCE, /onMouseDown=\{\(\) => setIsActive/);
});

test("LiquidGlass measures displacement maps from layout size, not transformed geometry", () => {
	assert.match(LIQUID_GLASS_SOURCE, /const w = el\?\.offsetWidth \?\? 0;/);
	assert.match(LIQUID_GLASS_SOURCE, /const h = el\?\.offsetHeight \?\? 0;/);
	assert.doesNotMatch(LIQUID_GLASS_SOURCE, /const rect = containerRef\.current\?\.getBoundingClientRect\(\);\s+const w = rect\?\.width/);
});

test("LiquidGlassButton owns semantic button interaction and motion", () => {
	assert.match(
		LIQUID_GLASS_BUTTON_SOURCE,
		/export function LiquidGlassButton\(/,
	);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /motion\.button/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /type = "button"/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /disabled = false/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /focus-visible:border-ring/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /whileTap=\{disabled \|\| shouldReduceMotion \? undefined : \{ scale: pressScale \}\}/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /useMotionValue\(0\)/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /--liquid-glass-button-strength/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /--liquid-glass-button-pressed/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /pointer-events-none absolute inset-0/);
});

test("LiquidGlassButton composes an external ref for render-target usage", () => {
	assert.match(
		LIQUID_GLASS_BUTTON_SOURCE,
		/import type \{[\s\S]*Ref,[\s\S]*\} from "react";/,
	);
	assert.match(
		LIQUID_GLASS_BUTTON_SOURCE,
		/function setComposedButtonRef\(ref: Ref<HTMLButtonElement> \| undefined, node: HTMLButtonElement \| null\)/,
	);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /ref: externalRef/);
	assert.match(
		LIQUID_GLASS_BUTTON_SOURCE,
		/const composedButtonRef = useCallback\(\(node: HTMLButtonElement \| null\) => \{/,
	);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /buttonRef\.current = node;/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /setComposedButtonRef\(externalRef, node\);/);
	assert.match(LIQUID_GLASS_BUTTON_SOURCE, /ref=\{composedButtonRef\}/);
});
