const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

let presentationModulePromise;

function loadPresentationModule() {
	if (!presentationModulePromise) {
		presentationModulePromise = esbuild
			.build({
				entryPoints: [path.join(__dirname, "presentation-story.ts")],
				bundle: true,
				format: "cjs",
				loader: { ".css": "empty" },
				platform: "node",
				tsconfig: path.join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(
				result.outputFiles[0].text,
				"jira-team-eu26-presentation-story-harness.cjs",
			));
	}

	return presentationModulePromise;
}

test("the presentation chapters follow the manager journey from Track to Terminal", async () => {
	const story = await loadPresentationModule();

	assert.deepEqual(
		story.JIRA_TEAM_EU26_PRESENTATION_CHAPTERS,
		[
			{ label: "Track", value: "track" },
			{ label: "Learn", value: "learn" },
			{ label: "Build", value: "build" },
			{ label: "Terminal", value: "terminal" },
		],
	);
});

test("the PAY board fills every existing status with coding work and the full state matrix", async () => {
	const story = await loadPresentationModule();
	const columns = story.createJiraTeamEu26PayBoardColumns();
	const cards = columns.flatMap((column) => column.cards);
	const currentUserInvoker = {
		avatarSrc: story.JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc,
		name: story.JIRA_TEAM_EU26_PAY_CURRENT_USER.name,
	};

	assert.deepEqual(
		[...story.JIRA_TEAM_EU26_PAY_STATUS_PHASES],
		["To do", "In progress", "In review", "Done"],
	);
	assert.deepEqual(
		columns.map((column) => column.title),
		[...story.JIRA_TEAM_EU26_PAY_STATUS_PHASES],
	);
	assert.ok(columns.every((column) => column.cards.length >= 3));
	assert.ok(columns.every((column) => column.count === column.cards.length));
	assert.ok(cards.every((card) => card.code.startsWith("PAY-")));
	assert.ok(!columns.some((column) => column.title === "Review"));
	assert.deepEqual(
		new Map(cards.flatMap((card) => (
			card.assignee ? [[card.assignee.id, card.assignee.avatarSrc]] : []
		))),
		new Map([
			["diego-santos", "/avatar-user/dev-rana/color/asow-dev-lime-64.png"],
			["jordan-okafor", "/avatar-user/issac-varghese/color/asow-product-purple-64.png"],
			["maya-ferreira", "/avatar-user/chloe-lee/color/asow-teamwork-blue-64.png"],
			["priya-raman", "/avatar-user/ting-chen/color/asow-strategy-orange-64.png"],
		]),
		"board assignees should keep their faces and use a shuffled mix of the five-color avatar sets",
	);
	assert.deepEqual(
		new Map(story.JIRA_TEAM_EU26_PAY_SESSION_MEMBERS
			.filter((member) => ["diego", "jordan", "maya", "priya"].includes(member.id))
			.map((member) => [member.id, member.avatarSrc])),
		new Map([
			["diego", "/avatar-user/dev-rana/color/asow-dev-lime-64.png"],
			["jordan", "/avatar-user/issac-varghese/color/asow-product-purple-64.png"],
			["maya", "/avatar-user/chloe-lee/color/asow-teamwork-blue-64.png"],
			["priya", "/avatar-user/ting-chen/color/asow-strategy-orange-64.png"],
		]),
		"unlinked sessions should use the same stable teammate faces and shuffled colors as the board",
	);

	const inReviewCodes = new Set(
		columns.find((column) => column.title === "In review")?.cards.map((card) => card.code) ?? [],
	);
	assert.ok(["PAY-112", "PAY-115", "PAY-119", "PAY-132"].every((code) => inReviewCodes.has(code)));

	const agentStates = new Set(
		cards.flatMap((card) => card.agentActivities?.map((activity) => activity.state) ?? []),
	);
	const agentCards = cards.filter((card) => (
		Boolean(card.agentActivities?.length) || Boolean(card.agentDoneRuns?.length)
	));
	const agentBrandNames = new Set(
		agentCards.flatMap((card) => [
			...(card.agentActivities?.map((activity) => activity.agentBrandName) ?? []),
			...(card.agentDoneRuns?.map((run) => run.agentBrandName) ?? []),
		]).filter(Boolean),
	);
	assert.ok(cards.some((card) => !card.agentActivities?.length && !card.agentDoneRuns?.length));
	assert.ok(agentStates.has("working"));
	assert.ok(agentStates.has("awaiting-input"));
	assert.ok(cards.some((card) => card.agentActivityMode === "completed" && card.agentDoneRuns?.length));
	assert.ok(agentCards.length <= 6, `expected a handful of agent cards, got ${agentCards.length}`);
	assert.ok(agentBrandNames.size >= 3, "running sessions should preserve distinct coding-agent brands");
	const allowedCodingAgentNames = new Set(["Claude", "Codex", "Cursor", "GitHub Copilot"]);
	assert.ok(story.JIRA_TEAM_EU26_PAY_BOARD_AGENTS.every((agent) => (
		allowedCodingAgentNames.has(agent.name)
	)));
	assert.ok(agentCards.every((card) => (
		(card.agentActivities ?? []).every((activity) => allowedCodingAgentNames.has(activity.name))
		&& (card.agentDoneRuns ?? []).every((run) => allowedCodingAgentNames.has(run.agentName))
	)));
	assert.ok(
		cards.some((card) => (
			(card.agentActivities?.filter((activity) => activity.state === "working").length ?? 0) >= 2
		)),
		"one card should show two agents working together",
	);
	const multiAgentCard = cards.find((card) => (
		(card.agentActivities?.filter((activity) => activity.state === "working").length ?? 0) >= 2
	));
	const workingActivities = multiAgentCard?.agentActivities?.filter((activity) => activity.state === "working") ?? [];
	assert.ok(workingActivities.every((activity) => (activity.labels?.length ?? 0) >= 3));
	assert.equal(
		new Set(workingActivities.flatMap((activity) => activity.labels ?? [])).size,
		workingActivities.reduce((count, activity) => count + (activity.labels?.length ?? 0), 0),
		"agents working together should not narrate the same tool-call labels",
	);
	assert.equal(
		new Set(workingActivities.map((activity) => activity.cycleIntervalMs)).size,
		workingActivities.length,
		"agents working together should have distinct base dwell times",
	);
	assert.ok(workingActivities.every((activity) => (activity.cycleIntervalJitterMs ?? 0) > 0));
	assert.equal(multiAgentCard?.code, "PAY-123");
	assert.deepEqual(
		workingActivities.map((activity) => ({
			host: activity.host,
			name: activity.name,
			role: activity.role,
			invokedBy: activity.invokedBy?.name,
		})),
		[
			{ host: "cloud", name: "Cursor", role: "viewer", invokedBy: "Jordan Okafor" },
			{ host: "local", name: "Claude", role: "owner", invokedBy: "Venn" },
		],
	);
	const ownerActivities = cards
		.flatMap((card) => card.agentActivities ?? [])
		.filter((activity) => activity.role === "owner");
	assert.deepEqual(
		ownerActivities.map((activity) => activity.id).sort(),
		[
			"PAY-105:test-agent",
			"PAY-112:review-agent",
			"PAY-121:release-agent",
			"PAY-123:claude-code",
		],
	);
	assert.ok(ownerActivities.every((activity) => (
		activity.invokedBy?.name === currentUserInvoker.name
		&& activity.invokedBy.avatarSrc === currentUserInvoker.avatarSrc
	)));

	assert.equal(story.JIRA_TEAM_EU26_PAY_CURRENT_USER.id, "venn");
	assert.equal(story.JIRA_TEAM_EU26_PAY_CURRENT_USER.name, "Venn");
	assert.equal(story.JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc, "/avatar-user/venn/venn.png");
	assert.deepEqual(
		story.JIRA_TEAM_EU26_PAY_HEADER_ASSIGNEES.map((assignee) => assignee.id),
		["venn", "review-agent", "test-agent", "release-agent"],
	);
	assert.deepEqual(
		story.JIRA_TEAM_EU26_PAY_HEADER_ASSIGNEES.map((assignee) => assignee.name),
		["Venn", "Codex", "Cursor", "GitHub Copilot"],
	);
	assert.ok(story.JIRA_TEAM_EU26_PAY_HEADER_ASSIGNEES.every((assignee) => (
		assignee.id === "venn" || assignee.avatarSrc.startsWith("/avatar-agent/")
	)));

	assert.deepEqual(
		new Set(cards.map((card) => card.pullRequestStatus).filter(Boolean)),
		new Set(["open", "failed", "merged"]),
	);

	const pay101 = cards.find((card) => card.code === "PAY-101");
	assert.equal(pay101.pullRequestNumber, 1839);
	assert.equal(pay101.pullRequestStatus, "merged");
	assert.equal(pay101.pullRequestPreview.title, "Map v1 call sites");
	assert.equal(pay101.pullRequestPreview.additions, 312);
	assert.equal(pay101.pullRequestPreview.deletions, 8);

	const prCards = cards.filter((card) => card.pullRequestNumber);
	assert.ok(prCards.length >= 12);
	assert.ok(prCards.every((card) => {
		const preview = card.pullRequestPreview;
		return (
			preview
			&& preview.additions > 0
			&& preview.repository
			&& preview.branch
			&& preview.author?.name
			&& Boolean(preview.relativeTime)
		);
	}));
	assert.equal(
		prCards.find((card) => card.code === "PAY-105")?.pullRequestPreview.relativeTime,
		"2h ago",
	);
	assert.notEqual(
		prCards.find((card) => card.code === "PAY-105")?.pullRequestPreview.title,
		prCards.find((card) => card.code === "PAY-104")?.pullRequestPreview.title,
		"shared PR numbers still get issue-keyed dummy titles",
	);

	const pay112 = cards.find((card) => card.code === "PAY-112")?.agentActivities?.[0];
	assert.equal(pay112?.name, "Codex");
	assert.equal(pay112?.role, "owner");
	assert.deepEqual(pay112?.invokedBy, currentUserInvoker);
	assert.equal(pay112?.state, "awaiting-input");
	assert.equal(pay112?.timeLabel, "Last week");
	assert.equal(pay112?.question?.label, story.JIRA_TEAM_EU26_PAY_112_RETENTION_QUESTION.label);
	assert.equal(pay112?.message, story.JIRA_TEAM_EU26_PAY_112_RETENTION_MESSAGE);
	assert.equal(pay112?.question?.options.length, 3);
	assert.doesNotMatch(pay112?.question?.label ?? "", /date-range|blue-green|PD-40/u);
	assert.deepEqual(
		workingActivities.map((activity) => activity.timeLabel),
		["36s", "3h"],
	);
});

test("a linked Jira activity becomes a medium-detached Agent Session item", async () => {
	const story = await loadPresentationModule();
	const card = story.createJiraTeamEu26PayBoardColumns()
		.flatMap((column) => column.cards)
		.find((candidate) => candidate.code === "PAY-105");
	const activity = card?.agentActivities?.[0];

	assert.ok(card);
	assert.ok(activity);
	const detached = story.toJiraTeamEu26DetachedAgentSession(activity, card);
	assert.deepEqual(
		detached,
		{
			id: activity.id,
			title: activity.label,
			state: "running",
			agent: {
				avatarSrc: activity.avatarSrc,
				brandName: activity.agentBrandName,
				id: activity.id,
				kind: "agent",
				name: activity.name,
			},
				host: "local",
				role: "owner",
				invokedBy: {
					avatarSrc: story.JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc,
					name: story.JIRA_TEAM_EU26_PAY_CURRENT_USER.name,
				},
				sessionDetails: {
				host: "local",
				issueKey: card.code,
				issueSummary: card.title,
			},
			timeLabel: "12m",
		},
	);
	assert.deepEqual(detached.invokedBy, {
		avatarSrc: story.JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc,
		name: story.JIRA_TEAM_EU26_PAY_CURRENT_USER.name,
	});
	assert.deepEqual(
		story.toJiraTeamEu26AgentActivityFromSession(detached),
		{
			id: activity.id,
			name: activity.name,
			avatarSrc: activity.avatarSrc,
			agentBrandName: activity.agentBrandName,
				host: "local",
				invokedBy: {
					avatarSrc: story.JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc,
					name: story.JIRA_TEAM_EU26_PAY_CURRENT_USER.name,
				},
				label: activity.label,
			role: "owner",
			state: "working",
			timeLabel: "12m",
		},
	);
});

test("unlinking a chin session restores it to the Untracked work list", async () => {
	const { unlinkJiraKanbanAgentSession } = require("../../../blocks/jira-kanban/state.ts");
	const { selectBoardUntrackedSessions } = require(
		"../../../blocks/jira-kanban/experimental/lib/board-untracked-sessions.ts",
	);
	const story = await loadPresentationModule();
	const columns = story.createJiraTeamEu26PayBoardColumns();
	const card = columns.flatMap((column) => column.cards).find((candidate) => candidate.code === "PAY-105");
	const activity = card?.agentActivities?.[0];
	const pulseSession = {
		agent: { id: "claude", kind: "agent", name: "Claude" },
		id: "lw-existing",
		sessionDetails: { host: "local", issueKey: "PAY-121", issueSummary: "Kill switch" },
		state: "complete",
		title: "Existing untracked session",
	};

	assert.ok(card);
	assert.ok(activity);

	const detached = story.toJiraTeamEu26DetachedAgentSession(activity, card);
	const nextColumns = unlinkJiraKanbanAgentSession(columns, card.code, activity.id);
	const unlinkedCard = nextColumns.flatMap((column) => column.cards).find((candidate) => candidate.code === "PAY-105");
	const untracked = selectBoardUntrackedSessions({
		detachedByCard: { [card.code]: [detached] },
		sessions: [pulseSession],
	});

	assert.equal(unlinkedCard?.agentActivities?.some((candidate) => candidate.id === activity.id), false);
	assert.deepEqual(untracked.map((session) => session.id), [pulseSession.id, activity.id]);
	assert.equal(untracked.at(-1)?.title, activity.label);
});

test("the board factory returns isolated cards and nested agent state", async () => {
	const story = await loadPresentationModule();
	const first = story.createJiraTeamEu26PayBoardColumns();
	const second = story.createJiraTeamEu26PayBoardColumns();

	assert.notEqual(first, second);
	assert.notEqual(first[0].cards, second[0].cards);
	assert.notEqual(first[0].cards[0], second[0].cards[0]);

	const firstActivityCard = first
		.flatMap((column) => column.cards)
		.find((card) => card.agentActivities?.length);
	const secondActivityCard = second
		.flatMap((column) => column.cards)
		.find((card) => card.code === firstActivityCard.code);
	assert.ok(firstActivityCard);
	assert.notEqual(firstActivityCard.agentActivities, secondActivityCard.agentActivities);
});

test("PAY-101 Build captures the inventory agent run and the first Insight's merged evidence", async () => {
	const story = await loadPresentationModule();
	const state = story.createJiraTeamEu26Pay101BuildState();

	assert.equal(story.JIRA_TEAM_EU26_PAY_101_WORK_ITEM.code, "PAY-101");
	assert.match(story.JIRA_TEAM_EU26_PAY_101_WORK_ITEM.title, /Inventory every v1 call site/u);
	assert.equal(state.activeSessionId, null, "Build should keep the initial Activity viewport at the top");
	assert.equal(state.sessions.length, 1);
	assert.equal(state.sessions[0].id, story.JIRA_TEAM_EU26_PAY_101_SESSION_ID);
	assert.equal(story.JIRA_TEAM_EU26_PAY_101_UNCAPTURED_SESSION_ID, "lw-scope-thread");
	assert.notEqual(
		state.sessions[0].id,
		story.JIRA_TEAM_EU26_PAY_101_UNCAPTURED_SESSION_ID,
		"the captured inventory run must stay distinct from the uncaptured rationale session",
	);
	assert.equal(state.sessions[0].status, "completed");
	assert.equal(state.sessions[0].activityVisibility, "public");
	assert.match(state.sessions[0].previewText, /61 call sites across four services/u);
	assert.ok(state.comments.some((comment) => /rationale remains uncaptured.*local Claude session/u.test(comment.content)));
	assert.doesNotMatch(
		state.sessions[0].messages.map((message) => message.content).join(" "),
		/captured the keep-or-delete reasoning|made (?:the|it) durable/u,
	);

	const allOutputs = [
		...state.sessions.flatMap((session) => session.outputs ?? []),
		...state.comments.flatMap((comment) => comment.outputs ?? []),
		...state.staticEvents.flatMap((event) => event.kind === "changed-files" ? event.outputs ?? [] : []),
	];
	const inventoryPr = allOutputs.find((output) => output.id === "pay-101-inventory-pr-1839");
	const inventoryCommit = allOutputs.find((output) => output.id === "pay-101-inventory-commit-8c2f4e1");

	assert.deepEqual(inventoryPr.pullRequest, {
		additions: 312,
		deletions: 8,
		number: 1839,
		status: "Merged",
	});
	assert.match(inventoryCommit.title, /8c2f4e1/u);

	const mergedPrEvent = state.staticEvents.find((event) => event.pullRequest?.number === 1839);
	assert.equal(mergedPrEvent.pullRequest.status, "Merged");
	assert.equal(mergedPrEvent.pullRequest.mergeState, "merged");
});

test("the PAY-specific agent exports cover the board and Build composer without SHOP aliases", async () => {
	const story = await loadPresentationModule();

	assert.ok(story.JIRA_TEAM_EU26_PAY_BOARD_AGENTS.length >= 4);
	assert.ok(story.JIRA_TEAM_EU26_PAY_COMPOSER_AGENTS.length >= 4);
	assert.ok(story.JIRA_TEAM_EU26_PAY_BOARD_AGENTS.some((agent) => agent.id === "claude-code"));
	assert.ok(story.JIRA_TEAM_EU26_PAY_COMPOSER_AGENTS.some((agent) => agent.id === "claude-code"));
});
