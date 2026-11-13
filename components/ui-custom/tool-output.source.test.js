const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));
const test = require("node:test");
const esbuild = require("esbuild");

const THINKING_TOOLS_SOURCE = readFileSync(
	path.join(process.cwd(), "components/projects/shared/components/assistant-thinking-tools-section.tsx"),
	"utf8",
);
const THINKING_TRACE_SOURCE = readFileSync(
	path.join(process.cwd(), "components/projects/shared/components/assistant-thinking-trace.tsx"),
	"utf8",
);

async function loadToolOutputHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				import React from "react";
				import { renderToString } from "react-dom/server";
				import { ToolInput, ToolOutput } from "./components/ui-custom/tool.tsx";

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

test("thinking tool code blocks use compact CodeBlock sizing", () => {
	assert.match(THINKING_TOOLS_SOURCE, /<ToolInput codeBlockSize="sm" input=\{toolCall\.input\} \/>/);
	assert.match(THINKING_TOOLS_SOURCE, /<ToolOutput\s+codeBlockSize="sm"/);
	assert.match(THINKING_TRACE_SOURCE, /<ToolInput codeBlockSize="sm" input=\{toolCall\.input\} \/>/);
	assert.match(THINKING_TRACE_SOURCE, /<ToolOutput\s+codeBlockSize="sm"/);
});

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
