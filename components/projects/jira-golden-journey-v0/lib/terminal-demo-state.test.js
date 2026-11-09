const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

async function loadTerminalStateHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					applyBoardEvent,
					applyStep,
					createInitialTerminalDemoState,
					createTerminalDemoReducer,
					foldBeats,
					getBoardCounts,
					getBoardSections,
					getOrderedItemKeys,
					getTerminalScreenProgress,
				} from "./components/projects/jira-golden-journey-v0/lib/terminal-demo-state";
				export { getJiraIssueUrl, TERMINAL_DEMO_BEATS } from "./components/projects/jira-golden-journey-v0/data/terminal-demo-script";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "terminal-demo-state-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

const TERMINAL_HOOK_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v0/hooks/use-terminal-demo.ts"),
	"utf8",
);
const TERMINAL_JIRA_PANE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v0/components/terminal-stage-jira-pane.tsx"),
	"utf8",
);
const TERMINAL_PAGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v0/page.tsx"),
	"utf8",
);
const TERMINAL_STAGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v0/components/terminal-stage.tsx"),
	"utf8",
);
const GALLERY_HEADER_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v0/components/gallery-header-controls.tsx"),
	"utf8",
);
const TERMINAL_CHROME_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v0/components/terminal-stage-chrome.tsx"),
	"utf8",
);
const TERMINAL_CLAUDE_PANE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v0/components/terminal-stage-claude-pane.tsx"),
	"utf8",
);
const TERMINAL_VIEW_SOURCES = [
	TERMINAL_STAGE_SOURCE,
	TERMINAL_CHROME_SOURCE,
	TERMINAL_CLAUDE_PANE_SOURCE,
	TERMINAL_JIRA_PANE_SOURCE,
].join("\n");

function item(key, status, overrides = {}) {
	return { age: "now", key, status, summary: "summary", title: key, ...overrides };
}

/** Recursively steps a reducer through every beat/step in the script via commit-step,
 * beginning a new beat whenever the previous one has settled. */
function playThroughScript(harness) {
	const reducer = harness.createTerminalDemoReducer(harness.TERMINAL_DEMO_BEATS);
	let state = harness.createInitialTerminalDemoState();

	while (state.beatIndex < harness.TERMINAL_DEMO_BEATS.length - 1 || !state.settled) {
		if (state.settled) {
			state = reducer(state, { type: "begin-beat" });
			continue;
		}
		state = reducer(state, { type: "commit-step" });
	}

	return state;
}

test("Terminal owns a dark default that the Gallery theme control can cycle", () => {
	assert.match(TERMINAL_PAGE_SOURCE, /useState<"dark" \| "light">\("dark"\)/u);
	assert.match(
		TERMINAL_PAGE_SOURCE,
		/setTerminalTheme\(\(current\) => \(current === "dark" \? "light" : "dark"\)\)/u,
	);
	assert.match(TERMINAL_PAGE_SOURCE, /theme=\{isTerminal \? terminalTheme : undefined\}/u);
	assert.match(TERMINAL_PAGE_SOURCE, /onThemeCycle=\{isTerminal \? handleTerminalThemeCycle : undefined\}/u);
	assert.match(TERMINAL_PAGE_SOURCE, /"data-color-mode": terminalTheme/u);
});

test("Terminal exposes one progress-labelled header section with compact stepping", () => {
	assert.match(GALLERY_HEADER_SOURCE, /label: "Terminal"/u);
	assert.match(GALLERY_HEADER_SOURCE, /getTerminalScreenProgress\(/u);
	assert.match(GALLERY_HEADER_SOURCE, /previous: terminalController\.state\.beatIndex >= 0 \? terminalController\.stepBack : null/u);
	assert.match(GALLERY_HEADER_SOURCE, /next: terminalController\.state\.finished \? null : terminalController\.advance/u);
	assert.match(GALLERY_HEADER_SOURCE, /aria-label="Previous section step"/u);
	assert.match(GALLERY_HEADER_SOURCE, /aria-label="Jump to section"/u);
	assert.match(GALLERY_HEADER_SOURCE, /aria-label="Next section step"/u);
	assert.doesNotMatch(TERMINAL_STAGE_SOURCE, /export function TerminalControls/u);
});

test("Terminal header counts the initial and split frames as distinct visual screens", async () => {
	const harness = await loadTerminalStateHarness();
	const reducer = harness.createTerminalDemoReducer(harness.TERMINAL_DEMO_BEATS);
	const beatCount = harness.TERMINAL_DEMO_BEATS.length;
	let state = harness.createInitialTerminalDemoState();

	assert.deepEqual(harness.getTerminalScreenProgress(state.beatIndex, beatCount), {
		position: 0,
		count: beatCount + 1,
	});

	state = reducer(state, { type: "begin-beat" });
	state = reducer(state, { type: "commit-step" });
	assert.equal(state.split, true);
	assert.deepEqual(harness.getTerminalScreenProgress(state.beatIndex, beatCount), {
		position: 1,
		count: beatCount + 1,
	});

	const final = playThroughScript(harness);
	assert.deepEqual(harness.getTerminalScreenProgress(final.beatIndex, beatCount), {
		position: beatCount,
		count: beatCount + 1,
	});
});

test("Terminal frame follows semantic theme tokens without fixed zinc overrides", () => {
	assert.doesNotMatch(TERMINAL_VIEW_SOURCES, /TERMINAL_FRAME_ZINC_VARS|--ds-/u);
	assert.doesNotMatch(TERMINAL_VIEW_SOURCES, /(?:bg|border|text)-zinc-/u);
	assert.match(TERMINAL_STAGE_SOURCE, /border-border bg-surface-raised[^\n]*text-text/u);
});

test("Terminal divider stays transparent until the pane is split", () => {
	assert.match(
		TERMINAL_STAGE_SOURCE,
		/state\.split \? "bg-border" : "bg-transparent"/u,
	);
});

test("applyBoardEvent add-item appends without mutating the input array", async () => {
	const harness = await loadTerminalStateHarness();
	const items = [item("WEB-1", "backlog")];
	const next = harness.applyBoardEvent(items, { item: item("WEB-2", "backlog"), type: "add-item" });

	assert.equal(items.length, 1);
	assert.equal(next.length, 2);
	assert.deepEqual(next[1], item("WEB-2", "backlog"));
});

test("applyBoardEvent move-item changes only the targeted item's status", async () => {
	const harness = await loadTerminalStateHarness();
	const items = [item("WEB-1", "backlog"), item("WEB-2", "backlog")];
	const next = harness.applyBoardEvent(items, { key: "WEB-1", to: "working", type: "move-item" });

	assert.equal(next[0].status, "working");
	assert.equal(next[1], items[1]);
});

test("applyBoardEvent set-summary updates summary and optional age", async () => {
	const harness = await loadTerminalStateHarness();
	const items = [item("WEB-1", "working", { age: "3d", summary: "old" })];

	const withoutAge = harness.applyBoardEvent(items, { key: "WEB-1", summary: "new", type: "set-summary" });
	assert.equal(withoutAge[0].summary, "new");
	assert.equal(withoutAge[0].age, "3d");

	const withAge = harness.applyBoardEvent(items, { age: "now", key: "WEB-1", summary: "newer", type: "set-summary" });
	assert.equal(withAge[0].age, "now");
});

test("applyBoardEvent set-pr attaches a PR label", async () => {
	const harness = await loadTerminalStateHarness();
	const items = [item("WEB-1", "working")];
	const next = harness.applyBoardEvent(items, { key: "WEB-1", number: 100, state: "open", type: "set-pr" });

	assert.deepEqual(next[0].pr, { number: 100, state: "open" });
});

test("applyBoardEvent no-ops on an unknown key", async () => {
	const harness = await loadTerminalStateHarness();
	const items = [item("WEB-1", "working")];
	const next = harness.applyBoardEvent(items, { key: "WEB-404", to: "done", type: "move-item" });

	assert.deepEqual(next, items);
});

test("stepping through the whole script equals folding to the final beat", async () => {
	const harness = await loadTerminalStateHarness();
	const stepped = playThroughScript(harness);
	const folded = harness.foldBeats(harness.TERMINAL_DEMO_BEATS, harness.TERMINAL_DEMO_BEATS.length - 1);

	assert.deepEqual(stepped, folded);
	assert.equal(stepped.finished, true);
	assert.equal(stepped.settled, true);
});

test("script integrity: every board event key exists when applied", async () => {
	const harness = await loadTerminalStateHarness();
	let items = [];

	for (const beat of harness.TERMINAL_DEMO_BEATS) {
		for (const step of beat.steps) {
			if (step.kind !== "board") continue;
			for (const event of step.events) {
				const key = event.type === "add-item" ? event.item.key : event.key;
				if (event.type !== "add-item") {
					assert.ok(
						items.some((existing) => existing.key === key),
						`event ${event.type} references unknown key ${key}`,
					);
				}
				items = harness.applyBoardEvent(items, event);
			}
		}
	}
});

test("script integrity: exactly one click-trigger beat and it is the split beat", async () => {
	const harness = await loadTerminalStateHarness();
	const clickBeats = harness.TERMINAL_DEMO_BEATS.filter((beat) => beat.trigger === "click");

	assert.equal(clickBeats.length, 1);
	assert.equal(clickBeats[0].id, "split");
});

test("script integrity: beat 7 onward sends typed input through Claude Code", async () => {
	const harness = await loadTerminalStateHarness();
	const laterInputSteps = harness.TERMINAL_DEMO_BEATS.slice(6).flatMap((beat) => (
		beat.steps.filter((step) => step.kind === "type" || step.kind === "submit")
	));

	assert.ok(laterInputSteps.length > 0);
	assert.ok(laterInputSteps.every((step) => step.pane === "right"));
});

test("Jira dashboard keeps shortcuts without restoring its dispatch box", async () => {
	const harness = await loadTerminalStateHarness();

	assert.equal(harness.getJiraIssueUrl("ASX-198"), "https://asx.atlassian.net/browse/ASX-198");
	assert.match(TERMINAL_JIRA_PANE_SOURCE, /\{JIRA_CLI_FOOTER_HINTS\}/u);
	assert.doesNotMatch(TERMINAL_JIRA_PANE_SOURCE, /JIRA_CLI_DISPATCH_PLACEHOLDER/u);
	assert.match(
		TERMINAL_HOOK_SOURCE,
		/window\.open\(getJiraIssueUrl\(selectedKey\), "_blank", "noopener,noreferrer"\);/u,
	);
});

test("Jira dashboard compositor hints are removed in reduced motion", () => {
	assert.match(
		TERMINAL_JIRA_PANE_SOURCE,
		/style=\{shouldReduceMotion \? undefined : \{ willChange: "transform, opacity" \}\}/u,
	);
	assert.match(
		TERMINAL_JIRA_PANE_SOURCE,
		/style=\{shouldReduceMotion \? undefined : \{ willChange: "opacity" \}\}/u,
	);
	assert.doesNotMatch(TERMINAL_JIRA_PANE_SOURCE, /style=\{\{ willChange:/u);
});

test("script integrity: final board counts and every done item has a PR", async () => {
	const harness = await loadTerminalStateHarness();
	const final = harness.foldBeats(harness.TERMINAL_DEMO_BEATS, harness.TERMINAL_DEMO_BEATS.length - 1);
	const counts = harness.getBoardCounts(final.items);

	assert.deepEqual(counts, { awaiting: 0, completed: 6, working: 0 });

	const sections = harness.getBoardSections(final.items);
	assert.equal(sections.done.length, 6);
	for (const doneItem of sections.done) {
		assert.ok(doneItem.pr, `${doneItem.key} is done but has no PR`);
	}
});

test("reducer control flow: commit-step past the last step keeps state settled", async () => {
	const harness = await loadTerminalStateHarness();
	const reducer = harness.createTerminalDemoReducer(harness.TERMINAL_DEMO_BEATS);
	let state = harness.createInitialTerminalDemoState();
	state = reducer(state, { type: "begin-beat" });
	state = reducer(state, { type: "finish-beat" });
	assert.equal(state.settled, true);

	const settledAgain = reducer(state, { type: "commit-step" });
	assert.deepEqual(settledAgain, state);
});

test("reducer control flow: restart returns the initial state", async () => {
	const harness = await loadTerminalStateHarness();
	const reducer = harness.createTerminalDemoReducer(harness.TERMINAL_DEMO_BEATS);
	let state = harness.createInitialTerminalDemoState();
	state = reducer(state, { type: "begin-beat" });
	state = reducer(state, { type: "commit-step" });

	const restarted = reducer(state, { type: "restart" });
	assert.deepEqual(restarted, harness.createInitialTerminalDemoState());
});

test("reducer control flow: step-back rolls back to the previous beat's settled state", async () => {
	const harness = await loadTerminalStateHarness();
	const reducer = harness.createTerminalDemoReducer(harness.TERMINAL_DEMO_BEATS);
	const lastIndex = harness.TERMINAL_DEMO_BEATS.length - 1;

	const final = playThroughScript(harness);
	const back = reducer(final, { type: "step-back" });
	assert.deepEqual(back, harness.foldBeats(harness.TERMINAL_DEMO_BEATS, lastIndex - 1));

	// Mid-beat rollback discards in-flight progress and lands on the prior beat.
	let mid = harness.createInitialTerminalDemoState();
	mid = reducer(mid, { type: "begin-beat" }); // beat 0 (split)
	mid = reducer(mid, { type: "commit-step" }); // settle split
	mid = reducer(mid, { type: "begin-beat" }); // beat 1 (connect)
	mid = reducer(mid, { type: "commit-step" }); // one step in, unsettled
	assert.equal(mid.settled, false);
	assert.deepEqual(reducer(mid, { type: "step-back" }), harness.foldBeats(harness.TERMINAL_DEMO_BEATS, 0));
});

test("reducer control flow: step-back at the first beat returns the initial state", async () => {
	const harness = await loadTerminalStateHarness();
	const reducer = harness.createTerminalDemoReducer(harness.TERMINAL_DEMO_BEATS);
	let state = harness.createInitialTerminalDemoState();
	state = reducer(state, { type: "begin-beat" }); // beat 0 (split)
	state = reducer(state, { type: "commit-step" }); // settled at beat 0

	assert.deepEqual(reducer(state, { type: "step-back" }), harness.createInitialTerminalDemoState());
	// And a step-back before anything has run stays at the initial state.
	assert.deepEqual(
		reducer(harness.createInitialTerminalDemoState(), { type: "step-back" }),
		harness.createInitialTerminalDemoState(),
	);
});

test("getOrderedItemKeys returns keys in needs-input → working → backlog → done order", async () => {
	const harness = await loadTerminalStateHarness();
	const items = [
		item("A", "done"),
		item("B", "backlog"),
		item("C", "working"),
		item("D", "needs-input"),
		item("E", "working"),
	];

	assert.deepEqual(harness.getOrderedItemKeys(items), ["D", "C", "E", "B", "A"]);
});

test("reducer control flow: begin-beat while unsettled is a no-op", async () => {
	const harness = await loadTerminalStateHarness();
	const reducer = harness.createTerminalDemoReducer(harness.TERMINAL_DEMO_BEATS);
	let state = harness.createInitialTerminalDemoState();
	// Beat 0 ("split") is a single step, so settle it first, then begin beat 1
	// ("connect", multi-step) and commit only its first step to land mid-beat.
	state = reducer(state, { type: "begin-beat" });
	state = reducer(state, { type: "commit-step" });
	state = reducer(state, { type: "begin-beat" });
	state = reducer(state, { type: "commit-step" });
	assert.equal(state.settled, false);

	const noop = reducer(state, { type: "begin-beat" });
	assert.deepEqual(noop, state);
});
