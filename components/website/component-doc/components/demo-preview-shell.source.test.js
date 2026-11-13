const assert = require("node:assert/strict");
const path = require("node:path");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const test = require("node:test");
const esbuild = require("esbuild");

async function loadDemoPreviewShellHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { token } from "./lib/tokens";
				import { DemoPreviewShell } from "./components/website/component-doc/components/demo-preview-shell.tsx";
				import { shouldUseFullPagePreview, resolveExamplesShellLayout, shouldBleedExamples, resolveBleedWrapperDividers, KEEP_SECTION_DIVIDER } from "./components/website/component-doc/components/preview-layout.ts";

				export function getShellStyles() {
					const defaultShell = DemoPreviewShell({
						children: React.createElement("div", null, "demo"),
					});
					const fullPageShell = DemoPreviewShell({
						children: React.createElement("div", null, "demo"),
						fullPage: true,
					});
					const fitFullPageShell = DemoPreviewShell({
						children: React.createElement("div", null, "demo"),
						fullPage: true,
						fitContent: true,
					});
					const fullWidthShell = DemoPreviewShell({
						children: React.createElement("div", null, "demo"),
						contentWidth: "full",
					});

					return {
						surface: token("elevation.surface", "#FFFFFF"),
						defaultStyle: defaultShell.props.style,
						defaultPadding: defaultShell.props.children.props.style.padding,
						fullPageStyle: fullPageShell.props.style,
						fitFullPageClassName: fitFullPageShell.props.className,
						fullWidthPadding: fullWidthShell.props.children.props.style.padding,
						fullWidthInnerStyle: fullWidthShell.props.children.props.children.props.style,
					};
				}

				export function getExamplesShellLayouts() {
					return {
						unset: resolveExamplesShellLayout("blocks", { previewHeight: "fit" }),
						full: resolveExamplesShellLayout("blocks", {
							previewHeight: "fit",
							examplesContentWidth: "full",
						}),
						bleedFit: resolveExamplesShellLayout("blocks", {
							previewHeight: "fit",
							examplesContentWidth: "bleed",
						}),
						bleedFixed: resolveExamplesShellLayout("blocks", {
							previewHeight: "fixed",
							examplesContentWidth: "bleed",
						}),
						bleedWithoutHeight: resolveExamplesShellLayout("blocks", {
							examplesContentWidth: "bleed",
						}),
						bleedUnsupportedCategory: resolveExamplesShellLayout("ui-custom", {
							previewHeight: "fit",
							examplesContentWidth: "bleed",
						}),
						bleedMirrorsPreviewWidth: resolveExamplesShellLayout("blocks", {
							previewHeight: "fit",
							previewContentWidth: "full",
							examplesContentWidth: "bleed",
						}),
					};
				}

				export function getExamplesBleedDecisions() {
					return {
						unset: shouldBleedExamples({ previewHeight: "fit" }),
						full: shouldBleedExamples({ examplesContentWidth: "full" }),
						bleed: shouldBleedExamples({ examplesContentWidth: "bleed" }),
						noLayout: shouldBleedExamples(undefined),
					};
				}

				export function getBleedWrapperDividers() {
					return {
						keepDivider: KEEP_SECTION_DIVIDER,
						allSections: resolveBleedWrapperDividers(true, true),
						withoutProps: resolveBleedWrapperDividers(true, false),
						withoutExamples: resolveBleedWrapperDividers(false, true),
						installationAndUsageOnly: resolveBleedWrapperDividers(false, false),
					};
				}

				export function getFullPagePreviewDecisions() {
					return {
						implicitBlock: shouldUseFullPagePreview("blocks", {
							previewContentWidth: "full",
							examplesContentWidth: "full",
						}),
						fixedBlock: shouldUseFullPagePreview("blocks", {
							previewHeight: "fixed",
						}),
						fitProject: shouldUseFullPagePreview("projects", {
							previewHeight: "fit",
						}),
						fixedUi: shouldUseFullPagePreview("ui-custom", {
							previewHeight: "fixed",
						}),
					};
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "demo-preview-shell-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("DemoPreviewShell keeps a raised surface background in embedded and full-page previews", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { surface, defaultStyle, fullPageStyle } = harness.getShellStyles();

	assert.equal(defaultStyle.backgroundColor, surface);
	assert.equal(fullPageStyle.backgroundColor, surface);
});

test("DemoPreviewShell uses a fallback-backed 1px border for preview outlines", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { defaultStyle, fullPageStyle } = harness.getShellStyles();

	assert.match(defaultStyle.border, /var\(--ds-border, rgba\(9, 30, 66, 0\.14\)\)/u);
	assert.equal(defaultStyle.boxShadow, undefined);
	assert.equal(fullPageStyle.border, defaultStyle.border);
	assert.equal(fullPageStyle.boxShadow, undefined);
});

test("DemoPreviewShell clips fit-height full-page content to its rounded frame", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { fitFullPageClassName } = harness.getShellStyles();

	assert.match(fitFullPageClassName, /(?:^|\s)overflow-hidden(?:\s|$)/u);
});

test("DemoPreviewShell insets full-width demos while preserving stretch layout", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { defaultPadding, fullWidthPadding, fullWidthInnerStyle } = harness.getShellStyles();

	assert.equal(fullWidthPadding, defaultPadding);
	assert.equal(fullWidthPadding, 24);
	assert.equal(fullWidthInnerStyle.alignItems, "stretch");
	assert.equal(fullWidthInnerStyle.justifyContent, "stretch");
});

test("DocPreview requires an explicit height mode before using the full-page shell", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const decisions = harness.getFullPagePreviewDecisions();

	assert.equal(decisions.implicitBlock, false);
	assert.equal(decisions.fixedBlock, true);
	assert.equal(decisions.fitProject, true);
	assert.equal(decisions.fixedUi, false);
});

test("Examples default to the inset shell so the ~400 existing demos are untouched", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { unset, full } = harness.getExamplesShellLayouts();

	// No examplesContentWidth: pass nothing through, exactly as before.
	assert.equal(unset.contentWidth, undefined);
	assert.equal(unset.fullPage, false);
	assert.equal(unset.fitContent, false);

	// "full" keeps the inset shell — it only stretches content inside it. The
	// padding contract asserted above depends on this staying non-full-page.
	assert.equal(full.contentWidth, "full");
	assert.equal(full.fullPage, false);
	assert.equal(full.fitContent, false);
});

test("Examples opt into the preview's edge-to-edge frame with examplesContentWidth bleed", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { bleedFit, bleedFixed } = harness.getExamplesShellLayouts();

	// Same shell arguments DocPreview computes, so both sections render at one width.
	assert.equal(bleedFit.fullPage, true);
	assert.equal(bleedFit.fitContent, true);
	// Mirrors previewContentWidth, which is unset here — same as the preview.
	assert.equal(bleedFit.contentWidth, undefined);

	// "fixed" height previews are full-page but not fit-content.
	assert.equal(bleedFixed.fullPage, true);
	assert.equal(bleedFixed.fitContent, false);
});

test("Bleed never widens an example past its own preview", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { bleedWithoutHeight, bleedUnsupportedCategory } = harness.getExamplesShellLayouts();

	// Both cases are ones where the Preview section itself stays in the inset
	// shell, so the example must too — degrading to stretch, not edge-to-edge.
	for (const layout of [bleedWithoutHeight, bleedUnsupportedCategory]) {
		assert.equal(layout.fullPage, false);
		assert.equal(layout.fitContent, false);
	}
});

test("Bleeding examples inherit the preview's own content width", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { bleedMirrorsPreviewWidth } = harness.getExamplesShellLayouts();

	// The whole contract is "render exactly like the preview", so the example
	// must not invent a width the preview above it is not using.
	assert.equal(bleedMirrorsPreviewWidth.contentWidth, "full");
	assert.equal(bleedMirrorsPreviewWidth.fullPage, true);
});

test("Only bleed hoists Examples out of the 860px reading container", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { unset, full, bleed, noLayout } = harness.getExamplesBleedDecisions();

	// ComponentDoc renders Examples in the wide preview band only for bleed;
	// every other component keeps the reading measure it has today.
	assert.equal(bleed, true);
	assert.equal(unset, false);
	assert.equal(full, false);
	assert.equal(noLayout, false);
});

test("Bleed re-asserts the divider on every wrapper that is still followed by a section", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { keepDivider, allSections } = harness.getBleedWrapperDividers();

	// Splitting the sections across width wrappers makes Usage the :last-child
	// of the first wrapper and Examples the sole child of the second, so
	// DocSection's `last:border-b-0` would strip both dividers even though
	// later sections follow. Each non-final wrapper overrides it.
	assert.equal(allSections.installationAndUsage, keepDivider);
	assert.equal(allSections.examples, keepDivider);
	// The genuinely final section keeps the default: no trailing divider.
	assert.equal(allSections.props, undefined);

	// The override must outrank `last:border-b-0`, which needs the child
	// combinator — a bare `border-b` would tie on specificity and lose.
	assert.match(keepDivider, /^\[&>section:last-child\]:border-b$/u);
});

test("Bleed leaves the divider off once a wrapper really does hold the last section", async () => {
	const harness = await loadDemoPreviewShellHarness();
	const { keepDivider, withoutProps, withoutExamples, installationAndUsageOnly } =
		harness.getBleedWrapperDividers();

	// No API Reference: Examples is last overall, so it must not draw a divider.
	assert.equal(withoutProps.installationAndUsage, keepDivider);
	assert.equal(withoutProps.examples, undefined);

	// No Examples: the empty Examples wrapper is skipped, API Reference is last.
	assert.equal(withoutExamples.installationAndUsage, keepDivider);
	assert.equal(withoutExamples.examples, undefined);

	// Import + Usage alone: nothing follows, so nothing is overridden.
	assert.equal(installationAndUsageOnly.installationAndUsage, undefined);
	assert.equal(installationAndUsageOnly.examples, undefined);
	assert.equal(installationAndUsageOnly.props, undefined);
});
