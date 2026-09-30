const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

let presentationModulePromise;
let wacModulePromise;

function loadDataModule(fileName) {
	return esbuild.build({
		entryPoints: [path.join(__dirname, `${fileName}.ts`)],
		bundle: true,
		format: "cjs",
		loader: { ".css": "empty" },
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	}).then((result) => loadCjsModuleFromText(
		result.outputFiles[0].text,
		`jira-team-eu26-${fileName}-harness.cjs`,
	));
}

function loadWacModule() {
	wacModulePromise ??= loadDataModule("wac-content");
	return wacModulePromise;
}

test("both content presets share the coding and custom agent catalog", async () => {
	const board = await loadDataModule("presentation-board");
	const wac = await loadWacModule();
	assert.ok(Array.isArray(board.JIRA_TEAM_EU26_BOARD_AGENTS));
	assert.deepEqual(board.JIRA_TEAM_EU26_BOARD_AGENTS.slice(0, 5), wac.WAC_BOARD_AGENTS);
	assert.deepEqual(board.JIRA_TEAM_EU26_BOARD_AGENTS.map((agent) => agent.name), [
		"Claude", "Cursor", "Codex", "GitHub Copilot", "Figma",
		"Code Reviewer", "Release Notes Drafter", "Bug Report Assistant",
	]);
	assert.equal(new Set(board.JIRA_TEAM_EU26_BOARD_AGENTS.map((agent) => agent.id)).size, 8);
	for (const agent of board.JIRA_TEAM_EU26_BOARD_AGENTS) {
		assert.ok(agent.avatarSrc || agent.brandName);
		assert.ok(fs.existsSync(path.join(process.cwd(), "public", agent.avatarSrc)));
	}
});

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

test("PAY-101 finished run retains the human from its original prompt", async () => {
	const story = await loadPresentationModule();
	const card = story.createJiraTeamEu26PayBoardColumns()
		.flatMap((column) => column.cards).find((item) => item.code === "PAY-101");
	const prompt = story.createJiraTeamEu26Pay101BuildState().sessions[0].messages
		.find((message) => message.role === "human");
	assert.deepEqual(card.agentDoneRuns[0].invokedBy, {
		name: prompt.authorName,
		avatarSrc: prompt.authorAvatarSrc,
	});
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
		["venn", "claude-code", "review-agent", "test-agent"],
	);
	assert.deepEqual(
		story.JIRA_TEAM_EU26_PAY_HEADER_ASSIGNEES.map((assignee) => assignee.name),
		["Venn", "Claude", "Jira Coding Agent", "Cursor"],
	);
	assert.ok(story.JIRA_TEAM_EU26_PAY_HEADER_ASSIGNEES.every((assignee) => (
		assignee.id === "venn" || assignee.avatarSrc.includes("/agent-lanyard/")
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
	assert.ok(prCards.every((card) => !/ ago$/u.test(card.pullRequestPreview.relativeTime)));
	assert.equal(
		prCards.find((card) => card.code === "PAY-105")?.pullRequestPreview.relativeTime,
		"2h",
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

test("WAC content preserves the authored eleven-card Checkout roadmap", async () => {
	const wac = await loadWacModule();
	const columns = wac.createJiraTeamEu26WacBoardColumns();
	assert.equal(wac.WAC_BOARD_TITLE, "Checkout roadmap");
	assert.deepEqual(columns.map((column) => ({ title: column.title, count: column.count, codes: column.cards.map((card) => card.code) })), [
		{ title: "To do", count: 3, codes: ["PAY-118", "PAY-124", "PAY-125"] },
		{ title: "In progress", count: 3, codes: ["PAY-105", "PAY-107", "PAY-123"] },
		{ title: "In review", count: 3, codes: ["PAY-112", "PAY-115", "PAY-119"] },
		{ title: "Done", count: 2, codes: ["PAY-101", "PAY-113"] },
	]);
	assert.deepEqual(columns.flatMap((column) => column.cards).map((card) => [card.code, card.title, card.tags.map((tag) => tag.text)]), [
		["PAY-118", "Implement Google Pay option for Android checkout", ["checkout-mobile"]],
		["PAY-124", "Add automatic retry mechanism for failed webhooks", ["webhooks"]],
		["PAY-125", "Design subscription renewal receipt email template", ["notifications"]],
		["PAY-105", "Integrate 3D Secure 2.0 card verification flow", ["checkout-web", "3ds"]],
		["PAY-107", "Build customer refund API endpoint for support dash", ["payments-api"]],
		["PAY-123", 'Add "Save card for future purchases" toggle on checkout', ["wallet"]],
		["PAY-112", "Add PCI-DSS compliance audit logging to token service", ["compliance"]],
		["PAY-115", "Build real-time payment success and decline rate dashboard", ["observability"]],
		["PAY-119", "Optimize transaction history database query latency", ["database"]],
		["PAY-101", "Add Apple Pay button to checkout screen", ["checkout-ui"]],
		["PAY-113", "Update credit card expiration date validation logic", ["validation"]],
	]);
});

test("WAC agent comments run the named sessions and retain the Apple Pay finished result", async () => {
	const wac = await loadWacModule();
	const cards = wac.createJiraTeamEu26WacBoardColumns().flatMap((column) => column.cards);
	for (const card of cards.slice(0, 2)) {
		assert.equal(card.agentActivities, undefined);
		assert.equal(card.agentActivityMode, undefined);
		assert.equal(card.agentDoneRuns, undefined);
	}
	assert.deepEqual(cards.filter((card) => card.agentActivities?.length).map((card) => [card.code, card.agentActivities[0].name, card.agentActivities[0].state]), [
		["PAY-125", "Figma", "working"],
		["PAY-107", "Codex", "working"], ["PAY-123", "Codex", "working"], ["PAY-112", "GitHub Copilot", "awaiting-input"],
		["PAY-115", "Cursor", "working"], ["PAY-119", "Cursor", "working"],
	]);
	assert.ok(cards.every((card) => (card.agentActivities ?? []).every((activity) => !activity.question)));
	const finished = cards.find((card) => card.code === "PAY-101");
	assert.equal(finished.agentActivityMode, "completed");
	assert.equal(finished.agentDoneRuns[0].agentName, "Claude");
	assert.equal(finished.agentDoneRuns[0].issueSummary, finished.title);
	assert.equal(finished.agentDoneRuns[0].outputs, undefined);
	const integration = cards.find((card) => card.code === "PAY-105");
	assert.equal(integration.agentActivities, undefined);
	assert.equal(integration.agentDoneRuns, undefined);
	const expirationValidation = cards.find((card) => card.code === "PAY-113");
	assert.equal(expirationValidation.agentActivities, undefined);
	assert.equal(expirationValidation.agentActivityMode, "completed");
	assert.equal(expirationValidation.agentDoneRuns[0].agentName, "Codex");
	assert.equal(expirationValidation.agentDoneRuns[0].state, "done");
	assert.equal(expirationValidation.agentDoneRuns[0].description, "Updated credit card expiration date validation logic.");
	assert.doesNotMatch(JSON.stringify(cards), /LegacyGatewayAdapter|sandbox key retention|61 call sites|inventory run/u);
	assert.deepEqual(wac.WAC_BOARD_AGENTS.map((agent) => agent.name), ["Claude", "Cursor", "Codex", "GitHub Copilot", "Figma"]);
	assert.ok(wac.WAC_HEADER_ASSIGNEES.some((assignee) => assignee.id === "wac-figma"));
	assert.equal(wac.WAC_HEADER_ASSIGNEES[0].name, "Diego Santos");
	assert.deepEqual(wac.WAC_HEADER_ASSIGNEES.filter((assignee) => !assignee.id.startsWith("wac-")).map((assignee) => assignee.name), [
		"Diego Santos", "Jordan Okafor", "Maya Ferreira", "Priya Raman",
	]);
	assert.ok(wac.WAC_HEADER_ASSIGNEES.every((assignee) => assignee.name !== "Venn"));
	assert.equal(new Set(wac.WAC_HEADER_ASSIGNEES.map((assignee) => assignee.id)).size, 9);
});

test("WAC factories keep the original PAY story and every nested mutable value isolated", async () => {
	const [wac, story] = await Promise.all([loadWacModule(), loadPresentationModule()]);
	const original = story.createJiraTeamEu26PayBoardColumns();
	const first = wac.createJiraTeamEu26WacBoardColumns();
	const second = wac.createJiraTeamEu26WacBoardColumns();
	first[0].cards[0].title = "Edited title";
	first[0].cards[0].tags[0].text = "Edited tag";
	first[0].cards[2].agentActivities[0].invokedBy.name = "Edited invoker";
	first[1].statuses.push("Edited status");
	assert.equal(second[0].cards[0].title, "Implement Google Pay option for Android checkout");
	assert.equal(second[0].cards[0].tags[0].text, "checkout-mobile");
	assert.notEqual(second[0].cards[2].agentActivities[0].invokedBy.name, "Edited invoker");
	assert.deepEqual(second[1].statuses, ["In progress", "Paused"]);
	assert.match(original[0].cards[0].title, /Carry card-artwork/u);
});

test("the WAC persona replaces Venn in profiles, session badges and new assignments", async () => {
	const [wac, story] = await Promise.all([loadWacModule(), loadPresentationModule()]);
	assert.equal(wac.WAC_CURRENT_USER.name, "Diego Santos");
	assert.equal(story.JIRA_TEAM_EU26_PAY_CURRENT_USER.name, "Venn");
	assert.ok(wac.WAC_SESSION_MEMBERS.every((member) => member.name !== "Venn" && !member.avatarSrc.includes("/venn/")));
	const sessions = [...wac.WAC_AGENT_SESSIONS, ...wac.WAC_SEEDED_AGENT_SESSION_OVERRIDES.values()];
	assert.ok(sessions.every((session) => !session.memberIds.includes("venn")));
	const cards = wac.createJiraTeamEu26WacBoardColumns().flatMap((column) => column.cards);
	const invokers = cards.flatMap((card) => [...(card.agentActivities ?? []), ...(card.agentDoneRuns ?? [])])
		.map((session) => session.invokedBy);
	assert.ok(invokers.every((invoker) => invoker.name === "Diego Santos" && invoker.avatarSrc === wac.WAC_CURRENT_USER.avatarSrc));
	const columns = wac.createJiraTeamEu26WacBoardColumns();
	columns[0].cards[0].assignee = { ...story.JIRA_TEAM_EU26_PAY_CURRENT_USER };
	columns[0].cards[0].avatarSrc = story.JIRA_TEAM_EU26_PAY_CURRENT_USER.avatarSrc;
	columns[1].cards[1].agentActivities[0].invokedBy = { name: "Venn", avatarSrc: "/avatar-user/venn/venn.png" };
	const normalized = wac.normalizeWacBoardCurrentUser(columns);
	assert.equal(normalized[0].cards[0].assignee.name, "Diego Santos");
	assert.equal(normalized[0].cards[0].avatarSrc, wac.WAC_CURRENT_USER.avatarSrc);
	assert.equal(normalized[1].cards[1].agentActivities[0].invokedBy.name, "Diego Santos");
	assert.equal(columns[0].cards[0].assignee.name, "Venn");
	assert.equal(normalized[2], columns[2]);
});

test("WAC review agents finish without moving cards or changing other sessions", async () => {
	const wac = await loadWacModule();
	const initial = wac.createJiraTeamEu26WacBoardColumns();
	const finished = wac.finishWacReviewAgents(initial);
	assert.deepEqual(finished.map((column) => column.cards.map((card) => card.code)), initial.map((column) => column.cards.map((card) => card.code)));
	assert.equal(finished[0], initial[0]);
	assert.equal(finished[1], initial[1]);
	assert.equal(finished[3], initial[3]);
	for (const code of ["PAY-115", "PAY-119"]) {
		const card = finished[2].cards.find((item) => item.code === code);
		assert.equal(card.agentActivities, undefined);
		assert.equal(card.agentActivityMode, "completed");
		assert.equal(card.agentDoneRuns[0].agentName, "Cursor");
		assert.equal(card.agentDoneRuns[0].state, "done");
		assert.equal(card.agentDoneRuns[0].issueKey, code);
		assert.equal(card.agentDoneRuns[0].invokedBy.name, "Diego Santos");
		assert.equal(card.agentDoneRuns[0].stateTransition, "agent-session");
		assert.equal(initial[2].cards.find((item) => item.code === code).agentActivities[0].stateTransition, "agent-session");
		assert.equal(initial[2].cards.find((item) => item.code === code).agentActivities[0].state, "working");
	}
	assert.equal(finished[2].cards[0], initial[2].cards[0]);
	assert.equal(wac.finishWacReviewAgents(finished), finished);
});

test("WAC timed completion respects removed or replaced review agents", async () => {
	const wac = await loadWacModule();
	const columns = wac.createJiraTeamEu26WacBoardColumns();
	columns[2].cards[1].agentActivities = undefined;
	columns[2].cards[2].agentActivities[0].id = "PAY-119:new-session";
	assert.equal(wac.finishWacReviewAgents(columns), columns);
});

test("WAC unlinked sessions isolate 48 identities while preserving the authored copy", async () => {
	const [wac, original] = await Promise.all([loadWacModule(), loadDataModule("agent-session-sync")]);
	const seeds = [...wac.WAC_SEEDED_AGENT_SESSION_OVERRIDES.values()];
	const synced = wac.WAC_AGENT_SESSIONS;
	const originalSessions = [...original.JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES.values(), ...original.JIRA_TEAM_EU26_SYNC_SESSIONS];
	const originalIds = new Set(originalSessions.map((session) => session.id));
	assert.equal(seeds.length, 16);
	assert.equal(synced.length, 32);
	assert.equal(seeds.length + synced.length, 48);
	assert.equal(new Set([...seeds, ...synced].map((session) => session.id)).size, 48);
	assert.ok([...seeds, ...synced].every((session) => session.id.startsWith("wac:") && !originalIds.has(session.id)));
	assert.deepEqual(new Set([...seeds, ...synced].map((session) => session.id.slice(4))), originalIds);
	assert.deepEqual([...wac.WAC_SEEDED_AGENT_SESSION_OVERRIDES.keys()], [...original.JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES.keys()]);
	for (const [lookupId, session] of wac.WAC_SEEDED_AGENT_SESSION_OVERRIDES) {
		assert.equal(session.id, `wac:${lookupId}`);
	}
	const authoredOrder = ["final-readiness", "capture-metrics", "decline-parity", "payout-recovery", "auth-fallback", "retry-headers", "rollback-metrics", "account-locks", "fee-rounding", "token-rotation"]
		.map((id) => synced.find((session) => session.id === `wac:lw-sync-${id}`));
	assert.deepEqual(authoredOrder.map((session) => session.shortTitle), [
		"Add audit logging for customer refunds", "Standardize payment decline error codes", "Update runbook docs",
		"Recover failed merchant payout batches", "Lock database records during account migration", "Retry header audit",
		"Rollback metric thresholds", "Trace gateway outage failures", "Fee rounding edge cases", "Rotate payment API security tokens",
	]);
	assert.deepEqual(authoredOrder.slice(0, 5).map((session) => session.agentId), ["claude", "copilot", "copilot", "codex", "cursor"]);
	assert.ok(authoredOrder.slice(0, 5).every((session) => session.title === session.shortTitle));
	assert.equal(authoredOrder[1].state, "running");
	assert.equal(authoredOrder[0].state, "running");
	assert.equal(authoredOrder[6].title, "Rollback metric thresholds");
	assert.equal(authoredOrder[9].state, "complete");
});

test("WAC sessions follow the default arrival order and initial lifecycle cohorts", async () => {
	const [wac, original] = await Promise.all([loadWacModule(), loadDataModule("agent-session-sync")]);
	assert.deepEqual(wac.WAC_AGENT_SESSIONS.map((session) => session.id.slice(4)), original.JIRA_TEAM_EU26_SYNC_SESSIONS.map((session) => session.id));
	assert.deepEqual(wac.WAC_AGENT_SESSIONS.map((session) => session.state), original.JIRA_TEAM_EU26_SYNC_SESSIONS.map((session) => session.state));
	const config = wac.WAC_AGENT_SESSION_SYNC_SOURCE;
	for (const session of config.sessions) {
		assert.equal(config.cohortById.get(session.id), original.JIRA_TEAM_EU26_SYNC_SESSION_COHORT_BY_ID.get(session.id.slice(4)));
	}
	const target = "wac:lw-sync-webhook-gap";
	const blocked = original.advanceJiraTeamEu26SyncSession(config.sessions, new Map(), target, config.cohortById);
	assert.equal(blocked.nextState, "needs-input");
	assert.equal(blocked.sessions[0].id, target);
	assert.equal(blocked.stateChangeVersions.get(target), 1);
	const completed = original.advanceJiraTeamEu26SyncSession(blocked.sessions, blocked.stateChangeVersions, target, config.cohortById);
	assert.equal(completed.nextState, "complete");
	assert.equal(completed.stateChangeVersions.get(target), 2);
	assert.deepEqual(original.takeJiraTeamEu26SyncBatch(7, () => 0.999, config.sessions).sessions.map((session) => session.id), [config.sessions[7].id]);
});

test("capturing a WAC session leaves the matching default row available", async () => {
	const { selectBoardUntrackedSessions } = require("../../../blocks/jira-kanban/experimental/lib/board-untracked-sessions.ts");
	const [wac, original, story] = await Promise.all([loadWacModule(), loadDataModule("agent-session-sync"), loadPresentationModule()]);
	const wacSeed = wac.WAC_SEEDED_AGENT_SESSION_OVERRIDES.values().next().value;
	const originalSeed = original.JIRA_TEAM_EU26_SEEDED_AGENT_SESSION_OVERRIDES.values().next().value;
	assert.equal(selectBoardUntrackedSessions({ sessions: [originalSeed], capturedItemIds: new Set([wacSeed.id]) }).length, 1);
	assert.equal(selectBoardUntrackedSessions({ sessions: [originalSeed], archivedItemIds: new Set([wacSeed.id]) }).length, 1);
	const originalCardSessionIds = new Set(story.createJiraTeamEu26PayBoardColumns().flatMap((column) => column.cards)
		.flatMap((card) => [...(card.agentActivities ?? []), ...(card.agentDoneRuns ?? [])]).map((session) => session.id));
	const wacCardSessionIds = wac.createJiraTeamEu26WacBoardColumns().flatMap((column) => column.cards)
		.flatMap((card) => [...(card.agentActivities ?? []), ...(card.agentDoneRuns ?? [])]).map((session) => session.id);
	assert.equal(wacCardSessionIds.length, 8);
	assert.ok(wacCardSessionIds.every((id) => id.startsWith("wac:PAY-") && !originalCardSessionIds.has(id)));
	assert.ok(wacCardSessionIds.every((id) => wac.WAC_BOARD_AGENTS.some((agent) => id.endsWith(`:${agent.id}`))));
});
