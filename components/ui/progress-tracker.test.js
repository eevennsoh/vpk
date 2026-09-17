const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const PROGRESS_TRACKER_SOURCE = fs.readFileSync(path.join(__dirname, "progress-tracker.tsx"), "utf8");
const SPINNER_SOURCE = fs.readFileSync(path.join(__dirname, "spinner.tsx"), "utf8");
const EXPERIMENTAL_SPINNER_SOURCE = fs.readFileSync(path.join(__dirname, "spinner-experimental.tsx"), "utf8");
const EXPERIMENTAL_SPINNER_STYLES = fs.readFileSync(path.join(__dirname, "../../app/jira-agent-motion.css"), "utf8");
const SPINNER_DETAIL_SOURCE = fs.readFileSync(path.join(__dirname, "../../app/data/details/ui/spinner.ts"), "utf8");
const SPINNER_DEMO_SOURCE = fs.readFileSync(path.join(__dirname, "../website/demos/ui/spinner-demo.tsx"), "utf8");
const BOARD_VIEW_MENU_SOURCE = fs.readFileSync(
	path.join(__dirname, "../blocks/jira-kanban/experimental/components/board-view-menu.tsx"),
	"utf8",
);
const SHIMMER_SOURCE = fs.readFileSync(path.join(__dirname, "../ui-custom/shimmer.tsx"), "utf8");
const SHIMMER_WAVE_SOURCE = fs.readFileSync(path.join(__dirname, "../ui-custom/shimmer-wave.tsx"), "utf8");

test("ProgressTracker supports optional bylines and warning steps without replacing default labels", () => {
	assert.match(PROGRESS_TRACKER_SOURCE, /export type ProgressTrackerStepState = "todo" \| "current" \| "done" \| "warning"/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /label: React\.ReactNode/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /byline\?: React\.ReactNode/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /labelClassName\?: string/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /bylineClassName\?: string/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /import WarningIcon from "@atlaskit\/icon\/core\/warning"/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /import \{ Spinner \} from "@\/components\/ui\/spinner"/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /state === "warning"[\s\S]*token\("color\.icon\.warning"\)/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /state === "current"[\s\S]*<Spinner size="xs" className="text-text-subtle" \/>/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /<div className="flex size-3 items-center justify-center">/u);
	assert.doesNotMatch(PROGRESS_TRACKER_SOURCE, /currentSpinner/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /data-slot="progress-tracker-label"/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /data-slot="progress-tracker-byline"/u);
	assert.match(PROGRESS_TRACKER_SOURCE, /typeof step\.label === "string" \? step\.label\.trim\(\) : ""/u);
});

test("Spinner preserves the CodePen chasing-tail motion without competing rotation drivers", () => {
	assert.match(SPINNER_SOURCE, /default: "text-icon-subtlest"/u);
	assert.match(SPINNER_SOURCE, /defaultVariants: \{[\s\S]*variant: "default"/u);
	assert.match(SPINNER_SOURCE, /variant = "default"/u);
	assert.match(SPINNER_DETAIL_SOURCE, /name: "size",[\s\S]*default: `"default"`,[\s\S]*name: "variant",[\s\S]*default: `"default"`,/u);
	assert.match(SPINNER_SOURCE, /import \{ useReducedMotion \} from "motion\/react"/u);
	assert.match(SPINNER_SOURCE, /<svg/u);
	assert.match(SPINNER_SOURCE, /<circle/u);
	assert.match(SPINNER_SOURCE, /transform="rotate\(-90 25 25\)"/u);
	assert.match(
		SPINNER_SOURCE,
		/"spin calc\(var\(--duration-slowest\) \* 2\) var\(--ease-linear\) infinite"/u,
	);
	assert.match(SPINNER_SOURCE, /strokeDasharray="56 200"/u);
	assert.match(SPINNER_SOURCE, /strokeDashoffset="0"/u);
	assert.match(
		SPINNER_SOURCE,
		/const ROVO_RAINBOW_BANDS = \[[\s\S]*\{ color: "#FCA700", share: 0\.3, start: 0 \}[\s\S]*\{ color: "#6A9A23", share: 0\.18, start: 0\.3 \}[\s\S]*\{ color: "#1868DB", share: 0\.21, start: 0\.48 \}[\s\S]*\{ color: "#AF59E1", share: 0\.31, start: 0\.69 \}/u,
	);
	assert.match(SPINNER_SOURCE, /<mask[\s\S]*id=\{tailMaskId\}[\s\S]*maskUnits="userSpaceOnUse"/u);
	assert.match(SPINNER_SOURCE, /\{ROVO_RAINBOW_BANDS\.map\(\(band\) => \{/u);
	assert.match(SPINNER_SOURCE, /const segmentLength = SPINNER_CIRCUMFERENCE \* band\.share/u);
	assert.match(SPINNER_SOURCE, /strokeDasharray=\{`\$\{segmentLength\} \$\{SPINNER_CIRCUMFERENCE - segmentLength\}`\}/u);
	assert.match(SPINNER_SOURCE, /strokeDashoffset=\{-SPINNER_CIRCUMFERENCE \* band\.start\}/u);
	assert.doesNotMatch(SPINNER_SOURCE, /linearGradient|ROVO_RAINBOW_STOPS/u);
	assert.match(SPINNER_SOURCE, /phaseOffsetMs\?: number/u);
	assert.match(SPINNER_SOURCE, /const SPINNER_LOOP_DURATION_MS = 1200/u);
	assert.match(SPINNER_SOURCE, /normalizeSpinnerPhaseOffsetMs\(phaseOffsetMs\)/u);
	assert.match(SPINNER_SOURCE, /animationDelay: shouldReduceMotion \? undefined : negativePhaseOffset/u);
	assert.equal(SPINNER_SOURCE.match(/begin=\{negativePhaseOffset\}/gu)?.length, 2);
	assert.doesNotMatch(SPINNER_SOURCE, /pathLength|pathOffset/u);
	assert.doesNotMatch(SPINNER_SOURCE, /animateTransform/u);
	assert.doesNotMatch(SPINNER_SOURCE, /animate-spin/u);
	assert.match(
		SPINNER_SOURCE,
		/<animate[\s\S]*attributeName="stroke-dasharray"[\s\S]*dur="1\.2s"[\s\S]*keyTimes="0;0\.5;1"[\s\S]*repeatCount="indefinite"[\s\S]*values="1 200;89 200;89 200"/u,
	);
	assert.match(
		SPINNER_SOURCE,
		/<animate[\s\S]*attributeName="stroke-dashoffset"[\s\S]*dur="1\.2s"[\s\S]*keyTimes="0;0\.5;1"[\s\S]*repeatCount="indefinite"[\s\S]*values="0;-35;-124"/u,
	);
	assert.match(SPINNER_SOURCE, /const tailAnimations = shouldReduceMotion \? null : \(/u);
});

test("Spinner exposes the Jira prototype iconic orb only as an experimental variant", () => {
	assert.match(SPINNER_SOURCE, /experimental: "text-icon!"/u);
	assert.match(SPINNER_SOURCE, /variant === "experimental"/u);
	assert.match(SPINNER_SOURCE, /<ExperimentalSpinner/u);
	assert.match(SPINNER_SOURCE, /pulse\?: boolean/u);
	assert.match(SPINNER_SOURCE, /pulse = false/u);
	assert.match(SPINNER_SOURCE, /pulse=\{pulse\}/u);
	assert.match(EXPERIMENTAL_SPINNER_SOURCE, /data-iconic-orb=""/u);
	assert.match(EXPERIMENTAL_SPINNER_SOURCE, /pulse = false/u);
	assert.match(EXPERIMENTAL_SPINNER_SOURCE, /spinner-experimental-orb-rotator-motion/u);
	assert.match(EXPERIMENTAL_SPINNER_SOURCE, /pulse && "spinner-experimental-orb-dot-inner"/u);
	assert.match(
		EXPERIMENTAL_SPINNER_SOURCE,
		/canAnimate && pulse && "spinner-experimental-orb-dot-motion"/u,
	);
	assert.match(
		EXPERIMENTAL_SPINNER_SOURCE,
		/canAnimate && pulse && "spinner-experimental-orb-rotator-pulse-delay"/u,
	);
	assert.match(EXPERIMENTAL_SPINNER_SOURCE, /spinner-experimental-orb-dot-top-right/u);
	assert.match(EXPERIMENTAL_SPINNER_SOURCE, /ORB_DOTS/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /@keyframes spinner-experimental-orb-morph/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /0%, 5% \{ transform: translate\(var\(--orb-inner-x\), var\(--orb-inner-y\)\); \}/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /@keyframes spinner-experimental-orb-opacity/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /25%, 40%, 75%, 90% \{ opacity: var\(--orb-expanded-opacity\); \}/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /32%, 82% \{ opacity: var\(--orb-pulse-opacity\); \}/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /--orb-expanded-opacity: 0\.82/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /--orb-expanded-opacity: 0\.58/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /@utility spinner-experimental-orb-dot-inner/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /@utility spinner-experimental-orb-dot-motion/u);
	assert.match(
		EXPERIMENTAL_SPINNER_STYLES,
		/spinner-experimental-orb-morph calc\(var\(--duration-slowest\) \* 16\) var\(--ease-in-out\) infinite both,[\s\S]*spinner-experimental-orb-opacity calc\(var\(--duration-slowest\) \* 16\) var\(--ease-in-out\) infinite both;/u,
	);
	assert.match(
		EXPERIMENTAL_SPINNER_STYLES,
		/transform: translate\(var\(--orb-outer-x\), var\(--orb-outer-y\)\);/u,
	);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /@keyframes spinner-experimental-orb-rotate/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /@utility spinner-experimental-orb-rotator-pulse-delay/u);
	assert.match(EXPERIMENTAL_SPINNER_STYLES, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.spinner-experimental-orb-dot-motion \{[\s\S]*animation: none;/u);
	assert.doesNotMatch(EXPERIMENTAL_SPINNER_SOURCE, /const HEX =/u);
	assert.doesNotMatch(EXPERIMENTAL_SPINNER_SOURCE, /const SPARKLE =/u);
	assert.match(SPINNER_DETAIL_SOURCE, /six-dot iconic orb/u);
	assert.match(SPINNER_DETAIL_SOURCE, /name: "pulse"/u);
	assert.match(SPINNER_DETAIL_SOURCE, /spinner-demo-experimental/u);
	assert.match(SPINNER_DEMO_SOURCE, /id="spinner-experimental-pulse"/u);
	assert.match(SPINNER_DEMO_SOURCE, /<Switch[\s\S]*onCheckedChange=\{setPulse\}/u);
	assert.match(SPINNER_DEMO_SOURCE, /pulse=\{pulse\}[\s\S]*variant="experimental"/u);
	assert.match(BOARD_VIEW_MENU_SOURCE, /variant="experimental"/u);
	assert.doesNotMatch(BOARD_VIEW_MENU_SOURCE, /pulse/u);
});

test("Shimmer sweeps through the shadcn utility, and the wave stays a separate component", () => {
	// The sweep is the vendored `shimmer` utility from shadcn/tailwind.css, not a
	// local keyframe. Shimmer must stay pure CSS: pulling Motion back in would put
	// a JS animation runtime on all of its callers.
	assert.match(SHIMMER_SOURCE, /cn\(\s*"shimmer /u);
	assert.doesNotMatch(SHIMMER_SOURCE, /motion\/react/u);
	// The per-character wave is a sibling component, not a `wave` prop on Shimmer.
	assert.doesNotMatch(SHIMMER_SOURCE, /\bwave\??:/u);
	assert.match(SHIMMER_WAVE_SOURCE, /export const ShimmerWave = memo\(/u);
	assert.match(SHIMMER_WAVE_SOURCE, /useReducedMotion/u);
});
