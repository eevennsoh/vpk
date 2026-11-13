const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const GLASS_SLIDER_FILE = path.join(__dirname, "glass-slider.tsx");
const GLASS_SLIDER_SOURCE = fs.readFileSync(GLASS_SLIDER_FILE, "utf8");

test("GlassSlider retargets parent-driven fill updates while keeping hover and drag sync immediate", () => {
	assert.match(
		GLASS_SLIDER_SOURCE,
		/const skipControlledFillAnimationRef = useRef\(false\);/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/skipControlledFillAnimationRef\.current = true;\s+setValue\(roundValue\(snappedValue, step\)\);/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/skipControlledFillAnimationRef\.current = true;\s+setValue\(roundValue\(newValue, step\)\);/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/if \(skipControlledFillAnimationRef\.current\) \{\s+skipControlledFillAnimationRef\.current = false;\s+fillPercent\.jump\(percentage\);/s,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/if \(fillPercent\.get\(\) !== percentage\) \{\s+animateFillTo\(percentage\);/s,
	);
	assert.doesNotMatch(
		GLASS_SLIDER_SOURCE,
		/if \(!animRef\.current && fillPercent\.get\(\) !== percentage\) \{\s+animateFillTo\(percentage\);/s,
	);
	assert.doesNotMatch(
		GLASS_SLIDER_SOURCE,
		/if \(!isInteracting && !animRef\.current\) \{\s+fillPercent\.jump\(percentage\);/s,
	);
});

test("GlassSlider reuses hover elasticity for keyboard navigation pulses", () => {
	assert.match(
		GLASS_SLIDER_SOURCE,
		/function hoverStretchFromNorm\(norm: number\)/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/function computeHoverStretchFromPercent\(percent: number\)/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/keyboardNavigationPulseKey\?: number;/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/const \[isKeyboardActive, setIsKeyboardActive\] = useState\(false\);/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/const isActive = isInteracting \|\| isHovered \|\| isKeyboardActive;/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/const pulseKeyboardHover = useCallback\(/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/const targetStretch = computeHoverStretchFromPercent\(targetPercent\);/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/useEffect\(\(\) => \{\s+if \(keyboardNavigationPulseKey <= 0\) return;\s+pulseKeyboardHover\(percentage\);/s,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/pulseKeyboardHover\(percentFromValue\(rounded\)\);/,
	);
});

test("GlassSlider lets pinned hover visuals reverse naturally while skipping preview settle paths", () => {
	assert.doesNotMatch(
		GLASS_SLIDER_SOURCE,
		/snapPinnedHoverExitRef/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/useLayoutEffect\(\(\) => \{\s+const target = isActive \? 1\.04 : 1;/s,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/useLayoutEffect\(\(\) => \{\s+const targetHeight = isActive \? activeMeniscusHeightPx : restMeniscusHeightPx;/s,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/if \(shouldReduceMotion\) \{\s+activeScaleY\.jump\(target\);\s+return;\s+\}/s,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/if \(shouldReduceMotion\) \{\s+meniscusHeightMV\.jump\(targetHeight\);\s+meniscusCurveMV\.jump\(targetCurve\);\s+writeMeniscusMaskFromMVs\(\);\s+return;\s+\}/s,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/const skipPinnedHoverLeaveSettle =\s+pinned && !isInteracting && !isKeyboardActive;/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/if \(skipPinnedHoverLeaveSettle\) \{\s+rubberStretch\.jump\(0\);/s,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/if \(skipPinnedHoverLeaveSettle\) \{\s+animRef\.current\?\.stop\(\);\s+animRef\.current = null;\s+fillPercent\.jump\(targetPercent\);/s,
	);
});

test("GlassSlider keeps keyboard focusability without a visible focus ring class", () => {
	assert.match(
		GLASS_SLIDER_SOURCE,
		/role="slider"/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/tabIndex=\{0\}/,
	);
	assert.doesNotMatch(
		GLASS_SLIDER_SOURCE,
		/focus-visible:ring-[\w-]+/,
	);
});

test("GlassSlider overlaps the meniscus body mask so the cap join cannot show a seam", () => {
	assert.match(
		GLASS_SLIDER_SOURCE,
		/const MENISCUS_MASK_JOIN_OVERLAP_PX = 1;/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/maskSize: `100% \$\{h\}px, 100% calc\(100% - \$\{h\}px \+ \$\{MENISCUS_MASK_JOIN_OVERLAP_PX\}px\)`/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/WebkitMaskSize: `100% \$\{h\}px, 100% calc\(100% - \$\{h\}px \+ \$\{MENISCUS_MASK_JOIN_OVERLAP_PX\}px\)`/,
	);
});

test("GlassSlider embosses labeled city ticks so they stay legible on the glass rail", () => {
	assert.match(
		GLASS_SLIDER_SOURCE,
		/const GLASS_SLIDER_TICK_EMBOSS_BOX_SHADOW =/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/\? \{ backgroundImage: ROVO_TICK_GRADIENT \}/,
	);
	assert.match(
		GLASS_SLIDER_SOURCE,
		/: hasLabel\s+\? \{ boxShadow: GLASS_SLIDER_TICK_EMBOSS_BOX_SHADOW \}/,
	);
	assert.doesNotMatch(
		GLASS_SLIDER_SOURCE,
		/GLASS_SLIDER_TICK_EMBOSS_TEXT_SHADOW/,
	);
});
