const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const CONTEXT_BAR_DEMO_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/website/demos/ui-custom/context-bar-demo.tsx"),
	"utf8",
);
const CONTEXT_BAR_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/context-bar/context-bar.tsx"),
	"utf8",
);
const CONTEXT_BAR_PR_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/context-bar/context-bar-pull-request.tsx"),
	"utf8",
);
const CONTEXT_BAR_PR_CI_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/context-bar/context-bar-pull-request-ci.tsx"),
	"utf8",
);
const CONTEXT_BAR_CREATE_PR_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/context-bar/context-bar-create-pull-request.tsx"),
	"utf8",
);
const CONTEXT_BAR_INDEX_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/ui-custom/context-bar/index.ts"),
	"utf8",
);

test("all context-bar surfaces share the 40px minimum-height contract", () => {
	assert.match(CONTEXT_BAR_SOURCE, /const CONTEXT_BAR_HEIGHT_CLASS = "min-h-10";/u);
	assert.match(CONTEXT_BAR_SOURCE, /CONTEXT_BAR_PILL_CLASS = cn\([\s\S]*CONTEXT_BAR_HEIGHT_CLASS/u);
	assert.match(CONTEXT_BAR_SOURCE, /export function ContextBar\([\s\S]*CONTEXT_BAR_HEIGHT_CLASS[\s\S]*data-context-bar/u);
	assert.match(CONTEXT_BAR_SOURCE, /export function AnimatedCollapsibleContextBar\([\s\S]*CONTEXT_BAR_HEIGHT_CLASS[\s\S]*data-context-bar=/u);
	assert.match(CONTEXT_BAR_SOURCE, /export function ContextBarTagGroup\([\s\S]*CONTEXT_BAR_HEIGHT_CLASS[\s\S]*data-context-bar-tag-group/u);
	assert.match(CONTEXT_BAR_SOURCE, /const OVERFLOW_BUTTON_CLASS =\s*"[^"]*size-10/u);
});

test("ContextBarPill box model stays 40px with a 1px border", () => {
	assert.match(
		CONTEXT_BAR_SOURCE,
		/CONTEXT_BAR_PILL_CLASS = cn\(\s*"box-border flex h-10[\s\S]*border border-transparent[\s\S]*py-1\.5[\s\S]*leading-6/u,
	);
});

test("ContextBar exposes descendant focus indicators beyond its truncation lane", () => {
	assert.match(
		CONTEXT_BAR_SOURCE,
		/className="flex min-w-0 flex-1 items-center gap-1\.5 overflow-hidden has-\[:focus-visible\]:overflow-visible"/u,
	);
});

async function loadContextBarHarness() {
	const mockModules = new Map([
		[
			"@/components/ui/tag",
			`
				import React from "react";
				export function Tag(props) {
					return React.createElement(
						"span",
						{
							"data-slot": "tag",
							"data-color": props.color,
							"data-remove-label": props.removeButtonLabel,
							"data-remove-variant": props.removeVariant,
						},
						props.elemBefore,
						React.createElement("span", { "data-tag-text": true }, props.children),
						props.onRemove
							? React.createElement("button", { "aria-label": props.removeButtonLabel, onClick: props.onRemove }, "Remove")
							: null,
					);
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
					return React.createElement(
						props.as ?? "div",
						{
							"data-slot": "icon-tile",
							"data-size": props.size,
							"data-variant": props.variant,
						},
						props.icon,
					);
				}
			`,
		],
		[
			"@atlaskit/icon/core/cross",
			`
				import React from "react";
				export default function CrossIcon(props) {
					return React.createElement("svg", { "data-icon": "cross", "data-size": props.size });
				}
			`,
		],
		[
			"@atlaskit/icon/core/show-more-horizontal",
			`
				import React from "react";
				export default function ShowMoreHorizontalIcon(props) {
					return React.createElement("svg", { "data-icon": "show-more-horizontal", "data-size": props.size });
				}
			`,
		],
		[
			"motion/react",
			`
				import React from "react";
				const MOTION_PROPS = new Set([
					"layout", "initial", "animate", "exit", "transition",
					"whileHover", "whileTap", "whileFocus", "variants", "drag",
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
				import {
					CollapsibleContextBar,
					ContextBar,
					ContextBarLead,
					ContextBarPill,
					ContextBarTag,
					ContextBarTrigger,
				} from "./components/ui-custom/context-bar/context-bar.tsx";

				export function renderBar(dismissible, showDismissPlaceholder = true) {
					return renderToStaticMarkup(
						React.createElement(
							ContextBar,
							{
								onDismiss: dismissible ? () => {} : undefined,
								dismissLabel: "Close it",
								showDismissPlaceholder,
							},
							React.createElement(ContextBarLead, { icon: React.createElement("svg", { "data-icon": "lead" }) }, "Edit:"),
							React.createElement(ContextBarTag, { title: "Agent name" }, "Agent name"),
						),
					);
				}

				export function renderTrigger() {
					return renderToStaticMarkup(
						React.createElement(ContextBarTrigger, { onClick: () => {} }, "Edit agent"),
					);
				}

				export function renderNonInteractivePill() {
					return renderToStaticMarkup(
						React.createElement(
							ContextBarPill,
							{ interactive: false },
							"Move to:",
							React.createElement("button", { "aria-label": "Choose column" }, "Done"),
						),
					);
				}

				export function renderTagFrontSlot(type) {
					return renderToStaticMarkup(
						React.createElement(
							ContextBarTag,
							{
								elemBefore: React.createElement("svg", { "data-icon": "front" }),
								title: "Context",
								type,
							},
							"Context",
						),
					);
				}

				export function renderRemovableTag() {
					return renderToStaticMarkup(
						React.createElement(
							ContextBarTag,
							{
								onRemove: () => {},
								removeButtonLabel: "Dismiss file changes",
								removeVariant: "overlay",
							},
							"3 files changed",
						),
					);
				}

				export function renderCollapsible(defaultOpen) {
					return renderToStaticMarkup(
						React.createElement(
							CollapsibleContextBar,
							{
								defaultOpen,
								leadLabel: "Edit:",
								collapsedLabel: "Edit agent",
								dismissLabel: "Close it",
							},
							React.createElement(ContextBarTag, { title: "Agent name" }, "Agent name"),
						),
					);
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "context-bar-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "context-bar-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (!mockModules.has(args.path)) {
							return undefined;
						}
						return { path: args.path, namespace: "context-bar-test-mock" };
					});
					build.onLoad({ filter: /.*/, namespace: "context-bar-test-mock" }, (args) => ({
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

test("ContextBar renders an interactive dismiss when onDismiss is provided", async () => {
	const harness = await loadContextBarHarness();
	const markup = harness.renderBar(true);

	assert.match(markup, /data-context-bar/);
	assert.match(markup, /Edit:/);
	assert.match(markup, /aria-label="Close it"/);
	assert.match(markup, /<button/);
	assert.match(markup, /data-icon="cross"/);
});

test("ContextBar renders a non-interactive placeholder without onDismiss", async () => {
	const harness = await loadContextBarHarness();
	const markup = harness.renderBar(false);

	assert.match(markup, /data-icon="cross"/);
	assert.doesNotMatch(markup, /<button/);
});

test("ContextBar can omit the non-interactive dismiss placeholder", async () => {
	const harness = await loadContextBarHarness();
	const markup = harness.renderBar(false, false);

	assert.doesNotMatch(markup, /data-icon="cross"/);
	assert.doesNotMatch(markup, /<button/);
});

test("ContextBarTag reuses the Tag front-slot icon recipe", async () => {
	const harness = await loadContextBarHarness();
	const iconMarkup = harness.renderTagFrontSlot(undefined);
	const avatarMarkup = harness.renderTagFrontSlot("agent");

	assert.match(iconMarkup, /data-slot="icon-tile"/);
	assert.match(iconMarkup, /data-size="xxsmall"/);
	assert.match(iconMarkup, /data-variant="transparent"/);
	assert.match(iconMarkup, /data-slot="icon"/);
	assert.match(iconMarkup, /data-icon="front"/);
	assert.doesNotMatch(avatarMarkup, /data-slot="icon-tile"/);
	assert.match(avatarMarkup, /data-icon="front"/);
});

test("ContextBarTag forwards generic tag removal controls", async () => {
	const harness = await loadContextBarHarness();
	const markup = harness.renderRemovableTag();

	assert.match(markup, /data-remove-label="Dismiss file changes"/);
	assert.match(markup, /data-remove-variant="overlay"/);
	assert.match(markup, /aria-label="Dismiss file changes"/);
});

test("ContextBarTrigger renders a labelled pill button", async () => {
	const harness = await loadContextBarHarness();
	const markup = harness.renderTrigger();

	assert.match(markup, /data-context-bar-trigger/);
	assert.match(markup, /<button/);
	assert.match(markup, /Edit agent/);
});

test("ContextBarPill can render a non-interactive surface around an inner control", async () => {
	const harness = await loadContextBarHarness();
	const markup = harness.renderNonInteractivePill();

	assert.match(markup, /^<div[^>]*data-context-bar-pill/u);
	assert.match(markup, /<button aria-label="Choose column">Done<\/button>/u);
	assert.equal((markup.match(/<button/g) ?? []).length, 1);
});

test("ContextBar multi-pill demo renders numeric deltas in regular monospace", () => {
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /className="inline-flex items-center gap-0\.5"/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /className="font-mono font-normal text-green-500">\+6/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /className="font-mono font-normal text-red-500">-3/u);
	assert.doesNotMatch(CONTEXT_BAR_DEMO_SOURCE, /font-semibold text-(?:green|red)-500/u);
});

test("CollapsibleContextBar starts expanded and can collapse to a trigger", async () => {
	const harness = await loadContextBarHarness();

	const open = harness.renderCollapsible(true);
	assert.match(open, /data-context-bar/);
	assert.match(open, /Edit:/);
	assert.match(open, /aria-label="Close it"/);
	assert.doesNotMatch(open, /data-context-bar-trigger/);

	const collapsed = harness.renderCollapsible(false);
	assert.match(collapsed, /data-context-bar-trigger/);
	assert.match(collapsed, /Edit agent/);
	assert.doesNotMatch(collapsed, /aria-label="Close it"/);
});

async function loadOverflowModule() {
	const result = await esbuild.build({
		entryPoints: [path.join(process.cwd(), "components/ui-custom/context-bar/overflow.ts")],
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("computeContextBarOverflow shows everything when it all fits", async () => {
	const { computeContextBarOverflow } = await loadOverflowModule();

	// 3 items of 50px + 2 gaps of 8px = 166px, fits in 400px.
	assert.equal(computeContextBarOverflow([50, 50, 50], 400, 32, 8), 3);
});

test("computeContextBarOverflow reserves room for the overflow button", async () => {
	const { computeContextBarOverflow } = await loadOverflowModule();

	// Items: 100,100,100,100 with gap 8 → full row 424px > 250px container, so an
	// overflow button (32px) is required. Item 1: 100 + gap(8) + overflow(32) = 140 ≤ 250.
	// Item 2: used 208 + gap(8) + overflow(32) = 248 ≤ 250. Item 3 would be 356 > 250.
	assert.equal(computeContextBarOverflow([100, 100, 100, 100], 250, 32, 8), 2);
});

test("computeContextBarOverflow returns all items before measurement", async () => {
	const { computeContextBarOverflow } = await loadOverflowModule();

	assert.equal(computeContextBarOverflow([100, 100, 100], 0, 32, 8), 3);
	assert.equal(computeContextBarOverflow([], 400, 32, 8), 0);
});

test("computeContextBarOverflow always reserves the overflow button when asked", async () => {
	const { computeContextBarOverflow } = await loadOverflowModule();

	// All 3 items (50px + gaps) fit in 200px on their own, but with an always-on
	// overflow button the fast path must be skipped so its width is reserved once.
	// Item 1: 50 + gap(8) + overflow(32) = 90 ≤ 200. Item 2: 108 + 8 + 32 = 148 ≤ 200.
	// Item 3: 166 + 8 + 32 = 206 > 200 → only 2 fit beside the button.
	assert.equal(computeContextBarOverflow([50, 50, 50], 200, 32, 8, true), 2);

	// Regression for double-reserving: a single item that fits beside the button
	// must not collapse to 0 just because the trigger is always present.
	// 100 + gap(8) + overflow(32) = 140 ≤ 150 → the one item stays visible.
	assert.equal(computeContextBarOverflow([100], 150, 32, 8, true), 1);
});

async function loadContextBarPullRequestHarness() {
	const mockModules = new Map([
		[
			"@/components/ui/tag",
			`
				import React from "react";
				export function Tag(props) {
					return React.createElement("span", { "data-slot": "tag" }, props.children);
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
					return React.createElement("div", { "data-slot": "icon-tile" }, props.icon);
				}
			`,
		],
		[
			"@atlaskit/icon/core/cross",
			`
				import React from "react";
				export default function CrossIcon(props) {
					return React.createElement("svg", { "data-icon": "cross", "data-size": props.size });
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
			"@atlaskit/icon/core/pull-request",
			`
				import React from "react";
				export default function PullRequestIcon() {
					return React.createElement("svg", { "data-icon": "pull-request" });
				}
			`,
		],
		[
			"motion/react",
			`
				import React from "react";
				export const motion = new Proxy({}, { get: () => (props) => React.createElement("div", props, props.children) });
				export function AnimatePresence(props) { return React.createElement(React.Fragment, null, props.children); }
				export function MotionConfig(props) { return React.createElement(React.Fragment, null, props.children); }
				export function useReducedMotion() { return false; }
			`,
		],
		[
			"@/components/ui/dropdown-menu",
			`
				import React from "react";
				export function DropdownMenu(props) { return React.createElement(React.Fragment, null, props.children); }
				export function DropdownMenuTrigger({ render, children, ...props }) {
					const trigger = render ?? React.createElement("button");
					return React.cloneElement(trigger, props, trigger.props.children ?? children);
				}
				export function DropdownMenuContent({ positionerClassName, ...props }) { return React.createElement("div", props, props.children); }
				export function DropdownMenuGroup(props) { return React.createElement("div", props, props.children); }
				export function DropdownMenuItem({ children, elemBefore, elemAfter, selected, onSelect, closeOnClick, ...props }) {
					return React.createElement("div", { role: "menuitem", "data-selected": selected, onClick: onSelect, ...props }, elemBefore, children, elemAfter);
				}
				export function DropdownMenuLabel(props) { return React.createElement("div", props, props.children); }
				export function DropdownMenuSeparator() { return React.createElement("hr"); }
				export function DropdownMenuCheckboxItem({ checked, onCheckedChange, ...props }) {
					return React.createElement("div", { ...props, role: "menuitemcheckbox", "aria-checked": checked }, props.children);
				}
			`,
		],
		[
			"@/components/ui/switch",
			`
				import React from "react";
				export function Switch({ checked, onCheckedChange, size, ...props }) {
					return React.createElement("button", {
						...props,
						role: "switch",
						"aria-checked": checked,
						"data-size": size,
						"data-slot": "switch",
						onClick: () => onCheckedChange?.(!checked),
					});
				}
			`,
		],
		[
			"@/components/ui-custom/hover-reveal-row",
			`
				import React from "react";
				export const hoverRevealRowClassName = "group/hover-reveal-row relative";
				export function HoverRevealLabel(props) {
					return React.createElement("span", { "data-hover-reveal-label": true }, props.children);
				}
				export function HoverRevealActions(props) {
					return React.createElement("div", { "data-hover-reveal-actions": true, "data-toggle-parked": props.toggleParked }, props.toggle, props.action);
				}
			`,
		],
		[
			"@/components/blocks/pull-request/components/pull-request-checks-list",
			`
				import React from "react";
				export function ChecksSectionTitle({ passed = 0, total = 0 }) {
					return React.createElement(
						"span",
						{ "data-ci-checks-title": true },
						"CI checks",
						total > 0
							? React.createElement("span", { className: "shrink-0 text-xs font-normal text-text-subtlest" }, passed + "/" + total)
							: null,
					);
				}
				export function PullRequestChecksList({ checks }) {
					return React.createElement(
						"ul",
						{ "data-jira-work-item-pull-request-checks": true },
						(checks ?? []).map((check) => React.createElement("li", { key: check.id, "data-ci-check": check.id }, check.name, " ", check.details)),
					);
				}
			`,
		],
		[
			"@/components/blocks/pull-request/lib/pull-request-checks-title",
			`
				export function pullRequestChecksTitleState(checks) {
					return {
						inProgress: true,
						passed: (checks ?? []).filter((check) => check.status === "passed").length,
						total: checks.length,
					};
				}
			`,
		],
		[
			"@/components/ui/spinner",
			`
				import React from "react";
				export function Spinner({ label, size, ...props }) {
					return React.createElement("svg", { ...props, "aria-label": label, "data-size": size, "data-slot": "spinner" });
				}
			`,
		],
		[
			"@atlaskit/icon/core/chevron-down",
			`
				import React from "react";
				export default function ChevronDownIcon() {
					return React.createElement("svg", { "data-icon": "chevron-down" });
				}
			`,
		],
		[
			"@/components/ui/lozenge",
			`
				import React from "react";
				export function Lozenge({ children, elemBefore, variant, ...props }) {
					return React.createElement("span", { ...props, "data-slot": "lozenge", "data-variant": variant }, elemBefore, children);
				}
			`,
		],
		[
			"@/lib/tokens",
			`
				export function token(name) { return name === "elevation.shadow.overlay" ? "overlay-elevation-shadow" : name; }
			`,
		],
		[
			"@/components/ui/hover-card",
			`
				import React from "react";
				export function HoverCard(props) { return React.createElement("div", { "data-hover-card": true }, props.children); }
				export function HoverCardTrigger({ render, children, delay, closeDelay, ...props }) {
					const trigger = render ?? React.createElement("span");
					return React.cloneElement(trigger, props, trigger.props.children ?? children);
				}
				export function HoverCardContent({ align, positionerClassName, side, sideOffset, ...props }) {
					return React.createElement("div", { "data-hover-card-content": true, ...props });
				}
			`,
		],
		[
			"@/components/blocks/pull-request",
			`
				import React from "react";
				export function PullRequest({ variant, number, title, status, className }) {
					return React.createElement("div", { className, "data-pull-request": number, "data-status": status, "data-variant": variant }, "#" + number + " " + title);
				}
			`,
		],
		[
			"@/components/ui/button",
			`
				import React from "react";
				export function Button({ children, size, variant, ...props }) {
					return React.createElement("button", { "data-size": size, "data-variant": variant, type: "button", ...props }, children);
				}
			`,
		],
		[
			"@/components/ui/button-group",
			`
				import React from "react";
				export function ButtonGroup({ children, variant, ...props }) {
					return React.createElement("div", { role: "group", "data-variant": variant, ...props }, children);
				}
			`,
		],
		[
			"@atlaskit/icon/core/shortcut",
			`
				import React from "react";
				export default function ShortcutIcon() {
					return React.createElement("svg", { "data-icon": "shortcut" });
				}
			`,
		],
	]);
	for (const [modulePath, iconName] of [
		["@atlaskit/icon/core/check-circle", "check-circle"],
		["@atlaskit/icon/core/status-error", "status-error"],
		["@atlaskit/icon/core/task-to-do", "task-to-do"],
	]) {
		mockModules.set(modulePath, `import React from "react"; export default function Icon() { return React.createElement("svg", { "data-icon": "${iconName}" }); }`);
	}

	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToStaticMarkup } from "react-dom/server";
				import { ContextBarCreatePullRequest } from "./components/ui-custom/context-bar/context-bar-create-pull-request.tsx";
				import { ContextBarPullRequest } from "./components/ui-custom/context-bar/context-bar-pull-request.tsx";

				export function renderCreatePullRequestBar(overrides = {}) {
					return renderToStaticMarkup(
						React.createElement(ContextBarCreatePullRequest, {
							additions: 86,
							branch: "feature/guest-checkout",
							deletions: 21,
							onCreate: () => {},
							onCreateDraft: () => {},
							onDismiss: () => {},
							repository: "acme/app",
							...overrides,
						}),
					);
				}

				export function renderPullRequestBar(overrides = {}) {
					return renderToStaticMarkup(
						React.createElement(ContextBarPullRequest, {
							additions: 86,
							approvalsCurrent: 1,
							approvalsRequired: 2,
							author: { avatarUrl: "/avatar.png", name: "Ada" },
							branch: "feature/guest-checkout",
							ci: {
								autoFixEnabled: false,
								autoMergeEnabled: true,
								checks: [
									{ id: "lint-types", name: "Lint and typecheck", status: "running", details: "Running for 1m 42s" },
									{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
									{ id: "browser-tests", name: "Guest checkout browser tests", status: "queued", details: "Waiting for CI" },
								],
								onAutoFixChange: () => {},
								onAutoMergeChange: () => {},
								status: "running",
								summary: "3 CI checks",
							},
							deletions: 21,
							filesChanged: 12,
							href: "https://github.com/acme/app/pull/42",
							mergeState: "queued",
							number: 42,
							onDismiss: () => {},
							repository: "acme/app",
							status: "Open",
							targetBranch: "main",
							title: "Add guest checkout",
							...overrides,
						}),
					);
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "context-bar-pull-request-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "context-bar-pr-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) => {
						if (!mockModules.has(args.path)) {
							return undefined;
						}
						return { path: args.path, namespace: "context-bar-pr-test-mock" };
					});
					build.onLoad({ filter: /.*/, namespace: "context-bar-pr-test-mock" }, (args) => ({
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

test("ContextBarPullRequest is a generic PR variation of ContextBar", () => {
	assert.match(CONTEXT_BAR_PR_SOURCE, /export function ContextBarPullRequest\(/u);
	assert.match(CONTEXT_BAR_PR_SOURCE, /<ContextBar/u);
	assert.match(CONTEXT_BAR_PR_SOURCE, /"mb-2 w-full max-w-\[calc\(100vw-7rem\)\] gap-2 overflow-hidden px-2\.5 py-0 sm:max-w-full"/u);
	assert.match(CONTEXT_BAR_PR_SOURCE, /className="min-w-0 flex-1 truncate text-sm text-text-subtle" title=\{branch\}/u);
	assert.match(CONTEXT_BAR_PR_SOURCE, /variant="flyout"/u);
	assert.match(CONTEXT_BAR_PR_SOURCE, /token\("elevation.shadow.overlay"\)/u);
	assert.match(CONTEXT_BAR_PR_SOURCE, /className="w-auto overflow-hidden rounded-xl border-0 bg-surface-overlay p-0 text-text shadow-none"/u);
	assert.match(CONTEXT_BAR_PR_SOURCE, /hover:underline[\s\S]*data-pr-number-link/u);
	assert.doesNotMatch(CONTEXT_BAR_PR_SOURCE, /SHOP-4821|1847|jira-golden-journey/u);
	assert.doesNotMatch(
		CONTEXT_BAR_PR_SOURCE.slice(
			CONTEXT_BAR_PR_SOURCE.indexOf("function PullRequestNumberLink"),
			CONTEXT_BAR_PR_SOURCE.indexOf("export function ContextBarPullRequest"),
		),
		/hover:text-/u,
	);

	assert.match(CONTEXT_BAR_DEMO_SOURCE, /export function ContextBarDemoPullRequest/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /DEMO_PULL_REQUESTS\[0\]/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /ci=\{\{/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /\{ id: "open-failed", ciStatus: "failed", checks: FAILED_CI_CHECKS, status: "Open"/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /\{ id: "open-passed", ciStatus: "passed", checks: PASSED_CI_CHECKS, status: "Open"/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /\{ id: "merged-passed", ciStatus: "passed", checks: PASSED_CI_CHECKS, status: "Merged"/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /function ContextBarDemoPullRequestPermutation[\s\S]*useState\(false\)[\s\S]*useState\(true\)/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /showRepository=\{false\}[\s\S]*showStatusLozenge/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /data-pr-permutations/u);
	assert.doesNotMatch(CONTEXT_BAR_DEMO_SOURCE, /SHOP-4821|#1847/u);

	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /data-ci-automation-trigger/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /Auto-fix CI & address comments/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /Auto-merge when ready/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /PullRequestChecksList/u);
	assert.doesNotMatch(CONTEXT_BAR_PR_CI_SOURCE, /jira-work-item\/experimental-v3/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /density="menu"/u);
	assert.match(
		fs.readFileSync(
			path.join(process.cwd(), "components/blocks/pull-request/components/pull-request-checks-list.tsx"),
			"utf8",
		),
		/function CheckRow[\s\S]*rich-text-command-menu-item[\s\S]*menu-row-title[\s\S]*menu-row-byline/u,
	);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /ChecksSectionTitle/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /pullRequestChecksTitleState/u);
	assert.match(
		CONTEXT_BAR_PR_CI_SOURCE,
		/<ChecksSectionTitle passed=\{checksTitle\.passed\} total=\{checksTitle\.total\} \/>/u,
	);
	assert.doesNotMatch(CONTEXT_BAR_PR_CI_SOURCE, /showStatus=/u);
	assert.doesNotMatch(CONTEXT_BAR_PR_CI_SOURCE, /HoverReveal|hoverRevealRowClassName/u);
	assert.doesNotMatch(CONTEXT_BAR_PR_CI_SOURCE, /text-text-disabled/u);
	assert.doesNotMatch(CONTEXT_BAR_PR_CI_SOURCE, /selected=\{checked\}/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /elemAfter=\{\(/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /onSelect=\{\(\) => \{\s*onCheckedChange\(!checked\);\s*\}\}/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /checked=\{checked\}[\s\S]*onCheckedChange=\{onCheckedChange\}/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /focus-visible:ring-3[\s\S]*motion-reduce:transition-none/u);
	assert.doesNotMatch(CONTEXT_BAR_PR_CI_SOURCE, /SHOP-4821|1847|jira-golden-journey/u);
	assert.match(CONTEXT_BAR_PR_SOURCE, /ci === undefined \? null : \(/u);
	assert.match(CONTEXT_BAR_PR_SOURCE, /<ContextBarPullRequestAutomation/u);
});

test("ContextBarPullRequest renders a hoverable PR number and flyout overlay card", async () => {
	const harness = await loadContextBarPullRequestHarness();
	const markup = harness.renderPullRequestBar();

	assert.match(markup, /data-pr-context-bar/u);
	assert.match(markup, /data-pr-number="42"/u);
	assert.match(markup, /aria-label="Pull request #42\. Open\. CI running\. 1 of 2 approvals\. Auto-merge queued"/u);
	assert.match(markup, /rounded-xl/u);
	assert.match(markup, /bg-bg-neutral/u);
	assert.match(
		markup,
		/<a class="shrink-0 text-sm no-underline decoration-current outline-none hover:underline[^"]* text-text-success" data-pr-number-link="true" href="https:\/\/github.com\/acme\/app\/pull\/42">#42<\/a>/u,
	);
	assert.doesNotMatch(markup, /<a class="[^"]*hover:text-[^"]*" data-pr-number-link/u);
	assert.match(markup, /data-slot="lozenge" data-variant="success"[^>]*>.*Open<\/span>/u);
	assert.match(markup, /feature\//u);
	assert.match(markup, /guest-checkout/u);
	assert.match(markup, /\+86/u);
	assert.match(markup, /−21/u);
	assert.match(markup, />CI</u);
	assert.match(markup, /data-pull-request="42" data-status="Open" data-variant="flyout"/u);
	assert.match(markup, /#42 Add guest checkout/u);
	assert.match(
		markup,
		/data-hover-card-content="true" class="w-auto overflow-hidden rounded-xl border-0 bg-surface-overlay p-0 text-text shadow-none" style="box-shadow:overlay-elevation-shadow"/u,
	);
	assert.match(markup, /class="border-0 bg-transparent shadow-none" data-pull-request="42"/u);
	assert.match(markup, /aria-label="Dismiss pull request context"/u);
});

test("ContextBarPullRequest can hide the status lozenge and show the repository", async () => {
	const harness = await loadContextBarPullRequestHarness();
	const markup = harness.renderPullRequestBar({
		branch: "hotfix/tax",
		number: 9,
		href: "https://github.com/acme/app/pull/9",
		showRepository: true,
		showStatusLozenge: false,
		status: "Merged",
		title: "Fix tax rounding",
	});

	assert.doesNotMatch(markup, /data-slot="lozenge"/u);
	assert.match(markup, /data-icon="pull-request"/u);
	assert.match(markup, /acme\/app/u);
	assert.match(markup, /hotfix\/tax/u);
	assert.match(markup, /font-medium text-text-discovery/u);
	assert.match(markup, /data-pull-request="9" data-status="Merged" data-variant="flyout"/u);
});

test("ContextBarPullRequest owns the CI checks menu", async () => {
	const harness = await loadContextBarPullRequestHarness();
	const markup = harness.renderPullRequestBar();

	assert.match(markup, /data-ci-status="running"/u);
	assert.match(markup, /aria-label="CI running\. 3 CI checks\. Configure CI automation"/u);
	assert.match(markup, /aria-label="CI running" data-size="xs" data-slot="spinner"/u);
	assert.match(markup, />CI checks</u);
	assert.match(markup, />1\/3</u);
	assert.match(markup, /data-jira-work-item-pull-request-checks/u);
	assert.match(markup, /Lint and typecheck/u);
	assert.match(markup, /Running for 1m 42s/u);
	assert.match(markup, /Unit tests/u);
	assert.match(markup, /Guest checkout browser tests/u);
	assert.match(markup, /data-auto-fix-setting="true"/u);
	assert.match(markup, /data-auto-merge-setting="true"/u);
	assert.doesNotMatch(markup, /data-auto-fix-setting="true"[^>]*data-selected="true"|data-selected="true"[^>]*data-auto-fix-setting="true"/u);
	assert.doesNotMatch(markup, /data-auto-merge-setting="true"[^>]*data-selected="true"|data-selected="true"[^>]*data-auto-merge-setting="true"/u);
	assert.match(markup, /role="switch"[^>]*aria-label="Enable Auto-fix CI &amp; address comments"[^>]*aria-checked="false"|aria-label="Enable Auto-fix CI &amp; address comments"[^>]*role="switch"[^>]*aria-checked="false"/u);
	assert.match(markup, /Auto-fix CI &amp; address comments/u);
	assert.match(markup, /Auto-merge when ready/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /StatusErrorIcon/u);
	assert.match(CONTEXT_BAR_PR_CI_SOURCE, /CheckCircleIcon/u);
	assert.doesNotMatch(markup, /data-approvals-summary/u);
	assert.doesNotMatch(markup, /data-merge-state-label/u);

	const reviewMarkup = harness.renderPullRequestBar({
		ci: {
			autoFixEnabled: true,
			autoMergeEnabled: false,
			checks: [
				{ id: "lint-types", name: "Lint and typecheck", status: "failed", details: "Failed after 42s · deliveryAddress may be null" },
				{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests in 2m 46s" },
			],
			status: "failed",
			summary: "1 failed, 1 passed",
		},
		mergeState: "blocked",
	});
	assert.match(reviewMarkup, /data-ci-status="failed"/u);
	assert.match(reviewMarkup, /data-approvals-summary/u);
	assert.match(reviewMarkup, />1\/2 approved</u);
	assert.match(reviewMarkup, />Auto-merge blocked</u);
	assert.match(reviewMarkup, /text-text-success/u);
	assert.match(reviewMarkup, /aria-label="CI failed\. 1 failed, 1 passed\. View CI checks"/u);
	assert.doesNotMatch(reviewMarkup, /Auto-fix CI|Auto-merge when ready/u);
});

test("ContextBarCreatePullRequest is the pre-PR variation of ContextBar", () => {
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /export function ContextBarCreatePullRequest\(/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /<ContextBar/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /max-w-\[calc\(100vw-7rem\)\][\s\S]*overflow-hidden px-2\.5 py-0 sm:max-w-full/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /data-create-pr-context-bar/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /variant="split"/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /"Create PR"/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /Create draft PR/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /Manually create PR/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /selected=\{mode === "open"\}/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /selected=\{mode === "draft"\}/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /selected=\{mode === "manual"\}/u);
	assert.match(CONTEXT_BAR_CREATE_PR_SOURCE, /onSelect=\{\(\) => onModeChange\("manual"\)\}/u);
	assert.doesNotMatch(CONTEXT_BAR_CREATE_PR_SOURCE, /window\.open|compareHref/u);
	assert.doesNotMatch(CONTEXT_BAR_CREATE_PR_SOURCE, /data-pr-number|data-ci-status/u);
	assert.match(CONTEXT_BAR_INDEX_SOURCE, /ContextBarCreatePullRequest/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /export function ContextBarDemoCreatePullRequest/u);
	assert.match(CONTEXT_BAR_DEMO_SOURCE, /<ContextBarCreatePullRequest/u);
	assert.doesNotMatch(CONTEXT_BAR_CREATE_PR_SOURCE, /SHOP-4821|1847|jira-golden-journey/u);
});

test("ContextBarCreatePullRequest renders branch, diff stats, and a Create PR split button", async () => {
	const harness = await loadContextBarPullRequestHarness();
	const markup = harness.renderCreatePullRequestBar();

	assert.match(markup, /data-create-pr-context-bar/u);
	assert.match(markup, /data-create-pr-mode="open"/u);
	assert.match(markup, /aria-label="Unpublished branch feature\/guest-checkout\. 86 additions and 21 deletions\. Create PR ready"/u);
	assert.match(markup, /title="acme\/app feature\/guest-checkout"/u);
	assert.match(markup, />app</u);
	assert.match(markup, /feature\/guest-checkout/u);
	assert.match(markup, /\+86/u);
	assert.match(markup, /−21/u);
	assert.match(markup, /role="group"[^>]*aria-label="Create pull request"/u);
	assert.match(markup, />Create PR</u);
	assert.match(markup, />Create draft PR</u);
	assert.match(markup, />Manually create PR</u);
	assert.match(markup, /data-selected="true"/u);
	assert.match(markup, /data-icon="shortcut"/u);
	assert.match(markup, /aria-label="More pull request actions"/u);
	assert.equal((markup.match(/disabled=""/gu) ?? []).length, 1);
	assert.doesNotMatch(markup, /data-pr-number/u);
	assert.doesNotMatch(markup, /data-ci-status/u);
	assert.doesNotMatch(markup, /data-slot="lozenge"/u);
});

test("ContextBarCreatePullRequest disables actions without callbacks", async () => {
	const harness = await loadContextBarPullRequestHarness();
	const markup = harness.renderCreatePullRequestBar({
		onCreate: undefined,
		onCreateDraft: undefined,
		onCreateManually: undefined,
	});

	assert.equal((markup.match(/disabled=""/gu) ?? []).length, 4);
	assert.match(markup, /Create PR unavailable/u);
});
