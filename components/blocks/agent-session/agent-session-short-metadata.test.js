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
		assert.match(markup, /aria-label="Pull request #1893 Log refund decisions"/u);
		assert.match(markup, /data-last-update=""/u);
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

	const viewerMarkup = renderToStaticMarkup(createElement(AgentSessionShortMetadata, {
		item: { ...item, role: "viewer" },
	}));
	assert.equal(viewerMarkup.replace(/<[^>]*>/gu, ""), "Claude·7m·");
	assert.match(viewerMarkup, /aria-label="Private session"[^>]*data-access-mark="private" role="img"/u);
	assert.doesNotMatch(viewerMarkup, /<button/u);
	assert.doesNotMatch(viewerMarkup, /data-access-mark="team"|Team session/u);
});

test("metadata placement shows the session state in a long row", async () => {
	const result = await esbuild.build({
		entryPoints: [join(__dirname, "agent-session-metadata.tsx")],
		bundle: true,
		format: "cjs",
		platform: "node",
		write: false,
		external: ["react", "react-dom", "react/jsx-runtime", "motion/react"],
		loader: { ".css": "empty" },
	});
	const { AgentSessionLongMetadata } = loadCjsModuleFromText(result.outputFiles[0].text);
	for (const [state, label] of [["running", "Working"], ["needs-input", "Needs input"], ["complete", "Complete"]]) {
		const item = { id: state, title: "Session", state, agent: { id: "claude", kind: "agent", name: "Claude" }, timeLabel: "7m" };
		const markup = renderToStaticMarkup(createElement(AgentSessionLongMetadata, { item, lifecycleLabelPlacement: "metadata" }));
		assert.match(markup, new RegExp(`title="${label}"`, "u"));
		assert.ok(markup.replace(/<[^>]*>/gu, "").includes(label));
		assert.doesNotMatch(markup, /title="Claude"/u);
		const defaultMarkup = renderToStaticMarkup(createElement(AgentSessionLongMetadata, { item }));
		assert.match(defaultMarkup, /title="Claude"/u);
	}
});
