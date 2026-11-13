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
					getVisibleOutputLines,
				} from "./components/projects/jira-golden-journey-v1/lib/terminal-demo-state";
				export {
					getJiraIssueUrl,
					JIRA_GOLDEN_JOURNEY_V1_TERMINAL_STORY,
					TERMINAL_DEMO_BEATS,
				} from "./components/projects/jira-golden-journey-v1/data/terminal-demo-script";
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
	path.join(process.cwd(), "components/projects/jira-golden-journey-v1/hooks/use-terminal-demo.ts"),
	"utf8",
);
const TERMINAL_JIRA_PANE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v1/components/terminal-stage-jira-pane.tsx"),
	"utf8",
);
const TERMINAL_CLAUDE_PANE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v1/components/terminal-stage-claude-pane.tsx"),
	"utf8",
);
const TERMINAL_STAGE_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "components/projects/jira-golden-journey-v1/components/terminal-stage.tsx"),
	"utf8",
);

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

test("paste writes the full prompt draft without changing type semantics", async () => {
	const harness = await loadTerminalStateHarness();
	const initial = harness.createInitialTerminalDemoState();
	const pasted = harness.applyStep(initial, {
		kind: "paste",
		pane: "right",
		text: "claude --resume PAY-101",
	});
	const typed = harness.applyStep(initial, {
		kind: "type",
		pane: "right",
		text: "claude --resume PAY-101",
	});

	assert.equal(pasted.right.promptDraft, "claude --resume PAY-101");
	assert.equal(typed.right.promptDraft, "claude --resume PAY-101");
	assert.deepEqual(pasted.right.transcript, []);
	assert.deepEqual(typed.right.transcript, []);
	assert.match(TERMINAL_HOOK_SOURCE, /step\.kind === "paste"[\s\S]*PASTE_PREVIEW_MS/u);
	assert.match(TERMINAL_CLAUDE_PANE_SOURCE, /activeStep\?\.kind === "paste"/u);
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

test("script integrity: after TwG loads context, typed input goes to Claude Code", async () => {
	const harness = await loadTerminalStateHarness();
	const contextIndex = harness.TERMINAL_DEMO_BEATS.findIndex((beat) => beat.id === "context-loaded");
	assert.ok(contextIndex >= 0, "expected a `context-loaded` beat");
	const laterInputSteps = harness.TERMINAL_DEMO_BEATS.slice(contextIndex + 1).flatMap((beat) => (
		beat.steps.filter((step) => step.kind === "type" || step.kind === "submit")
	));

	assert.ok(laterInputSteps.length > 0);
	assert.ok(laterInputSteps.every((step) => step.pane === "right"));
});

test("post-review terminal transitions reveal only each destination beat's new lines", async () => {
	const harness = await loadTerminalStateHarness();
	const transitions = [
		{
			fromBeat: 7,
			toBeat: 8,
			lines: [
				"⏺ Updated range selection to use the rendered filtered issue list",
				"⏺ Added regression coverage for Shift-select while filtered",
				"✓ Focused tests passed · lint passed · typecheck passed",
			],
		},
		{
			fromBeat: 8,
			toBeat: 9,
			lines: [
				"  ⎿ commit c91e42a  fix(jira): preserve range selection while filtered",
				"✓ Pushed follow-up commit to PR #247",
			],
		},
		{
			fromBeat: 9,
			toBeat: 10,
			lines: [
				"⏺ gh pr merge 247 --squash --delete-branch",
				"✓ PR #247 merged into main",
				"✓ JGP-247 moved to Done",
			],
		},
	];

	for (const { fromBeat, toBeat, lines } of transitions) {
		const prior = harness.foldBeats(harness.TERMINAL_DEMO_BEATS, fromBeat - 1);
		const destination = harness.TERMINAL_DEMO_BEATS[toBeat - 1];
		const outputStep = destination.steps.find((step) => step.kind === "output" && step.pane === "right");
		assert.ok(outputStep, `expected right-pane output in beat ${toBeat}`);

		assert.deepEqual(
			harness.getVisibleOutputLines(outputStep, "right", 1).map((line) => line.map((span) => span.text).join("")),
			[lines[0]],
		);
		assert.deepEqual(
			harness.getVisibleOutputLines(outputStep, "right", lines.length).map((line) => line.map((span) => span.text).join("")),
			lines,
		);

		const reducer = harness.createTerminalDemoReducer(harness.TERMINAL_DEMO_BEATS);
		let inProgress = reducer(prior, { type: "begin-beat" });
		while (destination.steps[inProgress.stepIndex]?.kind !== "output") {
			inProgress = reducer(inProgress, { type: "commit-step" });
		}
		assert.deepEqual(
			inProgress.right.transcript.slice(0, prior.right.transcript.length),
			prior.right.transcript,
			`beat ${toBeat} must preserve beat ${fromBeat} history`,
		);
		assert.deepEqual(
			reducer(inProgress, { type: "finish-beat" }),
			harness.foldBeats(harness.TERMINAL_DEMO_BEATS, toBeat - 1),
			`beat ${toBeat} must settle to its complete deterministic state`,
		);
	}
});

test("Jira dashboard keeps shortcuts without restoring its dispatch box", async () => {
	const harness = await loadTerminalStateHarness();

	assert.equal(harness.getJiraIssueUrl("JGP-198"), "https://jira-golden-journey-v1.atlassian.net/browse/JGP-198");
	assert.match(TERMINAL_JIRA_PANE_SOURCE, /\{story\.dashboard\.footerHints\}/u);
	assert.doesNotMatch(TERMINAL_JIRA_PANE_SOURCE, /JIRA_CLI_DISPATCH_PLACEHOLDER/u);
	assert.match(
		TERMINAL_HOOK_SOURCE,
		/window\.open\(story\.getIssueUrl\(selectedKey\), "_blank", "noopener,noreferrer"\);/u,
	);
});

test("v1 remains the default terminal story and preserves its chrome", async () => {
	const harness = await loadTerminalStateHarness();
	const story = harness.JIRA_GOLDEN_JOURNEY_V1_TERMINAL_STORY;

	assert.equal(story.beats, harness.TERMINAL_DEMO_BEATS);
	assert.equal(story.dashboard.title, "Teamwork Graph");
	assert.equal(story.claude.cwd, "~/dev/jira-golden-journey-v1");
	assert.equal(story.statusBar.sessionName, "jira-golden-journey-v1");
	assert.equal(story.statusBar.splitWindowLabel, "0:twg 1:claude*");
	assert.equal(story.finishedHint, "demo complete · R to restart");
	assert.equal(story.layout, undefined);
	assert.match(TERMINAL_HOOK_SOURCE, /options\?\.story \?\? JIRA_GOLDEN_JOURNEY_V1_TERMINAL_STORY/u);
	assert.match(TERMINAL_STAGE_SOURCE, /story\.layout === "claude-only"/u);
	assert.match(TERMINAL_STAGE_SOURCE, /isClaudeOnly \? "claude-only" : "dual-pane"/u);
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

test("script integrity: Carl's selected work ends merged while the remaining backlog stays available", async () => {
	const harness = await loadTerminalStateHarness();
	const final = harness.foldBeats(harness.TERMINAL_DEMO_BEATS, harness.TERMINAL_DEMO_BEATS.length - 1);
	const counts = harness.getBoardCounts(final.items);

	assert.deepEqual(counts, { awaiting: 0, completed: 1, working: 0 });

	const sections = harness.getBoardSections(final.items);
	assert.deepEqual(sections.backlog.map(({ key }) => key), ["JGP-231", "JGP-244", "JGP-217"]);
	assert.deepEqual(sections.done.map(({ key, title, pr }) => ({ key, title, pr })), [
		{
			key: "JGP-247",
			title: "Add assignee focus mode",
			pr: { number: 247, state: "merged" },
		},
	]);
});

test("script tells the approved TwG, review handoff, follow-up commit, and merge story", async () => {
	const harness = await loadTerminalStateHarness();
	assert.deepEqual(
		harness.TERMINAL_DEMO_BEATS.map((beat) => beat.id),
		[
			"split",
			"start-work-typed",
			"backlog-loaded",
			"inspect-work",
			"context-loaded",
			"implementation",
			"review-handoff",
			"revision",
			"follow-up-commit",
			"merge",
		],
	);

	const allText = harness.TERMINAL_DEMO_BEATS.flatMap((beat) => beat.steps).flatMap((step) => {
		if (step.kind === "type") return [step.text];
		if (step.kind === "output") return step.lines.flatMap((line) => line.map((span) => span.text));
		return [];
	}).join("\n");

	assert.match(allText, /^twg start-work$/mu);
	assert.match(allText, /Explain JGP-247\. Include the issue, linked design notes, and implementation risks\./u);
	assert.match(allText, /get Jira issue JGP-247/u);
	assert.match(allText, /⎿ Goal ·/u);
	assert.match(allText, /⎿ Acceptance ·/u);
	assert.match(allText, /⎿ Risk ·/u);
	assert.match(allText, /twg start-work JGP-247/u);
	assert.doesNotMatch(allText, /Show me the tools and checks/u);
	assert.doesNotMatch(allText, /AI-ready context shared with Claude Code/u);
	assert.match(allText, /⏺ Read ·/u);
	assert.match(allText, /⏺ Search ·/u);
	assert.match(allText, /⏺ Edit ·/u);
	assert.match(allText, /⏺ Test ·/u);
	assert.match(allText, /⏺ Bash ·/u);
	assert.match(allText, /kanban-lifecycle\.test\.js · 7 passed/u);
	assert.match(allText, /pnpm run typecheck · passed/u);
	assert.doesNotMatch(allText, /  ·  /u);
	assert.match(allText, /⏺ GitHub ·/u);

	const reviewHandoff = harness.TERMINAL_DEMO_BEATS.find((beat) => beat.id === "review-handoff");
	assert.ok(reviewHandoff, "expected a `review-handoff` beat");
	const [handoffInput, handoffSubmit] = reviewHandoff.steps;
	assert.equal(handoffInput.kind, "type");
	assert.equal(handoffInput.pane, "right");
	assert.equal(handoffSubmit.kind, "submit");
	assert.equal(handoffSubmit.pane, "right");
	assert.match(
		handoffInput.text,
		/claude -- 'Continue work on Jira work item "Add assignee focus mode" \(JGP-247\) in this local Claude session\./u,
	);
	assert.match(handoffInput.text, /<JIRA_WORK_ITEM>[\s\S]*<key>JGP-247<\/key>/u);
	assert.match(handoffInput.text, /<reviewFeedback>[\s\S]*<author>Carl<\/author>/u);
	assert.match(handoffInput.text, /Preserve Shift-selection against the visible filtered order/u);
	assert.match(handoffInput.text, /Calculate the range from filteredIssues, not the unfiltered board\./u);
	assert.match(allText, /fix\(jira\): preserve range selection while filtered/u);
	assert.match(allText, /PR #247 merged into main/u);
	assert.match(allText, /All checks passing · ready for your review/u);
	assert.doesNotMatch(allText, /Carl's review/u);
	assert.equal(harness.foldBeats(harness.TERMINAL_DEMO_BEATS, 4).right.working, true);
	assert.equal(harness.foldBeats(harness.TERMINAL_DEMO_BEATS, 5).right.working, false);
	assert.equal(harness.foldBeats(harness.TERMINAL_DEMO_BEATS, 6).right.working, true);
	assert.equal(harness.foldBeats(harness.TERMINAL_DEMO_BEATS, 7).right.working, false);

	const toolSpans = harness.TERMINAL_DEMO_BEATS.flatMap((beat) => beat.steps)
		.filter((step) => step.kind === "output")
		.flatMap((step) => step.lines)
		.flatMap((line) => line)
		.filter((span) => span.text.startsWith("⏺"));
	assert.ok(toolSpans.length > 0, "expected Claude tool invocations");
	for (const span of toolSpans) assert.equal(span.tone, "brand");
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
	// `start-work-typed` (beat 1) is single-step, so use the multi-step backlog
	// beat (beat 2) to land mid-animation.
	let mid = harness.createInitialTerminalDemoState();
	mid = reducer(mid, { type: "begin-beat" }); // beat 0 (split)
	mid = reducer(mid, { type: "commit-step" }); // settle split
	mid = reducer(mid, { type: "begin-beat" }); // beat 1 (start-work-typed)
	mid = reducer(mid, { type: "commit-step" }); // settle start-work-typed
	mid = reducer(mid, { type: "begin-beat" }); // beat 2 (backlog-loaded)
	mid = reducer(mid, { type: "commit-step" }); // one step in, unsettled
	assert.equal(mid.settled, false);
	assert.deepEqual(reducer(mid, { type: "step-back" }), harness.foldBeats(harness.TERMINAL_DEMO_BEATS, 1));
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
	// Beats 0 ("split") and 1 ("start-work-typed") are single-step, so settle both
	// first, then begin beat 2 ("backlog-loaded", multi-step) and commit only its first
	// step to land mid-beat.
	state = reducer(state, { type: "begin-beat" });
	state = reducer(state, { type: "commit-step" });
	state = reducer(state, { type: "begin-beat" });
	state = reducer(state, { type: "commit-step" });
	state = reducer(state, { type: "begin-beat" });
	state = reducer(state, { type: "commit-step" });
	assert.equal(state.settled, false);

	const noop = reducer(state, { type: "begin-beat" });
	assert.deepEqual(noop, state);
});
