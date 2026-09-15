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
		/absolute -inset-px isolate rounded-\[inherit\]"\s*\n\s*data-slot="jira-issue-attach-trace"/u,
	);
});

test("nearness fades the stroke in, and reduced motion removes it", () => {
	// `attachNearness` is already zeroed by `resolveJiraIssueAttachNearness`
	// under reduced motion, so gating the trace on it is the reduced-motion
	// guard too — no second branch to keep in sync.
	assert.match(TRACE_OVERLAY_SOURCE, /if \(!trace \|\| nearness <= 0\) \{\s*return null;/u);
	assert.match(TRACE_OVERLAY_SOURCE, /opacity: nearness,/u);
	// The card still owns the ramp and feeds it in.
	assert.match(ISSUE_SOURCE, /resolveJiraIssueAttachNearness\(/u);
	assert.match(ISSUE_SOURCE, /nearness=\{attachNearness\}/u);
});

test("only the card the session is heading for traces, and a drop hands over to the flash", () => {
	// A second lit card would make the target ambiguous mid-drag.
	assert.match(BOARD_DRAG_SOURCE, /proximity\?\.cardCode === card\.code/u);
	// After pointer-up there is no pointer to trace, and the flash owns the
	// acknowledgement from that moment.
	assert.match(BOARD_DRAG_SOURCE, /const tracePointer = !isFusionDropFlight/u);
});
