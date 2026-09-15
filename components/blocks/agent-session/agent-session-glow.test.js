const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(
	path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"),
);

const ROOT = path.join(__dirname, "..", "..", "..");

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
