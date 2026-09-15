const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { readFileSync } = require("node:fs");
const { createElement } = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadCjsModuleFromText } = require(
	path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"),
);

const ROOT = path.join(__dirname, "..", "..", "..");
const CARD_SOURCE = readFileSync(path.join(__dirname, "agent-session-card.tsx"), "utf8");
const cardModules = new Map();

function loadCard(reduceMotion = false) {
	if (!cardModules.has(reduceMotion)) {
		cardModules.set(reduceMotion, esbuild.build({
			entryPoints: [path.join(__dirname, "agent-session-card.tsx")],
			bundle: true,
			format: "cjs",
			platform: "node",
			write: false,
			external: ["react", "react-dom", "react/jsx-runtime", "motion/react"],
			loader: { ".css": "empty" },
			alias: { "@": ROOT },
			plugins: [{
				name: "card-reduced-motion",
				setup(build) {
					build.onResolve({ filter: /^motion\/react$/ }, ({ importer }) => (
						importer === path.join(__dirname, "agent-session-card.tsx")
							? { path: "card-motion", namespace: "card-motion" }
							: undefined
					));
					build.onLoad({ filter: /.*/, namespace: "card-motion" }, () => ({
						contents: `export { motion } from "motion/react"; export const useReducedMotion = () => ${reduceMotion};`,
						loader: "js",
					}));
				},
			}],
		}).then((result) => loadCjsModuleFromText(result.outputFiles[0].text)));
	}
	return cardModules.get(reduceMotion);
}

const CARD_ITEM = {
	id: "state-change-fixture",
	title: "Review the sandbox implementation",
	state: "running",
	agent: { id: "codex", kind: "agent", name: "Codex", brandName: "codex" },
	host: "local",
	invokedBy: { name: "Maya" },
	timeLabel: "Just now",
};

async function loadGlow() {
	const result = await esbuild.build({
		entryPoints: [path.join(__dirname, "agent-session-glow.ts")],
		bundle: true,
		format: "cjs",
		platform: "node",
		write: false,
		external: ["react", "react/jsx-runtime"],
		alias: { "@": ROOT },
	});
	return loadCjsModuleFromText(result.outputFiles[0].text);
}

test("only the large card paints accent layers", async () => {
	const { resolveAgentSessionGlow } = await loadGlow();

	for (const variant of ["medium-detached", "medium-attached", "small"]) {
		const glow = resolveAgentSessionGlow({ bloom: true, stroke: true, variant });
		assert.equal(glow.enabled, false, `${variant} paints nothing`);
		assert.equal(glow.bloom, false);
		assert.equal(glow.stroke, false);
		assert.deepEqual(glow.style, {}, "an off list contributes no tuning vars");
	}
});

test("the two layers stay independent", async () => {
	const { resolveAgentSessionGlow } = await loadGlow();

	// Stroke and wash are separate layers on the card; asking for one must not
	// turn on the other, and either alone still needs the list's tuning vars.
	const strokeOnly = resolveAgentSessionGlow({ bloom: false, stroke: true, variant: "large" });
	assert.deepEqual(
		{ bloom: strokeOnly.bloom, enabled: strokeOnly.enabled, stroke: strokeOnly.stroke },
		{ bloom: false, enabled: true, stroke: true },
	);

	const bloomOnly = resolveAgentSessionGlow({ bloom: true, stroke: false, variant: "large" });
	assert.deepEqual(
		{ bloom: bloomOnly.bloom, enabled: bloomOnly.enabled, stroke: bloomOnly.stroke },
		{ bloom: true, enabled: true, stroke: false },
	);

	assert.ok(Object.keys(strokeOnly.style).length > 0, "an on list carries tuning vars");
});

test("both layers off is the same as not asking", async () => {
	const { resolveAgentSessionGlow } = await loadGlow();
	const glow = resolveAgentSessionGlow({ bloom: false, stroke: false, variant: "large" });

	assert.equal(glow.enabled, false);
	assert.deepEqual(glow.style, {});
});

test("the row dials the bloom back from the tile-tuned default", async () => {
	const { AGENT_SESSION_GLOW_STYLE } = await loadGlow();
	const { CARD_GLOW_DEFAULTS } = await (async () => {
		const result = await esbuild.build({
			entryPoints: [path.join(ROOT, "components/visual/card-glow/card-glow-surface.ts")],
			bundle: true,
			format: "cjs",
			platform: "node",
			write: false,
			external: ["react", "react/jsx-runtime"],
			alias: { "@": ROOT },
		});
		return loadCjsModuleFromText(result.outputFiles[0].text);
	})();

	// A 60px row is well under the 144px tile the shared defaults were tuned on,
	// so the same blob washes the whole row.
	assert.ok(
		AGENT_SESSION_GLOW_STYLE["--card-glow-icon-opacity"] < CARD_GLOW_DEFAULTS.iconOpacity,
		"the row bloom must be lighter than the shared tile default",
	);
	// The gradient stays tight so the stroke reads as an arc; distance is carried
	// by the proximity var instead of by widening the spread.
	assert.ok(
		AGENT_SESSION_GLOW_STYLE["--card-glow-border-core"] < CARD_GLOW_DEFAULTS.borderCore,
		"the row core must stay tighter than the tile default",
	);
});

test("only an opted-in Working card shimmers and every state retains its authored title", async () => {
	const { AgentSessionCard } = await loadCard();
	for (const state of ["running", "needs-input", "complete"]) {
		for (const showWorkingSpinner of [false, true]) {
			const html = renderToStaticMarkup(createElement(AgentSessionCard, {
				item: { ...CARD_ITEM, state },
				showMoreMenu: false,
				showWorkingSpinner,
			}));
			assert.equal(/class="shimmer /u.test(html), state === "running" && showWorkingSpinner);
			assert.ok(html.includes(CARD_ITEM.title), `${state} retains the authored work title`);
		}
	}
});

test("first-place and reentering revisions paint shared accent layers without enabling pointer glow", async () => {
	const { AgentSessionCard } = await loadCard();
	for (const isArriving of [false, true]) {
		const html = renderToStaticMarkup(createElement(AgentSessionCard, {
			item: { ...CARD_ITEM, state: "needs-input" },
			isArriving,
			isStateChanged: true,
			showMoreMenu: false,
		}));
		assert.ok(html.includes("data-agent-session-status-glow"));
		assert.ok(html.includes("data-card-glow-border"));
		assert.ok(html.includes("data-card-glow-bloom"));
		assert.ok(html.includes("--card-glow-tile-accent:"));
		assert.ok(html.includes("isolate"), "the shared layers remain above the article background");
	}
	for (const props of [{ isStateChanged: false }, { isStateChanged: true, isDeparting: true }]) {
		const html = renderToStaticMarkup(createElement(AgentSessionCard, {
			item: CARD_ITEM,
			showMoreMenu: false,
			...props,
		}));
		assert.ok(!html.includes("data-agent-session-status-glow"), "settled and departing rows never start a glow");
	}
});

test("reduced motion removes the Working shimmer and the one-shot revision glow", async () => {
	const { AgentSessionCard } = await loadCard(true);
	const html = renderToStaticMarkup(createElement(AgentSessionCard, {
		item: CARD_ITEM,
		isArriving: true,
		isStateChanged: true,
		showMoreMenu: false,
		showWorkingSpinner: true,
	}));
	assert.ok(!/class="shimmer /u.test(html));
	assert.ok(!html.includes("data-agent-session-status-glow"));
	assert.ok(html.includes(CARD_ITEM.title));
});

test("the revision glow owns completion after the faster card and status transitions", () => {
	assert.match(CARD_SOURCE, /const shouldPlayStateChangeGlow = isStateChanged && !isDeparting && !shouldReduceMotion;/u);
	assert.match(CARD_SOURCE, /<AgentSessionStateChangeGlow item=\{item\} key=\{item\.state\} onComplete=\{onStateChangeComplete\} \/>/u);
	assert.match(CARD_SOURCE, /<motion\.span[\s\S]*?onAnimationComplete=\{onComplete\}[\s\S]*?<CardGlowLayers baseBorder=\{false\} \/>/u);
	const arrivalComplete = /const handleArrivalComplete = \(\) => \{[\s\S]*?\n\t\};/u.exec(CARD_SOURCE)?.[0] ?? "";
	assert.ok(arrivalComplete.length > 0);
	assert.doesNotMatch(arrivalComplete, /onStateChangeComplete/u);
	assert.doesNotMatch(CARD_SOURCE, /onTransitionComplete=\{[^\n]*onStateChangeComplete/u);
});
