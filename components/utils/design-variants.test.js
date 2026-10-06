const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

class FakeLocalStorage {
	constructor({ throwOnAccess = false } = {}) {
		this.entries = new Map();
		this.throwOnAccess = throwOnAccess;
		this.writes = 0;
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
		this.writes += 1;
		this.entries.set(key, String(value));
	}
}

// A test may load several harnesses (one per simulated document load); only the
// first captures the real global, because `t.after` hooks run in FIFO order.
const testsRestoringLocalStorage = new WeakSet();

async function loadDesignVariantsHarness(t, { localStorage } = {}) {
	if (!testsRestoringLocalStorage.has(t)) {
		testsRestoringLocalStorage.add(t);
		const previousLocalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
		t.after(() => {
			if (previousLocalStorage) {
				Object.defineProperty(globalThis, "localStorage", previousLocalStorage);
				return;
			}
			delete globalThis.localStorage;
		});
	}

	Object.defineProperty(globalThis, "localStorage", {
		configurable: true,
		value: localStorage ?? new FakeLocalStorage(),
		writable: true,
	});

	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					applyDesignVariantOverrides,
					DESIGN_VARIANTS,
					DESIGN_VARIANTS_QUERY_PARAM,
					DESIGN_VARIANTS_STORAGE_KEY,
					DESIGN_VARIANTS_STORAGE_SCHEMA_VERSION,
					getDefaultDesignVariants,
					getDesignVariants,
					hydrateClientDesignVariants,
					hydrateDesignVariants,
					isDesignVariantId,
					parseDesignVariantOverrides,
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
			["autoArrange", "Auto arrange"],
			["sessionStroke", "Stroke tracing"],
			["sessionBloom", "Card glow"],
			["sessionProximity", "Proximity sensor"],
			["sessionPeel", "Peel visual"],
			["moveVisual", "Move visual"],
			["pauseMegaBento", "Pause mega-bento"],
		],
	);
	assert.equal(harness.DESIGN_VARIANTS_STORAGE_KEY, "ui-design-variants");
	assert.equal(harness.DESIGN_VARIANTS_STORAGE_SCHEMA_VERSION, 3);
	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.equal(harness.isDesignVariantId("panel"), true);
	assert.equal(harness.isDesignVariantId("simple-views"), true);
	assert.equal(harness.isDesignVariantId("simpleKanban"), true);
	assert.equal(harness.isDesignVariantId("pane"), false);
	assert.equal(harness.isDesignVariantId(undefined), false);
});

test("Peel visual migrates the old on default to off and persists a new opt-in", async (t) => {
	const harness = await loadDesignVariantsHarness(t);
	for (const schemaVersion of [undefined, 1, 2]) {
		globalThis.localStorage.setItem("ui-design-variants", JSON.stringify({ sessionPeel: true, sessionBloom: false, schemaVersion }));
		assert.equal(harness.readStoredDesignVariants().sessionPeel, false);
		assert.equal(harness.readStoredDesignVariants().sessionBloom, false);
	}
	harness.setDesignVariant("sessionPeel", true);
	assert.equal(harness.readStoredDesignVariants().sessionPeel, true);
	harness.setDesignVariant("sessionPeel", false);
	assert.equal(harness.readStoredDesignVariants().sessionPeel, false);
});

test("Auto arrange starts off for old preferences and persists each explicit choice", async (t) => {
	const harness = await loadDesignVariantsHarness(t);
	assert.equal(harness.getDefaultDesignVariants().autoArrange, false);
	globalThis.localStorage.setItem("ui-design-variants", JSON.stringify({ moveVisual: true, schemaVersion: 2 }));
	assert.equal(harness.readStoredDesignVariants().autoArrange, false);
	harness.setDesignVariant("autoArrange", true);
	assert.equal(harness.readStoredDesignVariants().autoArrange, true);
	assert.equal(harness.readStoredDesignVariants().sessionPeel, false);
	harness.setDesignVariant("autoArrange", false);
	assert.equal(harness.readStoredDesignVariants().autoArrange, false);
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

test("exposes Dragging on by default and preserves stored choices", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	assert.deepEqual(
		harness.DESIGN_VARIANTS.find((variant) => variant.id === "agentSessionColumnResizing"),
		{ id: "agentSessionColumnResizing", label: "Dragging" },
	);
	assert.equal(harness.getDefaultDesignVariants().agentSessionColumnResizing, true);
	assert.equal(harness.isDesignVariantId("agentSessionColumnResizing"), true);
	globalThis.localStorage.setItem(harness.DESIGN_VARIANTS_STORAGE_KEY, JSON.stringify({ panel: true }));
	assert.equal(harness.readStoredDesignVariants().agentSessionColumnResizing, true);

	for (const enabled of [false, true]) {
		harness.setDesignVariant("agentSessionColumnResizing", enabled);
		const stored = harness.readStoredDesignVariants();
		assert.equal(stored.agentSessionColumnResizing, enabled);
		harness.hydrateDesignVariants(stored);
		assert.equal(harness.getDesignVariants().agentSessionColumnResizing, enabled);
	}

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
		JSON.stringify({ advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: false, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, "simple-views": true, simpleKanban: true, schemaVersion: 2 }),
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
	assert.deepEqual(harness.getDefaultDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
});

test("toggling a variant persists it and notifies subscribers exactly once", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	const seen = [];
	harness.subscribeToDesignVariants(() => {
		seen.push(harness.getDesignVariants());
	});

	harness.setDesignVariant("panel", true);

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.deepEqual(seen, [{ advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true }]);
	assert.deepEqual(
		JSON.parse(localStorage.getItem(harness.DESIGN_VARIANTS_STORAGE_KEY)),
		{ advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true, schemaVersion: 3 },
	);

	harness.setDesignVariant("panel", false);

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.equal(seen.length, 2);
	assert.deepEqual(
		JSON.parse(localStorage.getItem(harness.DESIGN_VARIANTS_STORAGE_KEY)),
		{ advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true, schemaVersion: 3 },
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
		{ advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true, schemaVersion: 3 },
	);

	harness.setDesignVariant("panel", true);
	assert.equal(notifications, 1);

	// Hydration compares by value, not identity — a freshly built but equal
	// object must not push a new snapshot to every subscriber.
	const before = harness.getDesignVariants();
	harness.hydrateDesignVariants({ advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.equal(notifications, 1);
	assert.equal(harness.getDesignVariants(), before);
});

test("hydration adopts a stored state without rewriting storage", async (t) => {
	const localStorage = new FakeLocalStorage();
	localStorage.setItem("ui-design-variants", JSON.stringify({ panel: true }));
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	localStorage.entries.clear();
	harness.hydrateDesignVariants({ advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
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
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	// A payload from an older build that predates a variant still yields a
	// complete state object rather than one with a missing key, and absent
	// keys keep the store default.
	localStorage.setItem("ui-design-variants", JSON.stringify({ retired: true }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	// An explicit off must beat the on default, or turning Panel / Simple views
	// off could not survive a reload.
	localStorage.setItem("ui-design-variants", JSON.stringify({ panel: false }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	localStorage.setItem("ui-design-variants", JSON.stringify({ "simple-views": false }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": false, simpleKanban: true });

	// Schema 1 (or missing) Simple kanban values are incidental: toggling a
	// sibling persisted the whole map while the default was still off, so they
	// must not block the on-default rollout.
	localStorage.setItem("ui-design-variants", JSON.stringify({ simpleKanban: false }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	localStorage.setItem(
		"ui-design-variants",
		JSON.stringify({ panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: false }),
	);
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	// A current-schema explicit off must beat the on default, or turning Simple
	// kanban off could not survive a reload.
	localStorage.setItem(
		"ui-design-variants",
		JSON.stringify({ simpleKanban: false, schemaVersion: 2 }),
	);
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: false });

	// An explicit on must beat the off default, or turning Panel on could not
	// survive a reload.
	localStorage.setItem("ui-design-variants", JSON.stringify({ panel: true }));
	assert.deepEqual(harness.readStoredDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });

	// Truthy-but-not-`true` values coerce to off rather than leaking through.
	for (const value of ["true", 1, {}, [], null]) {
		localStorage.setItem("ui-design-variants", JSON.stringify({ panel: value }));
		assert.deepEqual(
			harness.readStoredDesignVariants(),
			{ advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true },
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
	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
});

test("toggling Simple kanban preserves Panel and Simple views", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	harness.setDesignVariant("simpleKanban", false);

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: false });
	assert.deepEqual(
		JSON.parse(localStorage.getItem(harness.DESIGN_VARIANTS_STORAGE_KEY)),
		{ advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: false, schemaVersion: 3 },
	);

	harness.setDesignVariant("simpleKanban", true);

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, autoArrange: false, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: false, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
});


test("Pause mega-bento starts on for older preferences and persists explicit choices", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });
	assert.equal(harness.getDefaultDesignVariants().pauseMegaBento, true);
	localStorage.setItem("ui-design-variants", JSON.stringify({ moveVisual: false, schemaVersion: 3 }));
	harness.hydrateClientDesignVariants("");
	assert.equal(harness.getDesignVariants().pauseMegaBento, true);
	harness.setDesignVariant("pauseMegaBento", false);
	assert.equal(harness.readStoredDesignVariants().pauseMegaBento, false);
	assert.equal(harness.readStoredDesignVariants().moveVisual, false);
	harness.setDesignVariant("pauseMegaBento", true);
	assert.equal(harness.readStoredDesignVariants().pauseMegaBento, true);
});

test("Move visual starts on for older payloads and persists an explicit off", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });
	localStorage.setItem("ui-design-variants", JSON.stringify({ sessionPeel: false, schemaVersion: 2 }));
	const stored = harness.readStoredDesignVariants();
	assert.equal(stored.moveVisual, true);
	harness.hydrateDesignVariants(stored);
	harness.setDesignVariant("moveVisual", false);
	assert.equal(harness.getDesignVariants().moveVisual, false);
	assert.equal(harness.getDesignVariants().sessionPeel, false);
	assert.equal(harness.readStoredDesignVariants().moveVisual, false);
	harness.setDesignVariant("moveVisual", true);
	assert.equal(harness.readStoredDesignVariants().moveVisual, true);
});

// URL overrides: `?variants=id,-id` forces variants for one document load
// without touching storage, so agents and specs can reach a state directly.
const STORED_USER_CHOICES = JSON.stringify({ autoArrange: false, panel: true, sessionPeel: true, schemaVersion: 3 });

function parsed(harness, search) {
	const { overrides, unknownIds } = harness.parseDesignVariantOverrides(search);
	return { overrides: { ...overrides }, unknownIds: [...unknownIds] };
}

test("parses ?variants= add and remove tokens, including hyphenated ids", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	assert.equal(harness.DESIGN_VARIANTS_QUERY_PARAM, "variants");
	assert.deepEqual(parsed(harness, "?variants=autoArrange,-sessionPeel"), {
		overrides: { autoArrange: true, sessionPeel: false },
		unknownIds: [],
	});
	// The leading `-` is the only sign; the rest of the token is the id.
	assert.deepEqual(parsed(harness, "variants=-simple-views,simple-views&embedded=1"), {
		overrides: { "simple-views": true },
		unknownIds: [],
	});
	assert.deepEqual(parsed(harness, "?embedded=1&variants=-simple-views"), {
		overrides: { "simple-views": false },
		unknownIds: [],
	});
	// Encoded commas, padded tokens and a `+` (decodes to a space) still parse.
	assert.deepEqual(parsed(harness, "?variants=autoArrange%2C%20-sessionPeel+,+panel"), {
		overrides: { autoArrange: true, panel: true, sessionPeel: false },
		unknownIds: [],
	});
});

test("empty or absent ?variants= yields no overrides", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	for (const search of ["", "?", "?embedded=1", "?variants=", "?variants=,,%20,", "?variants=-", "?Variants=autoArrange"]) {
		assert.deepEqual(parsed(harness, search), { overrides: {}, unknownIds: [] }, search);
	}
	// No overrides means the base state keeps its identity.
	const base = harness.getDefaultDesignVariants();
	assert.equal(harness.applyDesignVariantOverrides(base, harness.parseDesignVariantOverrides("").overrides), base);
});

test("unknown ?variants= ids are ignored and reported once each", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	assert.deepEqual(parsed(harness, "?variants=bogus,-autoarrange,autoArrange,-bogus,AutoArrange"), {
		overrides: { autoArrange: true },
		unknownIds: ["bogus", "autoarrange", "AutoArrange"],
	});
});

test("duplicate ?variants= ids resolve to the last token, across repeated params", async (t) => {
	const harness = await loadDesignVariantsHarness(t);

	assert.deepEqual(parsed(harness, "?variants=autoArrange,-autoArrange").overrides, { autoArrange: false });
	assert.deepEqual(parsed(harness, "?variants=-autoArrange,autoArrange,autoArrange").overrides, { autoArrange: true });
	assert.deepEqual(parsed(harness, "?variants=autoArrange,panel&variants=-autoArrange").overrides, {
		autoArrange: false,
		panel: true,
	});
});

test("URL overrides take precedence over stored values without writing storage", async (t) => {
	const localStorage = new FakeLocalStorage();
	localStorage.setItem("ui-design-variants", STORED_USER_CHOICES);
	localStorage.writes = 0;
	const harness = await loadDesignVariantsHarness(t, { localStorage });

	harness.hydrateClientDesignVariants("?variants=autoArrange,-sessionPeel");

	assert.deepEqual(harness.getDesignVariants(), { advancedTimeline: false, autoArrange: true, agentSessionColumnResizing: true, kanbanBackground: false, manualLink: false, moveVisual: true, panel: true, pauseMegaBento: true, sessionBloom: true, sessionPeel: false, sessionProximity: false, sessionStroke: false, "simple-views": true, simpleKanban: true });
	assert.equal(localStorage.writes, 0);
	assert.equal(localStorage.getItem("ui-design-variants"), STORED_USER_CHOICES);
	assert.equal(harness.getDesignVariants(), harness.getDesignVariants(), "the overridden snapshot is stable");

	// Later mounts re-read storage but never re-read the URL: the override is
	// captured once per document, and a different search is ignored.
	harness.hydrateClientDesignVariants("?variants=-autoArrange");
	harness.hydrateClientDesignVariants("");
	assert.equal(harness.getDesignVariants().autoArrange, true);
	assert.equal(harness.getDesignVariants().sessionPeel, false);
	assert.equal(localStorage.writes, 0);
});

test("reloading without ?variants= restores the user's stored settings", async (t) => {
	const localStorage = new FakeLocalStorage();
	localStorage.setItem("ui-design-variants", STORED_USER_CHOICES);
	const overridden = await loadDesignVariantsHarness(t, { localStorage });
	overridden.hydrateClientDesignVariants("?variants=autoArrange,-sessionPeel");
	assert.equal(overridden.getDesignVariants().autoArrange, true);

	// A fresh module instance is a new document load.
	const reloaded = await loadDesignVariantsHarness(t, { localStorage });
	reloaded.hydrateClientDesignVariants("");
	assert.equal(reloaded.getDesignVariants().autoArrange, false);
	assert.equal(reloaded.getDesignVariants().sessionPeel, true);
	assert.equal(reloaded.getDesignVariants().panel, true);
});

test("Settings clicks persist only the user's own map and drop the clicked override", async (t) => {
	const localStorage = new FakeLocalStorage();
	localStorage.setItem("ui-design-variants", STORED_USER_CHOICES);
	const harness = await loadDesignVariantsHarness(t, { localStorage });
	harness.hydrateClientDesignVariants("?variants=autoArrange,-sessionPeel");

	// Toggling an unrelated variant must not leak the overridden values into storage.
	harness.setDesignVariant("sessionStroke", true);
	const persisted = JSON.parse(localStorage.getItem("ui-design-variants"));
	assert.equal(persisted.sessionStroke, true);
	assert.equal(persisted.autoArrange, false);
	assert.equal(persisted.sessionPeel, true);
	assert.equal(harness.getDesignVariants().autoArrange, true, "unclicked overrides stay in force");
	assert.equal(harness.getDesignVariants().sessionPeel, false);

	// Clicking an overridden variant is an explicit choice: it persists and wins.
	harness.setDesignVariant("sessionPeel", true);
	assert.equal(JSON.parse(localStorage.getItem("ui-design-variants")).sessionPeel, true);
	assert.equal(harness.getDesignVariants().sessionPeel, true);

	// Re-adopting storage (a later mount or another tab) keeps that choice, while
	// the still-unclicked Auto arrange override keeps winning over storage.
	harness.hydrateDesignVariants(harness.readStoredDesignVariants());
	assert.equal(harness.getDesignVariants().sessionPeel, true);
	assert.equal(harness.getDesignVariants().autoArrange, true);

	harness.setDesignVariant("autoArrange", false);
	assert.equal(harness.getDesignVariants().autoArrange, false);
	assert.equal(JSON.parse(localStorage.getItem("ui-design-variants")).autoArrange, false);
});

test("cross-tab storage updates replace the base while overrides keep their ids", async (t) => {
	const localStorage = new FakeLocalStorage();
	const harness = await loadDesignVariantsHarness(t, { localStorage });
	harness.hydrateClientDesignVariants("?variants=autoArrange");

	let notifications = 0;
	harness.subscribeToDesignVariants(() => {
		notifications += 1;
	});

	// Another tab turns Auto arrange off and Panel on.
	harness.hydrateDesignVariants({ ...harness.getDefaultDesignVariants(), autoArrange: false, panel: true });
	assert.equal(harness.getDesignVariants().panel, true);
	assert.equal(harness.getDesignVariants().autoArrange, true);
	assert.equal(notifications, 1);

	// A base change hidden by an override does not notify.
	harness.hydrateDesignVariants({ ...harness.getDefaultDesignVariants(), autoArrange: true, panel: true });
	assert.equal(notifications, 1);
	assert.equal(localStorage.writes, 0);
});

test("unknown ?variants= ids warn once and never log a console error", async (t) => {
	const harness = await loadDesignVariantsHarness(t);
	const warn = t.mock.method(console, "warn", () => {});
	const error = t.mock.method(console, "error", () => {});

	harness.hydrateClientDesignVariants("?variants=bogus,autoArrange");
	harness.hydrateClientDesignVariants("?variants=bogus");

	assert.equal(warn.mock.callCount(), 1);
	assert.match(String(warn.mock.calls[0].arguments[0]), /unknown design variant id\(s\).*bogus.*Known ids: panel, simple-views/u);
	assert.equal(error.mock.callCount(), 0);
	assert.equal(harness.getDesignVariants().autoArrange, true);

	const clean = await loadDesignVariantsHarness(t);
	clean.hydrateClientDesignVariants("?variants=autoArrange");
	assert.equal(warn.mock.callCount(), 1, "known ids do not warn");
});
