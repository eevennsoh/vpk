const assert = require("node:assert/strict");
const path = require("node:path");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const test = require("node:test");
const esbuild = require("esbuild");

async function loadHtmlPreviewHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToString } from "react-dom/server";
				import { HtmlPreviewFrame, PreviewBodyRenderer } from "./components/projects/shared/components/preview-body-renderer.tsx";

				export function renderHtmlPreviewFrame() {
					return renderToString(
						React.createElement(HtmlPreviewFrame, {
							html: "<!doctype html><html><body><h1>Report</h1></body></html>",
							title: "Work item report",
						}),
					);
				}

				export function renderArtifactPaneHtmlPreview() {
					return renderToString(
						React.createElement(PreviewBodyRenderer, {
							body: {
								kind: "html",
								html: "<!doctype html><html><body><h1>Report</h1></body></html>",
							},
							surface: "artifact-pane",
							title: "Work item report",
						}),
					);
				}

				export function renderArtifactPaneVpkHtmlPreview() {
					return renderToString(
						React.createElement(PreviewBodyRenderer, {
							body: {
								kind: "html",
								html: '<!doctype html><html lang="en"><head><meta name="generator" content="vpk-html"></head><body><div class="page"><header class="masthead"><h1>Report</h1></header></div></body></html>',
							},
							surface: "artifact-pane",
							title: "Work item report",
						}),
					);
				}

				export function renderArtifactPaneCodePreview() {
					return renderToString(
						React.createElement(PreviewBodyRenderer, {
							body: {
								kind: "code",
								code: "console.log('hello');",
								language: "tsx",
							},
							surface: "artifact-pane",
							title: "Code artifact",
						}),
					);
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "preview-body-renderer-html-harness.tsx",
		},
		bundle: true,
		format: "cjs",
		loader: {
			".css": "empty",
		},
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("HtmlPreviewFrame renders generated HTML in a sandboxed srcDoc iframe", async () => {
	const harness = await loadHtmlPreviewHarness();
	const markup = harness.renderHtmlPreviewFrame();

	assert.match(markup, /<iframe/);
	assert.match(markup, /sandbox=""/);
	assert.match(markup, /srcDoc="&lt;!doctype html&gt;/);
	assert.match(markup, /title="Work item report"/);
});

test("artifact pane HTML preview fills the pane without an extra rounded container", async () => {
	const harness = await loadHtmlPreviewHarness();
	const markup = harness.renderArtifactPaneHtmlPreview();

	assert.match(markup, /class="flex h-full w-full flex-col overflow-hidden bg-surface min-h-0"/);
	assert.match(markup, /class="h-full w-full flex-1 border-0 bg-surface min-h-0"/);
	assert.doesNotMatch(markup, /rounded-md border border-border/);
});

test("artifact pane vpk-html preview removes the embedded document top gutter", async () => {
	const harness = await loadHtmlPreviewHarness();
	const markup = harness.renderArtifactPaneVpkHtmlPreview();

	assert.match(markup, /data-vpk-artifact-pane-preview=&quot;true&quot;/);
	assert.match(markup, /body &gt; \.page:first-child \{/);
	assert.match(markup, /margin-left: 0 !important;/);
	assert.match(markup, /margin-right: auto !important;/);
	assert.match(markup, /\.masthead:first-child \{/);
	assert.match(markup, /padding-top: 0 !important;/);
});

test("artifact pane code preview suppresses only the preview container ring", async () => {
	const harness = await loadHtmlPreviewHarness();
	const markup = harness.renderArtifactPaneCodePreview();

	assert.match(markup, /data-language="tsx"/);
	assert.match(markup, /data-slot="code-block"[^>]*class="[^"]*\bring-0\b/);
	assert.doesNotMatch(markup, /\bring-1\b/);
});
