const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const ROOT = path.join(__dirname, "..", "..", "..");
const ISSUE_SOURCE = readFileSync(path.join(__dirname, "index.tsx"), "utf8");
const TRACE_OVERLAY_SOURCE = readFileSync(
	path.join(__dirname, "attach-trace-overlay.tsx"),
	"utf8",
);
const BOARD_DRAG_SOURCE = readFileSync(
	path.join(ROOT, "components/blocks/jira-kanban/experimental/use-board-agent-session-drag.ts"),
	"utf8",
);
const FUSION_STATE_SOURCE = readFileSync(
	path.join(ROOT, "components/blocks/jira-kanban/experimental/lib/session-fusion-overlay-state.ts"),
	"utf8",
);

async function loadBundled(relPathFromRoot) {
	const result = await esbuild.build({
		entryPoints: [path.join(ROOT, relPathFromRoot)],
		bundle: true,
		format: "cjs",
		platform: "node",
		write: false,
		external: ["react", "react/jsx-runtime", "motion/react"],
		alias: { "@": ROOT },
	});
	return loadCjsModuleFromText(result.outputFiles[0].text);
}

// ---------------------------------------------------------------------
// Pointer normalisation
// ---------------------------------------------------------------------

test("the approach pointer normalises to the shared card-glow space", async () => {
	const { toJiraIssueAttachTracePointer } = await loadBundled(
		"components/blocks/jira-issue/attach-proximity.ts",
	);
	const rect = { bottom: 300, left: 100, right: 300, top: 200 };

	// Centre is 0,0; the edges are ±1 — the same reading the session card's
	// hover writes, so the two ends of the gesture trace identically.
	assert.deepEqual(
		toJiraIssueAttachTracePointer({ x: 200, y: 250 }, rect),
		{ pointerX: 0, pointerY: 0 },
	);
	assert.deepEqual(
		toJiraIssueAttachTracePointer({ x: 300, y: 300 }, rect),
		{ pointerX: 1, pointerY: 1 },
	);
	assert.deepEqual(
		toJiraIssueAttachTracePointer({ x: 100, y: 200 }, rect),
		{ pointerX: -1, pointerY: -1 },
	);
});

test("a pointer still outside the card reads beyond the edge, not clamped to it", async () => {
	const { toJiraIssueAttachTracePointer } = await loadBundled(
		"components/blocks/jira-issue/attach-proximity.ts",
	);
	// The whole approach happens outside the card. Clamping would park the
	// stroke on the edge and make it switch on rather than arrive.
	const outside = toJiraIssueAttachTracePointer(
		{ x: 0, y: 250 },
		{ bottom: 300, left: 100, right: 300, top: 200 },
	);
	assert.ok(outside !== null && outside.pointerX < -1, "an approaching pointer reads past -1");
});

test("an unmeasured card draws nothing instead of dividing by zero", async () => {
	const { toJiraIssueAttachTracePointer } = await loadBundled(
		"components/blocks/jira-issue/attach-proximity.ts",
	);
	assert.equal(
		toJiraIssueAttachTracePointer({ x: 10, y: 10 }, { bottom: 0, left: 0, right: 0, top: 0 }),
		null,
	);
});

// ---------------------------------------------------------------------
// One accent across the whole gesture
// ---------------------------------------------------------------------

test("the approach stroke resolves its accent exactly the way the drop flash does", () => {
	// Hover in the column, approach on the board, and flash on the chin row are
	// one gesture. All three go through `resolveAgentBrandTintColor(seed) ??
	// AGENT_BRAND_TINT_FALLBACK`, so the colour cannot change at a seam.
	assert.match(
		BOARD_DRAG_SOURCE,
		/accent: resolveAgentBrandTintColor\(traceMembers\?\.\[0\]\?\.tintSeed\)\s*\?\? AGENT_BRAND_TINT_FALLBACK,/u,
	);
	assert.match(
		FUSION_STATE_SOURCE,
		/tint: resolveAgentBrandTintColor\(members\[0\]\.tintSeed\) \?\? AGENT_BRAND_TINT_FALLBACK,/u,
	);
	// Both read the cohort lead, not whichever member happens to be first in a
	// different list.
	assert.match(BOARD_DRAG_SOURCE, /const traceMembers = transaction\?\.cohort\.members;/u);
});

// ---------------------------------------------------------------------
// What the card draws
// ---------------------------------------------------------------------

test("the card traces a stroke only — the grey backdrop is already its fill", () => {
	assert.match(TRACE_OVERLAY_SOURCE, /<CardGlowLayers baseBorder=\{false\} bloom=\{false\} \/>/u);
	// The card hosts the overlay; it does not reach into the effect itself.
	assert.doesNotMatch(ISSUE_SOURCE, /CardGlowLayers/u);
});

test("the stroke rides the surface's own border instead of doubling it", () => {
	// `-inset-px` lifts the ring onto the 1px border the surface already draws,
	// so the accent replaces that stroke under the pointer rather than sitting
	// as a second line just inside it.
	assert.match(
		TRACE_OVERLAY_SOURCE,
		/absolute -inset-px isolate rounded-\[inherit\][^"]*"\s*\n\s*data-slot="jira-issue-attach-trace"/u,
	);
});

test("nearness fades the stroke in, and reduced motion removes it", () => {
	// Decorative nearness is zeroed by `resolveJiraIssueAttachNearness`
	// under reduced motion, so gating the trace on it is the reduced-motion
	// guard too — no second branch to keep in sync.
	assert.match(TRACE_OVERLAY_SOURCE, /if \(!trace \|\| nearness <= 0\) \{\s*return null;/u);
	assert.match(TRACE_OVERLAY_SOURCE, /opacity: nearness,/u);
	assert.match(TRACE_OVERLAY_SOURCE, /motion-reduce:hidden motion-reduce:transition-none/u);
	// The card still owns the ramp and feeds it in.
	assert.match(ISSUE_SOURCE, /resolveJiraIssueAttachNearness\(/u);
	assert.match(ISSUE_SOURCE, /nearness=\{resolveJiraIssueAttachNearness\(agentSessionDragControl\?\.attachTrace\?\.nearness \?\? attachNearness, shouldReduceMotion\)\}/u);
});

test("nearby cards share the trace and a drop hands over to the flash", () => {
	assert.match(BOARD_DRAG_SOURCE, /transaction\?\.traces\?\.find\(\(trace\) => trace\.cardCode === card\.code\)/u);
	// After pointer-up there is no pointer to trace, and the flash owns the
	// acknowledgement from that moment.
	assert.match(BOARD_DRAG_SOURCE, /const tracePointer = !isFusionDropFlight/u);
});

test("the decorative neighbourhood is bounded and keeps an approaching arc visible", async () => {
	const { resolveBoardAgentSessionTraces } = await loadBundled("components/blocks/jira-kanban/experimental/lib/board-agent-session-trace.ts");
	const zones = Array.from({ length: 7 }, (_, index) => ({
		kind: "issue", cardCode: `PAY-${index}`,
		bounds: { left: index * 30, right: index * 30 + 20, top: 0, bottom: 100 },
	}));
	const traces = resolveBoardAgentSessionTraces({ kind: "untracked" }, { x: 10, y: 50 }, zones, "PAY-0");
	assert.equal(traces.length, 4);
	assert.equal(traces[0].cardCode, "PAY-0");
	assert.equal(traces[0].nearness, 1);
	for (const trace of traces.slice(1)) {
		assert.ok(trace.nearness > 0 && trace.nearness < 0.45);
		// A point far outside the card's box still paints within the shared
		// gradient's 120px spread, facing the side the session approaches from.
		const distanceOutside = (-trace.pointerX - 1) * 10;
		assert.ok(distanceOutside > 0 && distanceOutside <= 24);
	}
	assert.deepEqual(resolveBoardAgentSessionTraces({ kind: "untracked" }, { x: 2000, y: 50 }, zones, "PAY-0"), []);
	assert.deepEqual(resolveBoardAgentSessionTraces({ kind: "untracked" }, { x: 0, y: 0 }, [{ kind: "issue", cardCode: "empty", bounds: { left: 0, right: 0, top: 0, bottom: 0 } }], "empty"), []);
});

test("the closest visible border stays fully opaque outside the card and neighbours fade more steeply", async () => {
	const { resolveBoardAgentSessionTraces } = await loadBundled("components/blocks/jira-kanban/experimental/lib/board-agent-session-trace.ts");
	const zones = [20, 60, 110].map((left, index) => ({
		kind: "issue", cardCode: `PAY-${index}`,
		// A larger hit box must not override distance to the painted border.
		bounds: { left: 0, right: 200, top: 0, bottom: 100 },
		surfaceRect: { left, right: left + 20, top: 0, bottom: 100 },
	}));
	const traces = resolveBoardAgentSessionTraces({ kind: "untracked" }, { x: 0, y: 50 }, zones, "PAY-2");
	assert.equal(traces[0].cardCode, "PAY-0");
	assert.equal(traces[0].nearness, 1);
	assert.ok(traces[1].nearness < 0.3);
	assert.ok(traces[2].nearness < 0.1);
	assert.ok(traces[1].nearness > traces[2].nearness);
});
