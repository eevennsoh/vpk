const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

/**
 * The board insights nudge, executed rather than grepped.
 *
 * The module is a leaf — pure selection helpers plus type-only imports — so it
 * bundles without React and the real mapping can be run against the real
 * fixture. What is worth protecting here is behavioural and easy to get subtly
 * wrong: the headline number is the total rather than the capped row count, the
 * primary action resumes at the oldest unread insight rather than restarting at
 * the top, the subline names the board rather than a scope inside it, and
 * dismissal never touches the watermark.
 */

let harnessPromise;

function loadHarness() {
	harnessPromise ??= (async () => {
		const result = await esbuild.build({
			bundle: true,
			format: "cjs",
			platform: "node",
			stdin: {
				contents: `
					export {
						EXPERIMENTAL_BOARD_SPACE_NAME,
						JIRA_GOLDEN_JOURNEY_V3_INSIGHTS_NUDGE_ID,
						toBoardInsightsNudgeConfig,
					} from "./components/projects/jira-golden-journey-v3/board-insights-nudge-config";
					export { PULSE_TIMELINE } from "./components/blocks/jira-kanban/experimental/pulse/data/pulse-timeline";
					export { EXPERIMENTAL_BOARD_LAST_VIEWED_AT, latestTimelineTimestamp } from "./components/blocks/jira-kanban/experimental/lib/timeline-activity";
				`,
				loader: "ts",
				resolveDir: process.cwd(),
				sourcefile: "board-insights-nudge-config-harness.ts",
			},
			tsconfig: join(process.cwd(), "tsconfig.json"),
			write: false,
		});
		return loadCjsModuleFromText(result.outputFiles[0].text);
	})();

	return harnessPromise;
}

function spyHandlers() {
	const opened = [];
	const dismissed = [];
	return {
		dismissed,
		opened,
		onDismiss: () => dismissed.push(true),
		onOpenSnapshot: (snapshotId) => opened.push(snapshotId),
	};
}

test("the demo watermark produces a three-insight nudge that resumes where the reader stopped", async () => {
	const {
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		JIRA_GOLDEN_JOURNEY_V3_INSIGHTS_NUDGE_ID,
		PULSE_TIMELINE,
		toBoardInsightsNudgeConfig,
	} = await loadHarness();
	const handlers = spyHandlers();

	const config = toBoardInsightsNudgeConfig(
		PULSE_TIMELINE.snapshots,
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		{ ...handlers, spaceName: PULSE_TIMELINE.projectLabel },
	);

	assert.equal(config.id, JIRA_GOLDEN_JOURNEY_V3_INSIGHTS_NUDGE_ID);
	assert.equal(config.count, 3);
	assert.equal(config.overflowCount, 0);
	assert.equal(config.spaceName, PULSE_TIMELINE.projectLabel);
	assert.deepEqual(
		config.rows.map((row) => row.id),
		["s5-design-review", "s6-rehearsal", "s7-ship-readiness"],
	);
	// Chapter and clock, not the date pill: the card's meta line is the temporal
	// framing that makes "since your last visit" mean anything.
	assert.deepEqual(config.rows[0], {
		id: "s5-design-review",
		chapterLabel: "Wallet cut",
		timeLabel: "15:20",
		title: "We cut the wallet UI",
		onSelect: config.rows[0].onSelect,
	});

	// The bug this whole feature exists to fix: the reader was landed on snapshot
	// 1 of 7, which they had already read.
	config.onPrimaryAction();
	assert.deepEqual(handlers.opened, ["s5-design-review"]);
	assert.notEqual(handlers.opened[0], PULSE_TIMELINE.snapshots[0].id);
});

test("each row deep-links to its own snapshot", async () => {
	const {
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		PULSE_TIMELINE,
		toBoardInsightsNudgeConfig,
	} = await loadHarness();
	const handlers = spyHandlers();

	const config = toBoardInsightsNudgeConfig(
		PULSE_TIMELINE.snapshots,
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		handlers,
	);
	for (const row of config.rows) {
		row.onSelect();
	}

	assert.deepEqual(handlers.opened, ["s5-design-review", "s6-rehearsal", "s7-ship-readiness"]);
});

test("the headline count is the total, not the three rows that fit", async () => {
	const { PULSE_TIMELINE, toBoardInsightsNudgeConfig } = await loadHarness();

	// Nothing viewed yet — all seven are unread, and the card can only show three.
	const config = toBoardInsightsNudgeConfig(PULSE_TIMELINE.snapshots, null, spyHandlers());

	assert.equal(config.count, 7);
	assert.equal(config.rows.length, 3);
	assert.equal(config.overflowCount, 4);
	assert.notEqual(config.count, config.rows.length);
});

test("a fully read timeline produces no config at all", async () => {
	const {
		latestTimelineTimestamp,
		PULSE_TIMELINE,
		toBoardInsightsNudgeConfig,
	} = await loadHarness();

	assert.equal(
		toBoardInsightsNudgeConfig(
			PULSE_TIMELINE.snapshots,
			latestTimelineTimestamp(PULSE_TIMELINE.snapshots),
			spyHandlers(),
		),
		null,
	);
	assert.equal(toBoardInsightsNudgeConfig([], null, spyHandlers()), null);
});

test("dismissing collapses the affordance and leaves the watermark alone", async () => {
	const {
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		PULSE_TIMELINE,
		toBoardInsightsNudgeConfig,
	} = await loadHarness();
	const handlers = spyHandlers();

	const config = toBoardInsightsNudgeConfig(
		PULSE_TIMELINE.snapshots,
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		handlers,
	);
	config.onDismiss();

	assert.deepEqual(handlers.dismissed, [true]);
	// Dismissal must not open anything, because opening is what marks the
	// timeline viewed. The toolbar badge stays at 3.
	assert.deepEqual(handlers.opened, []);
	assert.equal(
		toBoardInsightsNudgeConfig(
			PULSE_TIMELINE.snapshots,
			EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
			handlers,
		).count,
		3,
	);
});

test("the subline names the board, not a scope inside it", async () => {
	const {
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		EXPERIMENTAL_BOARD_SPACE_NAME,
		PULSE_TIMELINE,
		toBoardInsightsNudgeConfig,
	} = await loadHarness();

	// The card renders `Since your last visit to ${spaceName}`, so this is the
	// place the reader is being told they have been away from. It has to be the
	// board they are looking at.
	const headerSource = readFileSync(
		join(process.cwd(), "components/blocks/jira-kanban/experimental/experimental-board-header.tsx"),
		"utf8",
	);
	assert.match(headerSource, /title = JIRA_DESIGN_PROJECT\.name/u);
	assert.match(headerSource, /<Heading as="h1"[^>]*>\{title\}<\/Heading>/u);
	assert.equal(
		EXPERIMENTAL_BOARD_SPACE_NAME,
		"Jira Design",
		"the card's space name must be the same board name the header renders",
	);

	const config = toBoardInsightsNudgeConfig(
		PULSE_TIMELINE.snapshots,
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		spyHandlers(),
	);

	assert.equal(config.spaceName, "Jira Design");
	// The regression: the epic line is a scope *inside* the board, and it is long
	// enough to ellipsis in the 295px card.
	assert.notEqual(config.spaceName, PULSE_TIMELINE.projectLabel);
	assert.doesNotMatch(config.spaceName, /PAY|·/u);
	// Measured against the rendered card: "Since your last visit to Jira Design"
	// fits on one line at 295px, and the same line ellipsised at the 31-character
	// epic label. 20 keeps the default demo value clear of that edge; a genuinely
	// long board name may still truncate, which is the card's job.
	assert.ok(
		config.spaceName.length <= 20,
		`the default space name must not truncate in the card (got ${config.spaceName.length} chars)`,
	);
});

test("the secondary action stays unset so the button falls back to chat", async () => {
	const {
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		PULSE_TIMELINE,
		toBoardInsightsNudgeConfig,
	} = await loadHarness();

	const config = toBoardInsightsNudgeConfig(
		PULSE_TIMELINE.snapshots,
		EXPERIMENTAL_BOARD_LAST_VIEWED_AT,
		spyHandlers(),
	);

	assert.equal(config.onSecondaryAction, undefined);
	assert.equal(config.stage, undefined, "the button owns its own stage");
});
