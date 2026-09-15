const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

async function loadHarness() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					jgpKanbanReducer,
					createInitialJgpKanbanState,
					resolveJgpKanbanColumns,
				} from "./components/projects/jira-golden-journeys-v1/lib/kanban-lifecycle";
				export {
					createJgpKanbanActivity,
					createJgpKanbanCompletionStoryColumns,
					createJgpKanbanColumns,
					JGP_CODE_REVIEW_FILES,
					JGP_CODE_REVIEW_WORK_ITEM,
					JGP_KANBAN_AGENTS,
					JGP_KANBAN_IN_PROGRESS_COLUMN,
					JGP_KANBAN_REVIEW_COLUMN,
				} from "./components/projects/jira-golden-journeys-v1/data/kanban-data";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "jira-golden-journeys-v1-kanban-lifecycle-harness.ts",
		},
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text);
}

function column(state, title) {
	return state.columns.find((candidate) => candidate.title === title);
}

function countLineChanges(oldContents, newContents) {
	const oldLines = oldContents.split("\n");
	const newLines = newContents.split("\n");
	let previous = new Uint16Array(newLines.length + 1);
	let next = new Uint16Array(newLines.length + 1);

	for (const oldLine of oldLines) {
		for (let index = 1; index <= newLines.length; index += 1) {
			next[index] = oldLine === newLines[index - 1]
				? previous[index - 1] + 1
				: Math.max(previous[index], next[index - 1]);
		}
		[previous, next] = [next, previous];
		next.fill(0);
	}

	const unchangedLines = previous[newLines.length];
	return {
		additions: newLines.length - unchangedLines,
		deletions: oldLines.length - unchangedLines,
	};
}

test("JGP scenarios use the focus-work lifecycle and deterministic snapshots", async () => {
	const { createInitialJgpKanbanState } = await loadHarness();
	const review = createInitialJgpKanbanState("local-review");
	const completed = createInitialJgpKanbanState("local-completed");
	const global = createInitialJgpKanbanState("global-assignment");

	for (const state of [review, completed, global]) {
		assert.deepEqual(state.columns.map((item) => item.title), ["To do", "In progress", "Review", "Done"]);
		assert.ok(state.columns.every((item) => item.count === item.cards.length));
	}
	assert.deepEqual(column(review, "To do").cards.map((card) => card.code), ["JGP-231", "JGP-244", "JGP-217"]);
	assert.deepEqual(column(review, "In progress").cards.map((card) => card.code), ["JGP-241", "JGP-242", "JGP-243"]);
	assert.deepEqual(column(review, "Review").cards.map((card) => card.code), ["JGP-247", "JGP-239", "JGP-232", "JGP-234"]);
	assert.deepEqual(column(review, "Done").cards.map((card) => card.code), ["JGP-240", "JGP-236", "JGP-238"]);
	const localTagCounts = review.columns.flatMap((item) => item.cards.map((card) => card.tags.length));
	assert.ok(localTagCounts.every((count) => count >= 1 && count <= 3));
	assert.deepEqual([...new Set(localTagCounts)].sort(), [1, 2, 3]);
	assert.deepEqual(column(completed, "Review").cards.map((card) => card.code), ["JGP-239", "JGP-232", "JGP-234"]);
	assert.deepEqual(column(completed, "Done").cards.map((card) => card.code), ["JGP-247", "JGP-240", "JGP-236", "JGP-238"]);
	assert.equal(column(completed, "Done").cards[0].pullRequestNumber, 247);
	assert.equal(column(completed, "Done").cards[0].pullRequestStatus, "merged");
	assert.ok(column(review, "Done").cards.every((card) => !card.agentActivityMode && !card.agentDoneRuns));
	assert.ok(column(completed, "Done").cards.every((card) => !card.agentActivityMode && !card.agentDoneRuns));
	assert.deepEqual(
		new Set(review.columns.flatMap((item) => item.cards.map((card) => card.assignee?.name))),
		new Set(["Carl", "Sarah", "Maya Chen", "Owen Kim", "Sofia Garcia", "Elena Ruiz", "Noah Patel"]),
	);
	assert.deepEqual(
		column(review, "In progress").cards.map((card) => card.agentActivityMode),
		["working", undefined, "awaiting-input"],
	);
	const activeActivities = column(review, "In progress").cards[0].agentActivities;
	assert.deepEqual(activeActivities.map((activity) => activity.name), ["Cursor", "Code Reviewer"]);
	assert.equal(activeActivities[0].agentBrandName, "cursor");
	assert.match(activeActivities[1].avatarSrc, /^\/avatar-agent\//u);
	assert.ok(activeActivities.every((activity) => activity.message && activity.initialElapsedSeconds > 0));
	assert.ok(activeActivities.every((activity) => (activity.labels?.length ?? 0) >= 3));
	const carlCodes = review.columns
		.flatMap((item) => item.cards)
		.filter((card) => card.assignee?.name === "Carl")
		.map((card) => card.code);
	assert.deepEqual(carlCodes, ["JGP-247", "JGP-239", "JGP-232", "JGP-234"]);
	const wiredRuns = review.columns
		.flatMap((item) => item.cards)
		.flatMap((card) => card.agentDoneRuns ?? [])
		.filter((run) => run.outputs?.some((output) => output.pullRequest));
	assert.deepEqual(wiredRuns.map((run) => run.issueKey), ["JGP-247", "JGP-239", "JGP-234"]);
	assert.ok(wiredRuns.every((run) => run.agentBrandName === "claude"));
	const customRuns = review.columns
		.flatMap((item) => item.cards)
		.flatMap((card) => card.agentDoneRuns ?? [])
		.filter((run) => !run.agentBrandName);
	const customActivities = review.columns
		.flatMap((item) => item.cards)
		.flatMap((card) => card.agentActivities ?? [])
		.filter((activity) => !activity.agentBrandName);
	const customAgents = [
		...customActivities.map((activity) => [activity.name, activity.avatarSrc]),
		...customRuns.map((run) => [run.agentName, run.agentAvatarSrc]),
	];
	assert.deepEqual(customAgents.map(([name]) => name), [
		"Code Reviewer",
		"Dependency Mapper",
		"Unit Test Creator",
		"Accessibility Tester",
	]);
	assert.equal(new Set(customAgents.map(([, avatarSrc]) => avatarSrc)).size, 4);
	assert.ok(customRuns.every((run) => (run.outputs?.length ?? 0) > 0));
	assert.ok(customRuns.every((run) => run.outputs.every((output) => !output.pullRequest)));
	assert.ok(customRuns.every((run) => run.actionLabel === "View"));
	assert.ok(wiredRuns.every((run) => run.actionLabel === undefined));
	assert.deepEqual(
		customRuns.flatMap((run) => run.outputs).map((output) => [
			output.source,
			output.owner,
			output.iconName,
			output.avatarSrc,
			output.tileVariant,
		]),
		[
			["Confluence", "Page", "page", undefined, undefined],
			["Loom", "Video", "video", undefined, undefined],
		],
	);
	const agentCards = review.columns
		.flatMap((item) => item.cards)
		.filter((card) => card.agentActivityMode);
	assert.deepEqual(
		agentCards.map((card) => card.code),
		["JGP-241", "JGP-243", "JGP-247", "JGP-239", "JGP-232", "JGP-234"],
	);
	assert.deepEqual(
		agentCards.filter((card) => (card.agentActivities?.length ?? card.agentDoneRuns?.length ?? 0) === 2)
			.map((card) => card.code),
		["JGP-241", "JGP-239"],
	);
	assert.deepEqual(column(global, "To do").cards.map((card) => card.code), [
		"JGP-251", "JGP-252", "JGP-253", "JGP-254", "JGP-255",
		"JGP-257", "JGP-258", "JGP-259", "JGP-260",
	]);
	assert.deepEqual(column(global, "In progress").cards.map((card) => card.code), ["JGP-248", "JGP-249"]);
	assert.deepEqual(column(global, "Review").cards.map((card) => card.code), ["JGP-250", "JGP-256"]);
	assert.deepEqual(column(global, "Done").cards.map((card) => card.code), ["JGP-246", "JGP-247"]);
	assert.ok(column(global, "To do").cards.slice(0, 5).every((card) => card.assignee.name === "Sarah"));
	assert.deepEqual(
		column(global, "To do").cards.slice(5).map((card) => card.assignee.name),
		["Maya Chen", "Elena Ruiz", "Noah Patel", "Sofia Garcia"],
	);
	assert.deepEqual(
		new Set(global.columns.flatMap((item) => item.cards.map((card) => card.assignee?.name))),
		new Set(["Sarah", "Maya Chen", "Owen Kim", "Elena Ruiz", "Noah Patel", "Sofia Garcia", "Carl"]),
	);
});

test("Carl's review card exposes the existing Claude PR run", async () => {
	const { createJgpKanbanColumns, JGP_CODE_REVIEW_FILES, JGP_CODE_REVIEW_WORK_ITEM } = await loadHarness();
	const card = createJgpKanbanColumns("local-review").find((item) => item.title === "Review").cards[0];
	const run = card.agentDoneRuns[0];

	assert.equal(card.assignee.name, "Carl");
	assert.equal(card.agentActivityMode, "completed");
	assert.equal(card.pullRequestNumber, 247);
	assert.equal(card.pullRequestStatus, "open");
	assert.equal(run.agentName, "Claude");
	assert.equal(run.agentBrandName, "claude");
	assert.equal(run.pullRequestNumber, 247);
	assert.equal(run.outputs[0].pullRequest.status, "Open");
	assert.deepEqual(JGP_CODE_REVIEW_WORK_ITEM, {
		key: "JGP-247",
		title: "Add assignee focus mode",
		environment: "Development",
		repoName: "atlassian/jira",
		localBranchName: "carl/jgp-247-assignee-focus-mode",
		branchName: "main",
	});
	assert.equal(JGP_CODE_REVIEW_FILES[0].path, "components/kanban/assignee-focus.ts");
	assert.equal(JGP_CODE_REVIEW_FILES.reduce((total, file) => total + file.additions, 0), 86);
	assert.equal(JGP_CODE_REVIEW_FILES.reduce((total, file) => total + file.deletions, 0), 18);
	assert.deepEqual(
		countLineChanges(
			JGP_CODE_REVIEW_FILES[0].oldContents,
			JGP_CODE_REVIEW_FILES[0].newContents,
		),
		{ additions: 64, deletions: 16 },
	);
	assert.deepEqual(
		new Set(JGP_CODE_REVIEW_FILES.slice(1).map((file) => file.explorerPath)),
		new Set([
			".editorconfig",
			".eslintignore",
			".git-blame-ignore",
			".gitattributes",
			".gitignore",
			".mailmap",
			".mention-bot",
			".yarnrc",
			"yarn.lock",
			"gulpfile.js",
			".eslintrc.json",
			".lsifrc.json",
			"cglicenses.json",
			"cgmanifest.json",
			"package.json",
			"product.json",
			"tsfmt.json",
			"CONTRIBUTING.md",
			"ipc.mp.test.ts",
		]),
	);
});

test("JGP-247 completion story moves an open PR from In progress to Done as merged", async () => {
	const { createJgpKanbanCompletionStoryColumns } = await loadHarness();
	const inProgress = createJgpKanbanCompletionStoryColumns("in-progress");
	const done = createJgpKanbanCompletionStoryColumns("done");
	const inProgressCard = column({ columns: inProgress }, "In progress").cards.find((card) => card.code === "JGP-247");
	const doneCard = column({ columns: done }, "Done").cards.find((card) => card.code === "JGP-247");

	assert.equal(inProgressCard.pullRequestNumber, 247);
	assert.equal(inProgressCard.pullRequestStatus, "open");
	assert.equal(column({ columns: inProgress }, "Done").cards.some((card) => card.code === "JGP-247"), false);
	assert.equal(doneCard.pullRequestNumber, 247);
	assert.equal(doneCard.pullRequestStatus, "merged");
});

test("Cursor exists only in the route-owned JGP agent set", async () => {
	const { JGP_KANBAN_AGENTS } = await loadHarness();
	assert.deepEqual(JGP_KANBAN_AGENTS.map((agent) => [agent.id, agent.name]), [
		["claude-code", "Claude"],
		["cursor", "Cursor"],
	]);
});

test("bulk Cursor assignment moves all five tasks alongside human work in In progress", async () => {
	const { createInitialJgpKanbanState, jgpKanbanReducer, resolveJgpKanbanColumns } = await loadHarness();
	let state = createInitialJgpKanbanState("global-assignment");
	const codes = ["JGP-251", "JGP-252", "JGP-253", "JGP-254", "JGP-255"];
	state = jgpKanbanReducer(state, { type: "assign-agent", cardCodes: codes, agent: { id: "cursor", name: "Cursor" } });

	assert.deepEqual(column(state, "In progress").cards.map((card) => card.code), [...codes, "JGP-248", "JGP-249"]);
	assert.deepEqual(column(state, "To do").cards.map((card) => card.code), ["JGP-257", "JGP-258", "JGP-259", "JGP-260"]);
	assert.ok(codes.every((code) => state.lifecycleByCode[code].agentIds[0] === "cursor"));
	const activities = resolveJgpKanbanColumns(state)
		.find((item) => item.title === "In progress").cards
		.filter((card) => codes.includes(card.code))
		.map((card) => card.agentActivities[0]);
	assert.ok(activities.every((activity) => activity.name === "Cursor" && activity.state === "working"));
	assert.ok(new Set(activities.map((activity) => activity.label)).size > 1);
});

test("Sarah's global assignments stay In progress across assignment paths and agents", async () => {
	const {
		createInitialJgpKanbanState,
		jgpKanbanReducer,
		resolveJgpKanbanColumns,
		JGP_KANBAN_IN_PROGRESS_COLUMN,
		JGP_KANBAN_REVIEW_COLUMN,
	} = await loadHarness();
	let state = createInitialJgpKanbanState("global-assignment");
	const assignments = [
		{ agent: { id: "cursor", name: "Cursor" }, cardCodes: ["JGP-251", "JGP-252"] },
		{ agent: { id: "unit-test-creator", name: "Unit Test Creator" }, cardCodes: ["JGP-253", "JGP-254"] },
	];
	const draggedCardCode = "JGP-255";
	const assignedCodes = [...assignments.flatMap(({ cardCodes }) => cardCodes), draggedCardCode];

	for (const { agent, cardCodes } of assignments) {
		state = jgpKanbanReducer(state, {
			type: "assign-agent",
			agent,
			cardCodes,
		});
	}
	state = jgpKanbanReducer(state, {
		type: "drag-start",
		cardCode: draggedCardCode,
		sourceColumnTitle: "To do",
	});
	state = jgpKanbanReducer(state, {
		type: "drop",
		targetColumnTitle: JGP_KANBAN_IN_PROGRESS_COLUMN,
		agent: { id: "github-copilot", name: "GitHub Copilot" },
	});
	for (const cardCode of assignedCodes) {
		state = jgpKanbanReducer(state, { type: "complete", cardCode });
	}

	assert.ok(assignedCodes.every((code) => state.columns
		.flatMap((item) => item.cards)
		.find((card) => card.code === code)?.assignee?.name === "Sarah"));
	assert.ok(assignedCodes.every(
		(code) => column(state, JGP_KANBAN_IN_PROGRESS_COLUMN).cards.some((card) => card.code === code),
	));
	assert.ok(assignedCodes.every(
		(code) => !column(state, JGP_KANBAN_REVIEW_COLUMN).cards.some((card) => card.code === code),
	));
	assert.ok(assignedCodes.every((code) => state.lifecycleByCode[code].phase === "generating"));
	const activeCards = column(
		{ columns: resolveJgpKanbanColumns(state) },
		JGP_KANBAN_IN_PROGRESS_COLUMN,
	).cards
		.filter((card) => assignedCodes.includes(card.code));
	assert.ok(activeCards.every((card) => card.agentActivityMode === "working"));
	assert.ok(activeCards.every((card) => card.agentActivities.every((activity) => activity.state === "working")));
	assert.ok(activeCards.every((card) => card.agentDoneRuns === undefined));
	assert.ok(activeCards.every((card) => card.agentActivities.every(
		(activity) => !/Completed|Review/u.test(`${activity.label} ${activity.message}`),
	)));
});

test("normal local workflow completion still moves to Review", async () => {
	const {
		createInitialJgpKanbanState,
		jgpKanbanReducer,
		resolveJgpKanbanColumns,
	} = await loadHarness();
	let state = createInitialJgpKanbanState("local-review");
	state = jgpKanbanReducer(state, { type: "assign-agent", cardCodes: ["JGP-231"], agent: { id: "cursor", name: "Cursor" } });
	state = jgpKanbanReducer(state, { type: "complete", cardCode: "JGP-231" });
	const card = resolveJgpKanbanColumns(state)
		.find((item) => item.title === "Review").cards
		.find((item) => item.code === "JGP-231");

	assert.equal(card.code, "JGP-231");
	assert.equal(card.agentDoneRuns[0].agentName, "Cursor");
	assert.match(card.agentDoneRuns[0].summary, /Review/u);
});

test("shift selection only includes cards visible in filtered columns", async () => {
	const { createInitialJgpKanbanState, jgpKanbanReducer } = await loadHarness();
	let state = createInitialJgpKanbanState("global-assignment");
	const selectionColumns = state.columns.map((item) => ({
		...item,
		cards: item.cards.filter((card) => card.code !== "JGP-252"),
	}));
	state = jgpKanbanReducer(state, {
		type: "select", cardCode: "JGP-251", columnTitle: "To do", indexInColumn: 0,
		modifiers: { metaOrCtrlKey: false, shiftKey: false }, selectionColumns,
	});
	state = jgpKanbanReducer(state, {
		type: "select", cardCode: "JGP-253", columnTitle: "To do", indexInColumn: 1,
		modifiers: { metaOrCtrlKey: false, shiftKey: true }, selectionColumns,
	});
	assert.deepEqual([...state.selectedCardCodes].sort(), ["JGP-251", "JGP-253"]);
});

test("dropping delivered work into Done clears its lifecycle footer", async () => {
	const { createInitialJgpKanbanState, jgpKanbanReducer, resolveJgpKanbanColumns } = await loadHarness();
	let state = createInitialJgpKanbanState("local-review");
	state = jgpKanbanReducer(state, { type: "assign-agent", cardCodes: ["JGP-231"], agent: { id: "cursor" } });
	state = jgpKanbanReducer(state, { type: "complete", cardCode: "JGP-231" });
	state = jgpKanbanReducer(state, { type: "drag-start", cardCode: "JGP-231", sourceColumnTitle: "Review" });
	state = jgpKanbanReducer(state, { type: "drop", targetColumnTitle: "Done" });

	assert.equal(state.lifecycleByCode["JGP-231"], undefined);
	const card = resolveJgpKanbanColumns(state)
		.find((item) => item.title === "Done").cards
		.find((item) => item.code === "JGP-231");
	assert.equal(card.code, "JGP-231");
	assert.equal(card.agentDoneRuns, undefined);
});
