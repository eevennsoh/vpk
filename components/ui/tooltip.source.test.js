const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "tooltip.tsx"), "utf8");

test("tooltip animation defaults on and can be turned off", () => {
	assert.match(source, /animate\?: boolean/u);
	assert.match(source, /animate = true/u);
	assert.match(source, /const shouldAnimate = animate \?\? animateFromRoot/u);
	assert.match(
		source,
		/shouldAnimate\s*\?\s*TOOLTIP_POPUP_ANIMATION_CLASSES\s*:\s*"transition-none motion-reduce:transition-none"/u,
	);
});

test("tooltip provider and primitive default to an immediate hover delay", () => {
	assert.match(source, /delay = 0/u);
	assert.match(source, /return hasProvider \? root : <TooltipProvider>\{root\}<\/TooltipProvider>/u);
});

test("tooltip content uses popup-family fade and 8px side-axis slide", () => {
	assert.match(source, /transition-\[opacity,translate\] duration-normal ease-out-practical/u);
	assert.match(source, /motion-reduce:transition-none/u);
	assert.match(source, /data-ending-style:duration-fast data-ending-style:ease-in/u);
	assert.match(source, /data-starting-style:opacity-0 data-ending-style:opacity-0/u);
	assert.match(source, /data-\[side=top\]:data-starting-style:translate-y-2/u);
	assert.match(source, /data-\[side=bottom\]:data-starting-style:-translate-y-2/u);
	assert.match(source, /data-\[side=left\]:data-starting-style:translate-x-2/u);
	assert.match(source, /data-\[side=right\]:data-starting-style:-translate-x-2/u);
	assert.doesNotMatch(source, /origin-\(--transform-origin\)/u);
	assert.doesNotMatch(source, /data-starting-style:scale-/u);
	assert.doesNotMatch(source, /data-ending-style:scale-/u);
	assert.doesNotMatch(source, /transition-opacity duration-fast ease-out/u);
});

test("tooltip content keeps the shared portal positioner layer hook", () => {
	assert.match(source, /portalContainer\?: TooltipPrimitive\.Portal\.Props\["container"\]/u);
	assert.match(source, /<TooltipPortalContainerContext value=\{portalContainer\}>/u);
	assert.match(source, /<TooltipPrimitive\.Portal container=\{portalContainer\}>/u);
	assert.match(source, /positionerClassName\?: string/u);
	assert.match(source, /"align" \| "alignOffset" \| "anchor" \| "collisionAvoidance" \| "side" \| "sideOffset"/u);
	assert.match(source, /<TooltipPrimitive\.Positioner[\s\S]*anchor=\{anchor\}/u);
	assert.match(
		source,
		/className=\{cn\("isolate z-\[200\]", positionerClassName\)\}/u,
	);
});

test("tooltip closes when a window or nested container scrolls", () => {
	assert.match(source, /const internalActionsRef = React\.useRef<TooltipPrimitive\.Root\.Actions \| null>\(null\)/u);
	assert.match(source, /if \(!isOpen\) \{[\s\S]*return undefined[\s\S]*\}/u);
	assert.match(source, /window\.addEventListener\("scroll", handleScroll, \{[\s\S]*capture: true,[\s\S]*passive: true,[\s\S]*\}\)/u);
	assert.match(source, /internalActionsRef\.current\?\.close\(\)/u);
	assert.match(source, /window\.removeEventListener\("scroll", handleScroll, true\)/u);
});
