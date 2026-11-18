const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const FLYOUT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/context-bar/context-bar-prompt-flyout.tsx"),
	"utf8",
);
const ARC_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/context-bar/context-bar-prompt-flyout-arc.tsx"),
	"utf8",
);
const MODEL_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/context-bar/context-bar-prompt-flyout-model.ts"),
	"utf8",
);
const INDEX_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/context-bar/index.ts"),
	"utf8",
);
const DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/website/demos/ui-custom/context-bar-demo.tsx"),
	"utf8",
);
const DETAILS_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app/data/details/ui-custom/context-bar.ts"),
	"utf8",
);
const REGISTRY_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/website/registry/ui-custom/variants-media.ts"),
	"utf8",
);
const COMPOSER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/blocks/jira-kanban/experimental/pulse/components/pulse-insights-composer.tsx"),
	"utf8",
);

test("ContextBarPromptFlyout is exported and catalogued", () => {
	assert.match(INDEX_SOURCE, /ContextBarPromptFlyout/u);
	assert.match(DEMO_SOURCE, /export function ContextBarDemoPromptFlyout/u);
	assert.match(DETAILS_SOURCE, /demoSlug: "context-bar-demo-prompt-flyout"/u);
	assert.match(REGISTRY_SOURCE, /"context-bar-demo-prompt-flyout"/u);
	assert.match(DETAILS_SOURCE, /ContextBarPromptFlyout/u);
	assert.match(DETAILS_SOURCE, /same context-bar pills/u);
	assert.match(DETAILS_SOURCE, /items \(ContextBarPromptFlyout\)/u);
	assert.match(DETAILS_SOURCE, /distinct from ContextBarTagGroup `items`/u);
	assert.doesNotMatch(DETAILS_SOURCE, /name: "prompts"/u);
	assert.doesNotMatch(DETAILS_SOURCE, /fanned circular controls/u);
});

test("ContextBarPromptFlyout stacks extras straight up, left-aligned, with reduced-motion fallback", () => {
	assert.match(FLYOUT_SOURCE, /useReducedMotion\(\)/u);
	assert.match(FLYOUT_SOURCE, /absolute bottom-full left-0 z-20 flex w-max flex-col-reverse items-start gap-2 pb-2/u);
	assert.match(FLYOUT_SOURCE, /ContextBarPromptFlyoutStackItem/u);
	assert.match(ARC_SOURCE, /EXTRA_SLIDE_Y = 8/u);
	assert.match(ARC_SOURCE, /STAGGER_INTERVAL = 0\.05/u);
	assert.match(ARC_SOURCE, /const slideY = reduceMotion \? 0 : EXTRA_SLIDE_Y/u);
	assert.match(ARC_SOURCE, /const ITEM_ENTER: Transition = \{ duration: 0\.15, ease: motionEase\.outPractical \};/u);
	assert.match(ARC_SOURCE, /const ITEM_EXIT: Transition = \{ duration: 0\.1, ease: motionEase\.in \};/u);
	assert.match(ARC_SOURCE, /REDUCED_MOTION: Transition = \{ duration: 0, delay: 0 \}/u);
	assert.match(ARC_SOURCE, /const enterTransition = reduceMotion\n\t\t\? REDUCED_MOTION\n\t\t: \{ \.\.\.ITEM_ENTER, delay: enterDelay \}/u);
	assert.match(ARC_SOURCE, /const exitTransition = reduceMotion \? REDUCED_MOTION : ITEM_EXIT/u);
	assert.match(ARC_SOURCE, /initial=\{\{ opacity: 0, y: slideY \}\}/u);
	assert.match(ARC_SOURCE, /y: 0/u);
	assert.match(ARC_SOURCE, /willChange: reduceMotion \? "opacity" : "opacity, transform"/u);
	assert.match(ARC_SOURCE, /rounded-xl bg-surface/u);
	assert.match(FLYOUT_SOURCE, /icon=\{primary\.icon \?\? icon\}/u);
	assert.match(FLYOUT_SOURCE, /inert=\{!isOpen\}/u);
	assert.match(FLYOUT_SOURCE, /aria-hidden=\{!isOpen\}/u);
	assert.match(FLYOUT_SOURCE, /aria-expanded=\{canExpand \? isOpen : undefined\}/u);
	assert.doesNotMatch(FLYOUT_SOURCE, /canExpand &&/u);
	assert.doesNotMatch(FLYOUT_SOURCE, /right-0/u);
	assert.doesNotMatch(FLYOUT_SOURCE, /left-5/u);
	assert.doesNotMatch(FLYOUT_SOURCE, /left-1\/2/u);
	assert.doesNotMatch(ARC_SOURCE, /offsetPath/u);
	assert.doesNotMatch(ARC_SOURCE, /offsetDistance/u);
	assert.doesNotMatch(ARC_SOURCE, /offsetRotate/u);
	assert.doesNotMatch(ARC_SOURCE, /offsetAnchor/u);
	assert.doesNotMatch(ARC_SOURCE, /transformOrigin/u);
	assert.doesNotMatch(ARC_SOURCE, /ARC_PATH/u);
	assert.doesNotMatch(FLYOUT_SOURCE, /offsetPath/u);
	assert.doesNotMatch(FLYOUT_SOURCE, /offsetDistance/u);
	assert.doesNotMatch(ARC_SOURCE, /stiffness: 400/u);
	assert.doesNotMatch(ARC_SOURCE, /ACTION_SCALE_INITIAL/u);
	assert.doesNotMatch(ARC_SOURCE, /TRAVEL_BLUR_PX/u);
	assert.doesNotMatch(ARC_SOURCE, /scale:/u);
	assert.doesNotMatch(ARC_SOURCE, /rotate\(/u);
	assert.doesNotMatch(ARC_SOURCE, /bg-bg-neutral\//u);
	assert.doesNotMatch(FLYOUT_SOURCE, /bg-bg-neutral\//u);
	assert.doesNotMatch(ARC_SOURCE, /ContextBarPromptFlyoutArcPrompt/u);
	assert.doesNotMatch(ARC_SOURCE, /data-context-bar-prompt-flyout-label/u);
	assert.doesNotMatch(FLYOUT_SOURCE, /ContextBarPromptFlyoutArcPrompt/u);
	assert.doesNotMatch(ARC_SOURCE, /duration-\d|ease-\[/u);
});

test("ContextBarPromptFlyout docks the longest label, not caller array order", () => {
	assert.match(FLYOUT_SOURCE, /sortFlyoutItemsByLabelLength\(items\)/u);
	assert.match(MODEL_SOURCE, /right\.item\.label\.length - left\.item\.label\.length/u);
	assert.match(MODEL_SOURCE, /left\.index - right\.index/u);
	assert.doesNotMatch(FLYOUT_SOURCE, /const \[primary, \.\.\.rest\] = items;/u);
});

test("ContextBarPromptFlyout keeps hover alive across gaps in the stack", () => {
	assert.match(ARC_SOURCE, /data-context-bar-prompt-flyout-hover-pad/u);
	assert.match(FLYOUT_SOURCE, /onPointerEnter=\{handlePointerEnter\}/u);
	assert.match(FLYOUT_SOURCE, /event\.pointerType === "touch"/u);
	assert.match(FLYOUT_SOURCE, /onMouseLeave=\{scheduleClose\}/u);
	assert.match(MODEL_SOURCE, /HOVER_LEAVE_MS = 150/u);
	assert.match(FLYOUT_SOURCE, /ContextBarPromptFlyoutHoverPad/u);
	assert.match(FLYOUT_SOURCE, /\{isOpen \? <ContextBarPromptFlyoutHoverPad \/> : null\}/u);
	assert.match(FLYOUT_SOURCE, /cancelScheduledClose\(\);\n\t\tif \(canExpand\) setOpen\(true\)/u);
	assert.match(FLYOUT_SOURCE, /next instanceof Node && !event\.currentTarget\.contains\(next\)/u);
	assert.match(FLYOUT_SOURCE, /isOpen \? "pointer-events-auto" : "pointer-events-none \[&_\*\]:pointer-events-none"/u);
	assert.doesNotMatch(FLYOUT_SOURCE, /relatedTarget instanceof Node\) \|\|/u);
});

test("Pulse suggested questions reuse the context-bar prompt flyout", () => {
	assert.match(COMPOSER_SOURCE, /ContextBarPromptFlyout/u);
	assert.match(COMPOSER_SOURCE, /ariaLabel="Suggested questions"/u);
	assert.match(COMPOSER_SOURCE, /LightbulbIcon/u);
	assert.doesNotMatch(COMPOSER_SOURCE, /from "@\/components\/ui-custom\/suggestion"/u);
	assert.doesNotMatch(COMPOSER_SOURCE, /overflow-hidden has-\[:focus-visible\]:overflow-visible/u);
});

async function loadFlyoutHarness() {
	const mockModules = new Map([
		[
			"motion/react",
			`
				import React from "react";
				const MOTION_PROPS = new Set([
					"layout", "initial", "animate", "exit", "transition",
					"whileHover", "whileTap", "whileFocus", "variants", "drag",
					"onUpdate",
				]);
				const handler = {
					get(_target, tag) {
						return function MotionComponent(props) {
							const clean = {};
							for (const key in props) {
								if (key !== "children" && !MOTION_PROPS.has(key)) {
									clean[key] = props[key];
								}
							}
							return React.createElement(typeof tag === "string" ? tag : "div", clean, props.children);
						};
					},
				};
				export const motion = new Proxy({}, handler);
				export function AnimatePresence(props) {
					return React.createElement(React.Fragment, null, props.children);
				}
				export function MotionConfig(props) {
					return React.createElement(React.Fragment, null, props.children);
				}
				export function useReducedMotion() {
					return false;
				}
				export function useIsPresent() {
					return true;
				}
			`,
		],
		[
			"@/components/ui/tag",
			`
				import React from "react";
				export function Tag(props) {
					return React.createElement("span", null, props.children);
				}
			`,
		],
		[
			"@/components/ui/icon",
			`
				import React from "react";
				export function Icon(props) {
					return React.createElement("span", { "data-slot": "icon" }, props.render);
				}
			`,
		],
		[
			"@/components/ui/icon-tile",
			`
				import React from "react";
				export function IconTile(props) {
					return React.createElement("span", { "data-slot": "icon-tile" }, props.icon);
				}
			`,
		],
		[
			"@atlaskit/icon/core/cross",
			`
				import React from "react";
				export default function CrossIcon() {
					return React.createElement("svg", { "data-icon": "cross" });
				}
			`,
		],
		[
			"@atlaskit/icon/core/show-more-horizontal",
			`
				import React from "react";
				export default function ShowMoreHorizontalIcon() {
					return React.createElement("svg", { "data-icon": "show-more-horizontal" });
				}
			`,
		],
		[
			"@/components/ui/dropdown-menu",
			`
				import React from "react";
				export function DropdownMenu(props) {
					return React.createElement(React.Fragment, null, props.children);
				}
				export function DropdownMenuTrigger(props) {
					return React.createElement("button", { ...props }, props.children);
				}
				export function DropdownMenuContent(props) {
					return React.createElement("div", { ...props }, props.children);
				}
				export function DropdownMenuGroup(props) {
					return React.createElement("div", { ...props }, props.children);
				}
				export function DropdownMenuItem(props) {
					return React.createElement("div", { ...props }, props.children);
				}
			`,
		],
	]);

	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToStaticMarkup } from "react-dom/server";
				import { ContextBarPromptFlyout } from "./components/ui-custom/context-bar/context-bar-prompt-flyout.tsx";
				import { sortFlyoutItemsByLabelLength } from "./components/ui-custom/context-bar/context-bar-prompt-flyout-model.ts";

				const ITEMS = [
					{ id: "date", label: "Is this epic going to hit its target date?", onSelect: () => {} },
					{ id: "behind", label: "Which stream is furthest behind?", onSelect: () => {} },
					{ id: "left", label: "What is left before the adapter can be deleted?", onSelect: () => {} },
				];

				export { sortFlyoutItemsByLabelLength };

				export function renderFlyout(defaultOpen = false, items = ITEMS) {
					return renderToStaticMarkup(
						React.createElement(ContextBarPromptFlyout, {
							defaultOpen,
							icon: React.createElement("svg", { "data-icon": "lightbulb" }),
							items,
						}),
					);
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "context-bar-prompt-flyout-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "context-bar-prompt-flyout-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (!mockModules.has(args.path)) {
							return undefined;
						}
						return { path: args.path, namespace: "context-bar-prompt-flyout-test-mock" };
					});
					build.onLoad({ filter: /.*/, namespace: "context-bar-prompt-flyout-test-mock" }, (args) => ({
						contents: mockModules.get(args.path),
						loader: "tsx",
						resolveDir: process.cwd(),
					}));
				},
			},
		],
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("ContextBarPromptFlyout docks the longest prompt and keeps extras closed", async () => {
	const harness = await loadFlyoutHarness();
	const markup = harness.renderFlyout(false);

	assert.match(markup, /data-context-bar-prompt-flyout/u);
	assert.match(markup, /aria-label="Suggested questions"/u);
	assert.match(markup, /role="group"/u);
	assert.match(markup, /What is left before the adapter can be deleted\?/u);
	assert.match(markup, /aria-expanded="false"/u);
	assert.doesNotMatch(markup, /Is this epic going to hit its target date\?/u);
	assert.doesNotMatch(markup, /Which stream is furthest behind\?/u);
	assert.doesNotMatch(markup, /data-context-bar-prompt-flyout-item/u);
	assert.doesNotMatch(markup, /data-context-bar-prompt-flyout-hover-pad/u);
});

test("ContextBarPromptFlyout stacks extra prompts left-aligned when open", async () => {
	const harness = await loadFlyoutHarness();
	const markup = harness.renderFlyout(true);
	const longest = markup.indexOf("What is left before the adapter can be deleted?");
	const middle = markup.indexOf("Is this epic going to hit its target date?");
	const shortest = markup.indexOf("Which stream is furthest behind?");

	assert.match(markup, /aria-expanded="true"/u);
	assert.match(markup, /Which stream is furthest behind\?/u);
	assert.match(markup, /What is left before the adapter can be deleted\?/u);
	assert.match(markup, /data-context-bar-prompt-flyout-item/u);
	assert.match(markup, /data-context-bar-prompt-flyout-hover-pad/u);
	assert.match(markup, /bottom-full left-0/u);
	assert.match(markup, /flex-col-reverse items-start/u);
	assert.doesNotMatch(markup, /rotate\(/u);
	assert.doesNotMatch(markup, /offset-path/u);
	assert.doesNotMatch(markup, /offsetPath/u);
	assert.doesNotMatch(markup, /data-context-bar-prompt-flyout-label/u);
	assert.doesNotMatch(markup, /bg-bg-neutral-bold/u);
	assert.equal((markup.match(/data-context-bar-pill/g) ?? []).length, 3);
	assert.ok(longest >= 0 && middle > longest && shortest > middle);
});

test("ContextBarPromptFlyout ignores caller item order when docking", async () => {
	const harness = await loadFlyoutHarness();
	const markup = harness.renderFlyout(true, [
		{ id: "behind", label: "Which stream is furthest behind?", onSelect: () => {} },
		{ id: "left", label: "What is left before the adapter can be deleted?", onSelect: () => {} },
		{ id: "date", label: "Is this epic going to hit its target date?", onSelect: () => {} },
	]);
	const longest = markup.indexOf("What is left before the adapter can be deleted?");
	const middle = markup.indexOf("Is this epic going to hit its target date?");
	const shortest = markup.indexOf("Which stream is furthest behind?");

	assert.ok(longest >= 0 && middle > longest && shortest > middle);
});

test("sortFlyoutItemsByLabelLength keeps original order when lengths tie", async () => {
	const harness = await loadFlyoutHarness();
	const sorted = harness.sortFlyoutItemsByLabelLength([
		{ id: "a", label: "aa", onSelect: () => {} },
		{ id: "b", label: "bb", onSelect: () => {} },
		{ id: "c", label: "ccc", onSelect: () => {} },
	]);

	assert.deepEqual(sorted.map((item) => item.id), ["c", "a", "b"]);
});

test("ContextBarPromptFlyout with a single prompt is just the pill", async () => {
	const harness = await loadFlyoutHarness();
	const markup = harness.renderFlyout(true, [
		{ id: "only", label: "Will this sprint land?", onSelect: () => {} },
	]);

	assert.match(markup, /Will this sprint land\?/u);
	assert.doesNotMatch(markup, /aria-expanded/u);
	assert.doesNotMatch(markup, /data-context-bar-prompt-flyout-item/u);
});
