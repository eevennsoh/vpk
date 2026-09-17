const assert = require("node:assert/strict");
const { join } = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadCjsModuleFromText } = require("../../../scripts/lib/esbuild-cjs-loader.js");

test("short metadata starts with the PR when created and keeps the agent before creation", async () => {
	const result = await esbuild.build({
		entryPoints: [join(__dirname, "agent-session-metadata.tsx")],
		bundle: true,
		format: "cjs",
		platform: "node",
		write: false,
		external: ["react", "react-dom", "react/jsx-runtime", "motion/react"],
		loader: { ".css": "empty" },
	});
	const { AgentSessionShortMetadata } = loadCjsModuleFromText(result.outputFiles[0].text);
	const item = {
		id: "pr-metadata-fixture",
		title: "Refund audit metadata",
		state: "complete",
		agent: { id: "claude", kind: "agent", name: "Claude" },
		timeLabel: "7m",
	};

	for (const prStatus of ["created", "merged", "failed"]) {
		const markup = renderToStaticMarkup(createElement(AgentSessionShortMetadata, {
			item: {
				...item,
				prStatus,
				sessionDetails: { pullRequestNumber: 1893, pullRequestTitle: "Log refund decisions" },
			},
		}));
		assert.equal(markup.replace(/<[^>]*>/gu, ""), "#1893 Log refund decisions·7m");
		assert.doesNotMatch(markup, /Claude/u);
		assert.match(markup, /title="#1893 Log refund decisions"/u);
		assert.match(markup, /title="Last update"/u);
	}

	const numberOnlyMarkup = renderToStaticMarkup(createElement(AgentSessionShortMetadata, {
		item: { ...item, sessionDetails: { pullRequestNumber: 1893 } },
	}));
	assert.equal(numberOnlyMarkup.replace(/<[^>]*>/gu, ""), "#1893·7m");

	for (const sessionDetails of [undefined, { pullRequestTitle: "Draft PR" }]) {
		const markup = renderToStaticMarkup(createElement(AgentSessionShortMetadata, {
			item: { ...item, sessionDetails },
		}));
		assert.equal(markup.replace(/<[^>]*>/gu, ""), "Claude·7m");
		assert.match(markup, /title="Claude"/u);
	}
});
