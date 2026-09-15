const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

class FakeLocalStorage {
	constructor({ throwOnAccess = false } = {}) {
		this.entries = new Map();
		this.throwOnAccess = throwOnAccess;
	}

	getItem(key) {
		if (this.throwOnAccess) {
			throw new Error("storage disabled");
		}
		return this.entries.has(key) ? this.entries.get(key) : null;
	}

	setItem(key, value) {
		if (this.throwOnAccess) {
			throw new Error("storage disabled");
		}
		this.entries.set(key, String(value));
	}
}

async function loadDesignVariantsHarness(t, { localStorage } = {}) {
	const previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: localStorage ?? new FakeLocalStorage(),
		writable: true,
	});

	t.after(() => {
		if (previousLocalStorage) {
			Object.defineProperty(globalThis, "localStorage", previousLocalStorage);
			return;
		}
		delete globalThis.localStorage;
	});

	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					DESIGN_VARIANTS,
					DESIGN_VARIANTS_STORAGE_KEY,
					DESIGN_VARIANTS_STORAGE_SCHEMA_VERSION,
					getDefaultDesignVariants,
					getDesignVariants,
					hydrateDesignVariants,
					isDesignVariantId,
					readStoredDesignVariants,
					resetDesignVariantsForTests,
					setDesignVariant,
					subscribeToDesignVariants,
				} from "./components/utils/design-variants";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "design-variants-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	const harness = loadCjsModuleFromText(result.outputFiles[0].text, "design-variants-harness.cjs");
	t.after(() => {
		harness.resetDesignVariantsForTests();
	});
	return harness;
}


test("exposes all design variants with stable labels and defaults", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	assert.deepEqual(
		harness.DESIGN_VARIANTS.map((variant) => [variant.id, variant.label]),
		[
			["panel", "Panel"],
			["simple-views", "Simple views"],
			["simpleKanban", "Simple kanban"],
			["kanbanBackground", "Background color"],
			["advancedTimeline", "Advanced timeline"],
			["agentSessionColumnResizing", "Dragging"],
			["manualLink", "Manual link"],
			["sessionStroke", "Stroke tracing"],
			["sessionBloom", "Card glow"],
			["sessionProximity", "Proximity sensor"],
		],
	);
	assert.equal(harness.DESIGN_VARIANTS_STORAGE_KEY, "ui-design-variants");
	assert.equal(harness.DESIGN_VARIANTS_STORAGE_SCHEMA_VERSION, 2);
	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.equal(harness.isDesignVariantId("panel"), true);
	assert.equal(harness.isDesignVariantId("simple-views"), true);
	assert.equal(harness.isDesignVariantId("simpleKanban"), true);
	assert.equal(harness.isDesignVariantId("pane"), false);
	assert.equal(harness.isDesignVariantId(undefined), false);
});

test("exposes Advanced timeline off by default", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	assert.deepEqual(
		harness.DESIGN_VARIANTS.find((variant) => variant.id === "advancedTimeline"),
		{ id: "advancedTimeline", label: "Advanced timeline" },
	);
	assert.equal(harness.getDefaultDesignVariants().advancedTimeline, false);
	assert.equal(harness.isDesignVariantId("advancedTimeline"), true);
});

test("exposes Dragging off by default", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	assert.deepEqual(
		harness.DESIGN_VARIANTS.find((variant) => variant.id === "agentSessionColumnResizing"),
		{ id: "agentSessionColumnResizing", label: "Dragging" },
	);
	assert.equal(harness.getDefaultDesignVariants().agentSessionColumnResizing, false);
	assert.equal(harness.isDesignVariantId("agentSessionColumnResizing"), true);
});

test("exposes Manual link off by default", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	// `find`, not `at(-1)`: Manual link is no longer the last entry now that the
	// session-chrome layers follow it, and its position was never the contract.
	assert.deepEqual(
		harness.DESIGN_VARIANTS.find((variant) => variant.id === "manualLink"),
		{ id: "manualLink", label: "Manual link" },
	);
	assert.equal(harness.getDefaultDesignVariants().manualLink, false);
	assert.equal(harness.isDesignVariantId("manualLink"), true);
});

// Only card glow ships on; the other two layers remain independently available.
test("defaults to card glow alone and keeps session-chrome layers independent", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	assert.deepEqual(
		harness.DESIGN_VARIANTS.find((variant) => variant.id === "sessionStroke"),
		{ id: "sessionStroke", label: "Stroke tracing" },
	);
	assert.deepEqual(
		harness.DESIGN_VARIANTS.find((variant) => variant.id === "sessionBloom"),
		{ id: "sessionBloom", label: "Card glow" },
	);
	assert.deepEqual(
		harness.DESIGN_VARIANTS.find((variant) => variant.id === "sessionProximity"),
		{ id: "sessionProximity", label: "Proximity sensor" },
	);
	assert.equal(harness.getDefaultDesignVariants().sessionStroke, false);
	assert.equal(harness.getDefaultDesignVariants().sessionBloom, true);
	assert.equal(harness.getDefaultDesignVariants().sessionProximity, false);

	// Each must move alone. The stroke and the wash are separate layers on the
	// card, so turning one off may not take the other with it.
	harness.setDesignVariant("sessionBloom", false);
	assert.equal(harness.getDesignVariants().sessionStroke, false);
	assert.equal(harness.getDesignVariants().sessionBloom, false);
	assert.equal(harness.getDesignVariants().sessionProximity, false);

	harness.setDesignVariant("sessionStroke", true);
	assert.equal(harness.getDesignVariants().sessionStroke, true);
	assert.equal(harness.getDesignVariants().sessionBloom, false);
	assert.equal(harness.getDesignVariants().sessionProximity, false);
});

// A payload without session-chrome keys adopts the current defaults.
test("a pre-existing stored payload keeps the session-chrome defaults", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	globalThis.localStorage.setItem(
		harness.DESIGN_VARIANTS_STORAGE_KEY,
		JSON.stringify({ advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, "simple-views": true, simpleKanban: true, schemaVersion: 2 }),
	);

	const stored = harness.readStoredDesignVariants();
	assert.equal(stored.sessionStroke, false);
	assert.equal(stored.sessionBloom, true);
	assert.equal(stored.sessionProximity, false);
	assert.equal(stored.panel, true);
});

test("stored session-chrome choices override the defaults", async (t) => {
	const harness = await loadDesignVariantsHarness(t);
	globalThis.localStorage.setItem(
		harness.DESIGN_VARIANTS_STORAGE_KEY,
		JSON.stringify({ sessionStroke: true, sessionProximity: true, sessionBloom: false, schemaVersion: 2 }),
	);
	const stored = harness.readStoredDesignVariants();
	assert.equal(stored.sessionStroke, true);
	assert.equal(stored.sessionProximity, true);
	assert.equal(stored.sessionBloom, false);
});

test("snapshot getters keep a stable identity for useSyncExternalStore", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	// `useSyncExternalStore` calls both getters on every render and compares
	// with Object.is — a fresh object per call is an infinite render loop.
	assert.equal(harness.getDefaultDesignVariants(), harness.getDefaultDesignVariants());
	assert.equal(harness.getDesignVariants(), harness.getDesignVariants());
	assert.equal(harness.getDesignVariants(), harness.getDefaultDesignVariants());

	harness.setDesignVariant("panel", true);

	// Only a real change swaps the reference, and the new one is stable too.
	assert.notEqual(harness.getDesignVariants(), harness.getDefaultDesignVariants());
	assert.equal(harness.getDesignVariants(), harness.getDesignVariants());
	assert.deepEqual(harness.getDefaultDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
});

test("toggling a variant persists it and notifies subscribers exactly once", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	const seen = [];
	harness.subscribeToDesignVariants(() => {
		seen.push(harness.getDesignVariants());
	});

	harness.setDesignVariant("panel", true);

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.deepEqual(seen, [{ advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true }]);
	assert.deepEqual(
		JSON.parse(localStorage.getItem(harness.DESIGN_VARIANTS_STORAGE_KEY)),
		{ advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true, schemaVersion: 2 },
	);

	harness.setDesignVariant("panel", false);

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.equal(seen.length, 2);
	assert.deepEqual(
		JSON.parse(localStorage.getItem(harness.DESIGN_VARIANTS_STORAGE_KEY)),
		{ advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true, schemaVersion: 2 },
	);
});

test("no-op writes and no-op hydrations never notify subscribers", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	let notifications = 0;
	harness.subscribeToDesignVariants(() => {
		notifications += 1;
	});

	// Setting the already-active value is a no-op for subscribers, but still
	// (re)asserts the persisted payload.
	harness.setDesignVariant("panel", false);
	assert.equal(notifications, 0);
	assert.deepEqual(
		JSON.parse(localStorage.getItem(harness.DESIGN_VARIANTS_STORAGE_KEY)),
		{ advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true, schemaVersion: 2 },
	);

	harness.setDesignVariant("panel", true);
	assert.equal(notifications, 1);

	// Hydration compares by value, not identity — a freshly built but equal
	// object must not push a new snapshot to every subscriber.
	const before = harness.getDesignVariants();
	harness.hydrateDesignVariants({ advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.equal(notifications, 1);
	assert.equal(harness.getDesignVariants(), before);
});

test("hydration adopts a stored state without rewriting storage", async (t) => {
	const localStorage = new FakeLocalStorage();
	localStorage.setItem("ui-design-variants", JSON.stringify({ panel: true }));
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	localStorage.entries.clear();
	harness.hydrateDesignVariants({ advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.equal(localStorage.getItem("ui-design-variants"), null);
});

test("rejects malformed, non-object, and array stored payloads", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	// Missing key.
	assert.equal(harness.readStoredDesignVariants(), null);

	for (const raw of ["{panel:true}", "not json", '"panel"', "42", "null", "[1,2]", '["panel"]']) {
		localStorage.setItem("ui-design-variants", raw);
		assert.equal(harness.readStoredDesignVariants(), null, `expected null for ${raw}`);
	}
});

test("normalises unknown keys and non-boolean values in stored payloads", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	// Unknown keys are dropped; every known id is always present.
	localStorage.setItem("ui-design-variants", JSON.stringify({ retired: true, panel: true }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	// A payload from an older build that predates a variant still yields a
	// complete state object rather than one with a missing key, and absent
	// keys keep the store default.
	localStorage.setItem("ui-design-variants", JSON.stringify({ retired: true }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	// An explicit off must beat the on default, or turning Panel / Simple views
	// off could not survive a reload.
	localStorage.setItem("ui-design-variants", JSON.stringify({ panel: false }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	localStorage.setItem("ui-design-variants", JSON.stringify({ "simple-views": false }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": false, simpleKanban: true });

	// Schema 1 (or missing) Simple kanban values are incidental: toggling a
	// sibling persisted the whole map while the default was still off, so they
	// must not block the on-default rollout.
	localStorage.setItem("ui-design-variants", JSON.stringify({ simpleKanban: false }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	localStorage.setItem(
		"ui-design-variants",
		JSON.stringify({ panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: false }),
	);
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	// A current-schema explicit off must beat the on default, or turning Simple
	// kanban off could not survive a reload.
	localStorage.setItem(
		"ui-design-variants",
		JSON.stringify({ simpleKanban: false, schemaVersion: 2 }),
	);
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: false });

	// An explicit on must beat the off default, or turning Panel on could not
	// survive a reload.
	localStorage.setItem("ui-design-variants", JSON.stringify({ panel: true }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	// Truthy-but-not-`true` values coerce to off rather than leaking through.
	for (const value of ["true", 1, {}, [], null]) {
		localStorage.setItem("ui-design-variants", JSON.stringify({ panel: value }));
		assert.deepEqual(
			harness.readStoredDesignVariants(),
			{ advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true },
			`expected panel off for ${JSON.stringify(value)}`,
		);
	}
});

test("a throwing localStorage never breaks selection", async (t) => {
	const harness = await loadDesignVariantsHarness(t, {
		localStorage: new FakeLocalStorage({ throwOnAccess: true }),
	});

	assert.equal(harness.readStoredDesignVariants(), null);
	harness.setDesignVariant("panel", true);
	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: true, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
});

test("toggling Simple kanban preserves Panel and Simple views", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	harness.setDesignVariant("simpleKanban", false);

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: false });
	assert.deepEqual(
		JSON.parse(localStorage.getItem(harness.DESIGN_VARIANTS_STORAGE_KEY)),
		{ advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: false, schemaVersion: 2 },
	);

	harness.setDesignVariant("simpleKanban", true);

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, panel: false, sessionBloom: true, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
});
