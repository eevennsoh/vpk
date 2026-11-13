const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const CONTROL_FLYOUT_SOURCE = fs.readFileSync(
	path.join(__dirname, "personal-graph-control-flyout.tsx"),
	"utf8",
);

test("Personal Graph flyout label chips stay off narrow viewports", () => {
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/className="pointer-events-none absolute right-\[calc\(100%\+12px\)\] top-1\/2 hidden -translate-y-1\/2 whitespace-nowrap rounded-md bg-bg-neutral-bold px-3 py-1\.5 text-xs text-text-inverse shadow-md sm:block"/,
	);
	assert.match(CONTROL_FLYOUT_SOURCE, /label=\{action\.label\}/);
	assert.match(CONTROL_FLYOUT_SOURCE, /aria-label=\{label\}/);
	assert.doesNotMatch(
		CONTROL_FLYOUT_SOURCE,
		/rounded-lg border border-border bg-bg-neutral-subtle px-2\.5 py-1 text-xs font-medium text-text shadow-sm/,
	);
});

test("Personal Graph flyout action buttons render provided controls directly", () => {
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/import \{ Button \} from "@\/components\/ui\/button";/,
	);
	assert.match(CONTROL_FLYOUT_SOURCE, /\{action\.render\}/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /PersonalGraphLiquidGlassIconButton/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /chromaticEdge/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /<PersonalGraphGlassPanel/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /PersonalGraphControlFlyoutActionGlass/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /type LiquidGlassProps/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /const ACTION_GLASS_PROPS/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /<LiquidGlass/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /backgroundOpacity: 1,/);
});

test("Personal Graph flyout avoids stacking route-local magnet motion on liquid-glass buttons", () => {
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /const ACTION_MAGNET_DISTANCE/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /ACTION_MAGNET_ICON_DISTANCE/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /ACTION_MAGNET_HOVER_AREA/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /ACTION_MAGNET_SPRING/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /function getActionMagnetRect/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /function usePersonalGraphFlyoutActionMagnet/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /function PersonalGraphControlFlyoutActionMagnet/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /document\.addEventListener\("mousemove"/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /useMotionValue/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /useSpring/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /useReducedMotion/);
	assert.match(CONTROL_FLYOUT_SOURCE, /data-personal-graph-flyout-label/);
	assert.match(CONTROL_FLYOUT_SOURCE, /className="relative inline-flex items-center justify-center"/);
	assert.match(CONTROL_FLYOUT_SOURCE, /data-personal-graph-flyout-label=""/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /--personal-graph-flyout-icon/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /PersonalGraphControlFlyoutTrigger[\s\S]*usePersonalGraphFlyoutActionMagnet/);
});

test("Personal Graph flyout arc motion scales the existing glass item", () => {
	assert.match(CONTROL_FLYOUT_SOURCE, /offsetDistance: `\$\{distance\}%`/);
	assert.match(CONTROL_FLYOUT_SOURCE, /initial=\{\{ offsetDistance: "0%", scale: ACTION_SCALE_INITIAL \}\}/);
	assert.match(CONTROL_FLYOUT_SOURCE, /offsetDistance: "0%"/);
	assert.match(CONTROL_FLYOUT_SOURCE, /const ACTION_SCALE_INITIAL = 0\.34;/);
	assert.match(CONTROL_FLYOUT_SOURCE, /scale: 1/);
	assert.match(CONTROL_FLYOUT_SOURCE, /scale: ACTION_SCALE_INITIAL/);
	assert.match(CONTROL_FLYOUT_SOURCE, /transformOrigin: "center"/);
	assert.match(CONTROL_FLYOUT_SOURCE, /willChange: "transform"/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /ACTION_STAGGER_BLUR_FILTER/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /ACTION_STAGGER_REST_FILTER/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /filter: /);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /opacity: 0, scale: 0\.3/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /scale: 0\.3/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /className="block origin-center"/);
});

test("Personal Graph flyout action motion exits in the same near-to-far order", () => {
	assert.match(CONTROL_FLYOUT_SOURCE, /function getFlyoutActionEnterDelay\(index: number\): number/);
	assert.match(CONTROL_FLYOUT_SOURCE, /return index \* STAGGER_INTERVAL;/);
	assert.match(CONTROL_FLYOUT_SOURCE, /function getFlyoutActionExitDelay\(index: number\): number/);
	assert.match(CONTROL_FLYOUT_SOURCE, /return getFlyoutActionEnterDelay\(index\);/);
	assert.match(CONTROL_FLYOUT_SOURCE, /const enterDelay = getFlyoutActionEnterDelay\(index\);/);
	assert.match(CONTROL_FLYOUT_SOURCE, /const exitDelay = getFlyoutActionExitDelay\(index\);/);
	assert.match(CONTROL_FLYOUT_SOURCE, /transition: \{ \.\.\.ITEM_TRANSITION, delay: enterDelay \}/);
	assert.match(CONTROL_FLYOUT_SOURCE, /transition: \{ \.\.\.ITEM_TRANSITION, delay: exitDelay \}/);
	assert.match(CONTROL_FLYOUT_SOURCE, /transition=\{\{ delay: index \* STAGGER_INTERVAL \+ 0\.1, duration: 0\.15 \}\}/);
	assert.match(CONTROL_FLYOUT_SOURCE, /const ARC_ACTION_STEP_PERCENT = 12\.6;/);
	assert.match(CONTROL_FLYOUT_SOURCE, /const distance = \(index \+ 1\) \* ARC_ACTION_STEP_PERCENT;/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /actionCount=\{actions\.length\}/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /actionCount - 1 - index/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /ARC_TRAVEL_PERCENT/);
});

test("Personal Graph flyout action buttons stay hidden while stacked at the arc origin", () => {
	assert.match(CONTROL_FLYOUT_SOURCE, /const ARC_ORIGIN_VISIBILITY_THRESHOLD_PERCENT = 2;/);
	assert.match(CONTROL_FLYOUT_SOURCE, /const ARC_EXIT_BEHIND_TRIGGER_THRESHOLD_PERCENT = 40;/);
	assert.match(CONTROL_FLYOUT_SOURCE, /const ACTION_ACTIVE_Z_INDEX = 40;/);
	assert.match(CONTROL_FLYOUT_SOURCE, /const ACTION_BEHIND_TRIGGER_Z_INDEX = 0;/);
	assert.match(CONTROL_FLYOUT_SOURCE, /aria-hidden=\{!isOpen\}/);
	assert.match(CONTROL_FLYOUT_SOURCE, /inert=\{!isOpen\}/);
	assert.match(CONTROL_FLYOUT_SOURCE, /function PersonalGraphControlFlyoutActionItem/);
	assert.match(CONTROL_FLYOUT_SOURCE, /onUpdate=\{\(latest\) => updateOriginVisibility\(latest\.offsetDistance\)\}/);
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/const isOpeningAtOrigin = isPresent && distancePercent < ARC_ORIGIN_VISIBILITY_THRESHOLD_PERCENT;/,
	);
	assert.match(CONTROL_FLYOUT_SOURCE, /visibility: "hidden"/);
	assert.match(CONTROL_FLYOUT_SOURCE, /item\.style\.visibility = isOpeningAtOrigin \? "hidden" : "";/);
	assert.match(CONTROL_FLYOUT_SOURCE, /item\.style\.pointerEvents = isOpeningAtOrigin \|\| isExitingNearTrigger \? "none" : "";/);
});

test("Personal Graph flyout action buttons reverse fully while sliding behind the trigger", () => {
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/import \{\s+AnimatePresence,\s+motion,\s+useIsPresent,\s+type Transition,\s+\} from "motion\/react";/,
	);
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/import \{ useCallback, useLayoutEffect, useRef, type ReactNode \} from "react";/,
	);
	assert.match(CONTROL_FLYOUT_SOURCE, /const isPresent = useIsPresent\(\);/);
	assert.match(CONTROL_FLYOUT_SOURCE, /offsetDistance: "0%"/);
	assert.match(CONTROL_FLYOUT_SOURCE, /onUpdate=\{\(latest\) => updateOriginVisibility\(latest\.offsetDistance\)\}/);
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/const isExitingNearTrigger = !isPresent && distancePercent < ARC_EXIT_BEHIND_TRIGGER_THRESHOLD_PERCENT;/,
	);
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/item\.style\.zIndex = isExitingNearTrigger\s+\? ACTION_BEHIND_TRIGGER_Z_INDEX\.toString\(\)\s+: ACTION_ACTIVE_Z_INDEX\.toString\(\);/,
	);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /<PersonalGraphLiquidGlassIconButton/);
	assert.match(CONTROL_FLYOUT_SOURCE, /zIndex: ACTION_ACTIVE_Z_INDEX,/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /personal-graph-flyout-action-icon-opacity/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /personal-graph-flyout-action-visual-opacity/);
	assert.match(CONTROL_FLYOUT_SOURCE, /item\.style\.visibility = isOpeningAtOrigin \? "hidden" : "";/);
	assert.match(CONTROL_FLYOUT_SOURCE, /useLayoutEffect\(\(\) => \{/);
	assert.match(CONTROL_FLYOUT_SOURCE, /if \(!item \|\| isPresent\) return;/);
	assert.match(CONTROL_FLYOUT_SOURCE, /updateOriginVisibility\(getComputedStyle\(item\)\.offsetDistance\);/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /item\.style\.opacity = "0";/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /item\.style\.visibility = isExitingNearTrigger/);
});

test("Personal Graph flyout trigger remains a two-state settings or close button", () => {
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/aria-label=\{isOpen \? "Close graph controls" : "Open graph controls"\}/,
	);
	assert.match(CONTROL_FLYOUT_SOURCE, /<Button/);
	assert.match(CONTROL_FLYOUT_SOURCE, /variant="ghost"/);
	assert.match(CONTROL_FLYOUT_SOURCE, /size="icon"/);
	assert.match(CONTROL_FLYOUT_SOURCE, /"rounded-full"/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /aria-expanded:!/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /aria-expanded:\[&_svg\]:!/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /\[&_svg\]:text-icon-selected/);
	assert.match(CONTROL_FLYOUT_SOURCE, /const PERSONAL_GRAPH_TRIGGER_OPEN_CLASS_NAME =/);
	assert.match(CONTROL_FLYOUT_SOURCE, /aria-expanded:bg-surface-overlay/);
	assert.match(CONTROL_FLYOUT_SOURCE, /aria-expanded:border-border-bold/);
	assert.match(CONTROL_FLYOUT_SOURCE, /aria-expanded:text-text/);
	assert.match(CONTROL_FLYOUT_SOURCE, /\[&_svg\]:text-border-bold/);
	assert.match(CONTROL_FLYOUT_SOURCE, /hover:bg-surface-overlay-hovered/);
	assert.match(CONTROL_FLYOUT_SOURCE, /active:bg-surface-overlay-pressed/);
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/className=\{cn\(\s+"rounded-full",\s+isOpen && PERSONAL_GRAPH_TRIGGER_OPEN_CLASS_NAME,\s+className,\s+\)\}/,
	);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /PERSONAL_GRAPH_SEARCH_ICON_BUTTON_CLASS_NAME/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /glassProps=\{PERSONAL_GRAPH_SEARCH_ICON_BUTTON_GLASS_PROPS\}/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /magnetDistance=\{0\}/);
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/\{isOpen \? <PixelCloseIcon \/> : <PixelConfigureIcon \/>\}/,
	);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /action\.render[^]*PersonalGraphControlFlyoutTrigger/);
});

test("Personal Graph flyout actions layer active items above the raised trigger", () => {
	assert.match(
		CONTROL_FLYOUT_SOURCE,
		/className=\{cn\("pointer-events-none absolute", className\)\}/,
	);
	assert.match(CONTROL_FLYOUT_SOURCE, /className="relative z-50 inline-flex"/);
	assert.doesNotMatch(CONTROL_FLYOUT_SOURCE, /pointer-events-none absolute z-40/);
});
