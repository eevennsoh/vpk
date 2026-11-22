const assert = require("node:assert/strict");
const path = require("node:path");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const test = require("node:test");
const esbuild = require("esbuild");

async function loadToolOutputHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToString } from "react-dom/server";
				import { Tool, ToolHeader, ToolInput, ToolOutput } from "./components/ui/tool.tsx";
				import { Reasoning, ReasoningTrigger } from "./components/ui/reasoning.tsx";

				export function renderToolHeader(props) {
					return renderToString(React.createElement(Tool, null, React.createElement(ToolHeader, props)));
				}

				export function renderReasoningTrigger(props, triggerProps = {}) {
					return renderToString(React.createElement(Reasoning, props, React.createElement(ReasoningTrigger, triggerProps)));
				}

				export function renderToolInput(props) {
					return renderToString(React.createElement(ToolInput, props));
				}

				export function renderToolOutput(props) {
					return renderToString(React.createElement(ToolOutput, props));
				}
			`,
			loader: "tsx",
			resolveDir: process.cwd(),
			sourcefile: "tool-output-harness.tsx",
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

test("ToolInput renders compact parameter code blocks when requested", async () => {
	const harness = await loadToolOutputHarness();
	const markup = harness.renderToolInput({
		codeBlockSize: "sm",
		input: {
			sessionId: "agents-rfp-demo-rfp-101-qualification",
		},
	});

	assert.match(markup, /data-language="json"/);
	assert.match(markup, /data-size="sm"/);
});

test("ToolOutput renders compact result code blocks when requested", async () => {
	const harness = await loadToolOutputHarness();
	const markup = harness.renderToolOutput({
		codeBlockSize: "sm",
		output: {
			ok: true,
		},
		errorText: undefined,
	});

	assert.match(markup, /data-language="json"/);
	assert.match(markup, /data-size="sm"/);
});

test("ToolOutput renders exact raw structured output for successful tool results", async () => {
	const harness = await loadToolOutputHarness();
	const markup = harness.renderToolOutput({
		output: {
			manager: {
				name: "David Hoang",
			},
		},
		outputPreview: "Success",
		outputTruncated: true,
		outputBytes: 2048,
		errorText: undefined,
	});

	assert.match(markup, /David Hoang/);
	assert.doesNotMatch(markup, />Success</);
	assert.doesNotMatch(markup, /Result preview truncated for display/);
});

test("ToolHeader phrases the line from the tool state", async () => {
	const harness = await loadToolOutputHarness();
	const base = { type: "dynamic-tool", toolName: "runCommand", title: "pnpm test" };

	const running = harness.renderToolHeader({ ...base, state: "input-available" });
	assert.match(running, /data-status="running"/);
	assert.match(running, />Running pnpm test</);

	const done = harness.renderToolHeader({ ...base, state: "output-available" });
	assert.doesNotMatch(done, / data-status="/);
	assert.match(done, />Ran pnpm test</);

	const failed = harness.renderToolHeader({ ...base, state: "output-error" });
	assert.match(failed, /data-status="error"/);
	assert.match(failed, />Failed to run pnpm test</);

	const labelled = harness.renderToolHeader({ ...base, state: "output-available", label: "Searched Confluence" });
	assert.match(labelled, />Searched Confluence</);
});

test("ToolOutput shows the error text in a destructive code block", async () => {
	const harness = await loadToolOutputHarness();
	const markup = harness.renderToolOutput({ output: undefined, errorText: "command not found: pnpm" });

	assert.match(markup, /data-variant="destructive"/);
	assert.match(markup, /command not found: pnpm/);
});

test("ReasoningTrigger shimmers while streaming and reads the duration once done", async () => {
	const harness = await loadToolOutputHarness();
	const streaming = harness.renderReasoningTrigger({ isStreaming: true });
	assert.match(streaming, /data-status="running"/);
	assert.match(streaming, />Thinking</);

	const done = harness.renderReasoningTrigger({ duration: 12 });
	assert.doesNotMatch(done, /data-status="running"/);
	assert.match(done, />Thought for 12s</);

	const lineOnly = harness.renderReasoningTrigger({ isStreaming: true }, { showChevron: false });
	assert.doesNotMatch(lineOnly, /data-slot="trace-collapsible-trigger"/);
});
