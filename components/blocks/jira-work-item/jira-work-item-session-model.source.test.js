const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

// Pure session-state model coverage split from jira-work-item.source.test.js
// so the parent file stays inside its recorded file-size growth budget.

const BLOCK_DIR = __dirname;
const TEST_WORK_ITEM = {
	code: "RFP-101",
	title: "Acmecorp: Prepare for bid recommendation for ESM RFP",
	status: "RFP Intake",
	priority: "High",
	assignee: { name: "Maya Chen" },
	reporter: { name: "Jordan Lee" },
	startDate: "May 12, 2026",
	dueDate: "Jun 8, 2026",
	parent: { code: "RFP-100", title: "Enterprise RFP Response" },
	labels: ["Acmecorp", "qualification", "enterprise"],
};

function readBlockFile(relativePath) {
	return fs.readFileSync(path.join(BLOCK_DIR, relativePath), "utf8");
}

let modelPromise;
let activityComposerRoutingPromise;
function loadBlockModule(relativePath, harnessName) {
	return esbuild
		.build({
			entryPoints: [path.join(BLOCK_DIR, relativePath)],
			bundle: true,
			format: "cjs",
			loader: { ".css": "empty" },
			platform: "node",
			tsconfig: path.join(process.cwd(), "tsconfig.json"),
			write: false,
		})
		.then((result) => loadCjsModuleFromText(result.outputFiles[0].text, harnessName));
}

function loadSessionModel() {
	if (!modelPromise) {
		modelPromise = loadBlockModule("data/session-state.ts", "jira-work-item-session-model-harness.cjs");
	}
	return modelPromise;
}

function loadActivityComposerRoutingModule() {
	if (!activityComposerRoutingPromise) {
		activityComposerRoutingPromise = loadBlockModule(
			"experimental/lib/activity-composer-session-routing.ts",
			"activity-composer-session-routing-session-model-harness.cjs",
		);
	}
	return activityComposerRoutingPromise;
}

function tickUntil(model, state, predicate, maxTicks = 400) {
	let working = state;
	let ticks = 0;
	while (!predicate(working) && ticks < maxTicks) {
		working = model.jiraWorkItemReducer(working, { type: "tick", deltaMs: model.JIRA_WORK_ITEM_TICK_MS });
		ticks += 1;
	}
	return working;
}

// ── Behavioral coverage: the pure session-state model ────────────────────────

test("preset initialization: blank/empty/filled/running set up the two dimensions", async () => {
	const model = await loadSessionModel();
	const blank = model.hydratePreset("blank", TEST_WORK_ITEM);
	assert.equal(model.selectContextStatus(blank), "empty");
	assert.equal(blank.sessions.length, 0);
	assert.equal(blank.planner.status, "inactive");
	assert.equal(blank.metadata.priority, null);

	const empty = model.hydratePreset("empty", TEST_WORK_ITEM);
	assert.equal(model.selectContextStatus(empty), "empty");
	assert.equal(empty.sessions.length, 0);
	assert.equal(empty.planner.status, "searching");
	assert.equal(empty.metadata.status, "RFP Intake");
	assert.equal(empty.metadata.priority, null);
	assert.equal(empty.metadata.atlassianProject, null);

	const filled = model.hydratePreset("filled", TEST_WORK_ITEM);
	assert.equal(model.selectContextStatus(filled), "filled");
	assert.equal(model.selectWorkingCount(filled), 0);
	assert.ok(filled.sessions.some((session) => session.status === "completed"));
	assert.deepEqual(filled.metadata.crew.map((agent) => agent.id), [
		"meeting-insights-reporter",
		"readiness-checker",
	]);
	assert.equal(filled.metadata.atlassianProject, "storefront-platform");
	assert.equal(filled.planner.status, "inactive");

	const running = model.hydratePreset("running", TEST_WORK_ITEM);
	assert.equal(model.selectContextStatus(running), "filled");
	assert.equal(model.selectWorkingCount(running), 3); // 2 running + 1 waiting
	assert.ok(running.sessions.some((session) => session.status === "waiting"));
	assert.ok(running.sessions.every((session) => session.status !== "completed"));
	assert.deepEqual(running.metadata.crew.map((agent) => agent.id), [
		"readiness-checker",
		"response-reviewer",
		"feedback-analyzer",
	]);
	assert.equal(running.metadata.atlassianProject, "storefront-platform");
	assert.equal(running.planner.status, "inactive");
});

test("filled and running presets scaffold activity with static event + changed-files rows", async () => {
	const model = await loadSessionModel();

	const empty = model.hydratePreset("empty", TEST_WORK_ITEM);
	const running = model.hydratePreset("running", TEST_WORK_ITEM);
	// Both populated demos carry the Jira-style seeded scaffolding.
	assert.equal(empty.staticEvents.length, 0);
	assert.ok(running.staticEvents.length >= 6);
	assert.ok(running.staticEvents.some((event) => event.kind === "event"));
	assert.ok(running.staticEvents.some((event) => event.kind === "changed-files"));

	const filled = model.hydratePreset("filled", TEST_WORK_ITEM);
	assert.ok(filled.staticEvents.length >= 6);
	assert.ok(filled.staticEvents.some((event) => event.kind === "event"));
	assert.ok(filled.staticEvents.some((event) => event.kind === "changed-files"));

	// The selector merges static events with human comments + agent sessions and
	// keeps the whole stream chronological.
	const events = model.selectActivityEvents(filled);
	assert.ok(events.some((event) => event.kind === "event"));
	assert.ok(events.some((event) => event.kind === "changed-files"));
	assert.ok(events.some((event) => event.kind === "human"));
	assert.ok(events.some((event) => event.kind === "agent"));
	const timestamps = events.map((event) => event.createdAtMs);
	assert.deepEqual(timestamps, [...timestamps].sort((a, b) => a - b));
	// The "created" scaffold event leads the chronological feed.
	assert.equal(events[0].kind, "event");
});

test("empty preset planner searches in phases and prefills the normal form when ready", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	assert.equal(state.planner.phaseIndex, 0);
	assert.equal(state.contextResources.description, "");
	assert.equal(state.planner.proposal.metadata.atlassianProject, "esm-rfp-response");

	state = model.jiraWorkItemReducer(state, { type: "tick", deltaMs: 1200 });
	assert.equal(state.planner.phaseIndex, 1);
	state = model.jiraWorkItemReducer(state, { type: "tick", deltaMs: 1200 });
	assert.equal(state.planner.phaseIndex, 2);
	state = model.jiraWorkItemReducer(state, { type: "tick", deltaMs: 1200 });
	assert.equal(state.planner.status, "ready");
	assert.equal(model.countPendingPlannerFields(state.planner), 12);
	assert.match(state.contextResources.description, /Acmecorp is evaluating Atlassian as a replacement for its current service-management and work-management stack/u);
	assert.equal(state.metadata.assignee.name, "Maya Chen");
	assert.equal(state.metadata.atlassianProject, "esm-rfp-response");
});

test("Confirm all preserves prefilled values and Reject all clears them", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	state = model.jiraWorkItemReducer(state, { type: "settle-running" });
	assert.match(state.contextResources.description, /Acmecorp is evaluating Atlassian as a replacement for its current service-management and work-management stack/u);
	assert.equal(state.metadata.reporter.name, "Jordan Lee");
	state = model.jiraWorkItemReducer(state, { type: "apply-planner-proposal" });
	assert.equal(state.planner.status, "applied");
	assert.equal(state.planner.appliedCount, 12);
	assert.equal(state.metadata.reporter.name, "Jordan Lee");
	assert.equal(state.metadata.priority, "High");
	assert.equal(state.metadata.atlassianProject, "esm-rfp-response");
	assert.equal(model.selectContextStatus(state), "filled");

	let rejected = model.hydratePreset("empty", TEST_WORK_ITEM);
	rejected = model.jiraWorkItemReducer(rejected, { type: "settle-running" });
	rejected = model.jiraWorkItemReducer(rejected, { type: "reject-planner-proposal" });
	assert.equal(rejected.planner.status, "inactive");
	assert.equal(rejected.contextResources.description, "");
	assert.equal(rejected.metadata.priority, null);
	assert.equal(model.selectContextStatus(rejected), "empty");
});

test("Accept suggestions immediately adds one timestamped Teamwork Graph activity event", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	state = model.jiraWorkItemReducer(state, { type: "settle-running" });
	state = model.jiraWorkItemReducer(state, { type: "apply-planner-proposal" });

	const [suggestionEvent] = model.selectActivityEvents(state);
	assert.equal(suggestionEvent.kind, "event");
	assert.equal(suggestionEvent.actor.name, "Teamwork Graph");
	assert.equal(suggestionEvent.actor.kind, "app");
	assert.equal(suggestionEvent.icon, "teamwork-graph");
	assert.deepEqual(suggestionEvent.segments, [{ type: "text", text: "provided a suggestion" }]);
	assert.equal(suggestionEvent.createdAtMs, state.staticEvents[0].createdAtMs);

	state = model.jiraWorkItemReducer(state, { type: "apply-planner-proposal" });
	assert.equal(model.selectActivityEvents(state).length, 1);
});

test("planner refinement stages deterministic deltas and reset restarts search", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	state = model.jiraWorkItemReducer(state, { type: "settle-running" });
	state = model.jiraWorkItemReducer(state, { type: "apply-planner-proposal" });
	state = model.jiraWorkItemReducer(state, {
		type: "refine-planner-proposal",
		prompt: "Prioritize security compliance, add assets-cmdb, and assign Maya Chen",
	});
	assert.equal(state.planner.status, "refining");
	assert.equal(state.planner.proposal.metadata.priority, "Highest");
	assert.ok(state.planner.proposal.metadata.labels.includes("security-review"));
	assert.ok(state.planner.proposal.metadata.labels.includes("assets-cmdb"));
	assert.equal(state.planner.decisions.priority, "pending");
	assert.equal(state.planner.decisions.labels, "pending");
	state = model.jiraWorkItemReducer(state, { type: "tick", deltaMs: 1200 });
	assert.equal(state.planner.status, "ready");
	assert.equal(state.metadata.priority, "Highest");
	assert.ok(state.metadata.labels.includes("security-review"));
	state = model.jiraWorkItemReducer(state, { type: "apply-planner-proposal" });
	assert.equal(state.metadata.priority, "Highest");
	assert.ok(state.metadata.labels.includes("security-review"));
	assert.ok(state.metadata.labels.includes("assets-cmdb"));

	let unapplied = model.hydratePreset("empty", TEST_WORK_ITEM);
	unapplied = model.jiraWorkItemReducer(unapplied, { type: "settle-running" });
	unapplied = model.jiraWorkItemReducer(unapplied, {
		type: "refine-planner-proposal",
		prompt: "Assign Maya Chen",
	});
	assert.equal(model.countPendingPlannerFields(unapplied.planner), 12);
	unapplied = model.jiraWorkItemReducer(unapplied, { type: "settle-running" });
	unapplied = model.jiraWorkItemReducer(unapplied, { type: "apply-planner-proposal" });
	assert.match(unapplied.contextResources.description, /Acmecorp is evaluating Atlassian as a replacement for its current service-management and work-management stack/u);

	state = model.jiraWorkItemReducer(state, { type: "refine-planner-proposal", prompt: "Assign Maya Chen" });
	assert.equal(model.countPendingPlannerFields(state.planner), 0);
	state = model.jiraWorkItemReducer(state, { type: "settle-running" });
	assert.equal(state.planner.status, "applied");

	state = model.jiraWorkItemReducer(state, { type: "reset", workItem: TEST_WORK_ITEM });
	assert.equal(state.planner.status, "searching");
	assert.equal(state.contextResources.description, "");
	assert.equal(state.metadata.priority, null);
});

test("planner refinement preserves manual edits made after prefill", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	state = model.jiraWorkItemReducer(state, { type: "settle-running" });
	state = model.jiraWorkItemReducer(state, {
		type: "edit-context-text",
		field: "description",
		value: "Manually revised response scope",
	});
	state = model.jiraWorkItemReducer(state, {
		type: "edit-metadata",
		patch: { assignee: { name: "Manual Owner" } },
	});

	state = model.jiraWorkItemReducer(state, {
		type: "refine-planner-proposal",
		prompt: "Prioritize security compliance",
	});
	assert.equal(state.planner.proposal.context.description, "Manually revised response scope");
	assert.equal(state.planner.proposal.metadata.assignee.name, "Manual Owner");

	state = model.jiraWorkItemReducer(state, { type: "tick", deltaMs: 1200 });
	assert.equal(state.contextResources.description, "Manually revised response scope");
	assert.equal(state.metadata.assignee.name, "Manual Owner");
	assert.equal(state.metadata.priority, "Highest");
});

test("context derivation flips empty <-> filled as resources change", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	assert.equal(model.selectContextStatus(state), "empty");
	state = model.jiraWorkItemReducer(state, {
		type: "add-context-resource",
		kind: "link",
		item: { id: "l1", key: "RFP-200", summary: "Related", type: "Task", relationship: "relates to" },
	});
	assert.equal(model.selectContextStatus(state), "filled");
	state = model.jiraWorkItemReducer(state, { type: "remove-context-resource", kind: "link", id: "l1" });
	assert.equal(model.selectContextStatus(state), "empty");
});

test("concurrent launch adds independent running sessions", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	state = model.jiraWorkItemReducer(state, { type: "launch-session", agentId: "a1", agentName: "Agent One" });
	state = model.jiraWorkItemReducer(state, { type: "launch-session", agentId: "a2", agentName: "Agent Two" });
	assert.equal(state.sessions.length, 2);
	assert.equal(model.selectWorkingCount(state), 2);
	assert.notEqual(state.sessions[0].id, state.sessions[1].id);
});

test("activity composer routes an existing agent mention to the latest working session", async () => {
	const model = await loadSessionModel();
	const routing = await loadActivityComposerRoutingModule();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	state = model.jiraWorkItemReducer(state, {
		type: "launch-session",
		agentId: "a1",
		agentName: "Agent One",
	});
	state = model.jiraWorkItemReducer(state, {
		type: "launch-session",
		agentId: "a1",
		agentName: "Agent One",
	});

	assert.equal(
		routing.findMentionedWorkingAgentSession(state.sessions, "@Agent One check the risks").id,
		state.sessions[1].id,
	);
	assert.equal(routing.findMentionedWorkingAgentSession(state.sessions, "email@Agent One"), null);
	assert.equal(routing.findMentionedWorkingAgentSession(state.sessions, "@Agent OnePlus"), null);

	const completedLatest = state.sessions.map((session, index) =>
		index === 1 ? { ...session, status: "completed" } : session,
	);
	assert.equal(
		routing.findMentionedWorkingAgentSession(completedLatest, "@Agent One").id,
		state.sessions[0].id,
	);
});

test("activity composer keeps active skill commands on the existing steering path", async () => {
	const model = await loadSessionModel();
	const routing = await loadActivityComposerRoutingModule();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	state = model.jiraWorkItemReducer(state, {
		type: "launch-session",
		agentId: "skill:summarize-comments",
		agentName: "Rovo",
		command: "/Summarize comments",
		title: "Summarize comments",
	});

	assert.equal(
		routing.findSteeredWorkingSession(state.sessions, "/Summarize comments focus on blockers").id,
		state.sessions[0].id,
	);
	assert.equal(routing.findMentionedWorkingAgentSession(state.sessions, "@Rovo"), null);
});

test("agent invocation updates Assignee and Agents according to its source", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);

	state = model.jiraWorkItemReducer(state, {
		type: "invoke-agent",
		source: "context-pill",
		agentId: "readiness-checker",
		agentName: "Readiness Checker",
		agentAvatarSrc: "/avatar-agent-new/blue/backlog-buddy.svg",
		command: "@Readiness Checker",
	});
	assert.deepEqual(state.metadata.assignee, {
		id: "readiness-checker",
		kind: "agent",
		name: "Readiness Checker",
		avatarUrl: "/avatar-agent-new/blue/backlog-buddy.svg",
	});
	assert.deepEqual(state.metadata.crew, [
		{
			id: "readiness-checker",
			kind: "agent",
			name: "Readiness Checker",
			avatarUrl: "/avatar-agent-new/blue/backlog-buddy.svg",
		},
	]);

	const promptInvocation = {
		type: "invoke-agent",
		source: "prompt",
		agentId: "code-reviewer",
		agentName: "Code Reviewer",
		agentAvatarSrc: "/avatar-agent-new/lime/auto-review.svg",
		command: "@Code Reviewer Check the implementation.",
	};
	state = model.jiraWorkItemReducer(state, promptInvocation);
	assert.deepEqual(state.metadata.crew, [
		{
			id: "readiness-checker",
			kind: "agent",
			name: "Readiness Checker",
			avatarUrl: "/avatar-agent-new/blue/backlog-buddy.svg",
		},
		{
			id: "code-reviewer",
			kind: "agent",
			name: "Code Reviewer",
			avatarUrl: "/avatar-agent-new/lime/auto-review.svg",
		},
	]);
	assert.equal(state.metadata.assignee.name, "Readiness Checker");

	state = model.jiraWorkItemReducer(state, promptInvocation);
	assert.equal(state.metadata.crew.length, 2);
});

test("third-party agent invocation preserves its brand logo in metadata", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);

	state = model.jiraWorkItemReducer(state, {
		type: "invoke-agent",
		source: "context-pill",
		agentId: "github-copilot",
		agentName: "GitHub Copilot",
		agentBrandName: "github",
		command: "@GitHub Copilot",
	});

	assert.deepEqual(state.metadata.assignee, {
		id: "github-copilot",
		kind: "agent",
		name: "GitHub Copilot",
		avatarUrl: undefined,
		brandName: "github",
	});
	assert.deepEqual(state.metadata.crew, [
		{
			id: "github-copilot",
			kind: "agent",
			name: "GitHub Copilot",
			avatarUrl: undefined,
			brandName: "github",
		},
	]);

	const editorSource = readBlockFile("experimental/components/detail-field-editors.tsx");
	assert.match(editorSource, /<AgentAvatarVisual[\s\S]*brandName=\{person\.brandName\}[\s\S]*sizePx=\{24\}/u);
});

test("agent assignees and active contributors always remain in Agents metadata", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	state = model.jiraWorkItemReducer(state, {
		type: "edit-metadata",
		patch: {
			assignee: {
				id: "readiness-checker",
				kind: "agent",
				name: "Readiness Checker",
				avatarUrl: "/avatar-agent-new/blue/backlog-buddy.svg",
			},
		},
	});
	assert.deepEqual(state.metadata.crew.map((agent) => agent.id), ["readiness-checker"]);

	state = model.jiraWorkItemReducer(state, {
		type: "launch-session",
		agentId: "code-reviewer",
		agentName: "Code Reviewer",
		agentAvatarSrc: "/avatar-agent-new/lime/auto-review.svg",
	});
	state = model.jiraWorkItemReducer(state, { type: "edit-metadata", patch: { crew: [] } });
	assert.deepEqual(state.metadata.crew.map((agent) => agent.id), [
		"readiness-checker",
		"code-reviewer",
	]);
});

test("Details renders 24px assignee/reporter avatars and a stacked Agents group", () => {
	const editorSource = readBlockFile("experimental/components/detail-field-editors.tsx");
	assert.match(editorSource, /<Avatar className="shrink-0" size="sm">/u);
	assert.match(editorSource, /<AvatarGroup className="[^"]*\bshrink-0\b[^"]*" label=\{`\$\{selectedAgents\.length\} agents`\}>/u);
	assert.match(editorSource, /shown\.map\(\(member\) => \([\s\S]*<AgentAvatar key=\{member\.id\} member=\{member\} \/>/u);
});

test("an invoked skill stays private in Activity while remaining steerable", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	state = model.jiraWorkItemReducer(state, {
		type: "launch-session",
		agentId: "skill:summarize-comments",
		agentName: "Rovo",
		command: "/Summarize comments",
		title: "Summarize comments",
	});

	const skillSession = state.sessions[0];
	assert.equal(skillSession.activityVisibility, "private");
	assert.equal(skillSession.agentId, "skill:summarize-comments");
	assert.equal(skillSession.title, "Summarize comments");
	assert.equal(skillSession.command, "/Summarize comments");
	assert.equal(skillSession.status, "running");
	// Private skill runs stay out of the shared Activity feed.
	assert.equal(
		model.selectActivityEvents(state).filter((event) => event.kind === "agent").length,
		0,
	);

	state = model.jiraWorkItemReducer(state, {
		type: "reply-session",
		sessionId: skillSession.id,
		text: "/Summarize comments Focus on unresolved decisions.",
	});
	assert.equal(state.activeSessionId, skillSession.id);
	assert.ok(state.sessions[0].messages.some((message) => message.content.includes("Focus on unresolved decisions.")));
});

test("selectActivityEvents forwards a comment progress checklist", async () => {
	const model = await loadSessionModel();
	const progressChecklist = [
		{ id: "story-claude-progress-1", label: "Implement SHOP-4821 in the local terminal", completed: true },
		{ id: "story-claude-progress-2", label: "Run focused local checks", completed: true },
	];
	const outputs = [{
		id: "story-changed-files",
		title: "Changed 12 files",
		source: "Agent output",
		owner: "feature/shop-4821-guest-checkout",
		iconName: "ai-chat",
	}];
	const state = {
		...model.hydratePreset("blank", TEST_WORK_ITEM),
		comments: [{
			id: "story-channel-claude-pr-handoff",
			authorName: "Claude Code",
			authorBrandName: "claude",
			content: "Focused local checks pass, so the work is ready for a pull request.",
			createdAtMs: 1_200_000,
			progressChecklist,
			outputs,
		}],
	};
	const [event] = model.selectActivityEvents(state).filter((item) => item.kind === "human");
	assert.deepEqual(event.progressChecklist, progressChecklist);
	assert.deepEqual(event.outputs, outputs);
});

test("selectActivityEvents exposes the human prompt author as invokedBy", async () => {
	const model = await loadSessionModel();
	const state = {
		...model.hydratePreset("blank", TEST_WORK_ITEM),
		sessions: [
			{
				id: "session-human-invoker",
				agentId: "claude-code",
				agentName: "Claude Code",
				agentBrandName: "claude",
				status: "running",
				command: "Implement guest checkout",
				previewText: "Working on it",
				steps: [],
				progress: 0.5,
				messages: [
					{
						id: "m0",
						role: "human",
						authorName: "Jordan Lee",
						authorAvatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
						content: "Implement guest checkout",
						createdAtMs: 1_000,
					},
					{
						id: "m1",
						role: "agent",
						authorName: "Claude Code",
						content: "Working on it",
						createdAtMs: 2_000,
					},
				],
				startedAtMs: 1_000,
				scriptId: "general-assist",
				scriptCursor: 0,
				stepElapsedMs: 0,
				resumedFromWait: false,
				order: 0,
			},
			{
				id: "session-agent-invoker",
				agentId: "code-planner",
				agentName: "Code Planner",
				status: "running",
				command: "Define the contract",
				previewText: "Planning",
				steps: [],
				progress: 0.5,
				messages: [
					{
						id: "m0",
						role: "human",
						authorName: "Claude Code",
						content: "Define the contract",
						createdAtMs: 3_000,
					},
				],
				startedAtMs: 3_000,
				scriptId: "general-assist",
				scriptCursor: 0,
				stepElapsedMs: 0,
				resumedFromWait: false,
				order: 1,
			},
		],
	};

	const events = model.selectActivityEvents(state).filter((event) => event.kind === "agent");
	assert.deepEqual(events[0].invokedBy, {
		name: "Jordan Lee",
		avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
	});
	assert.equal(events[1].invokedBy, undefined);
});

test("most scripted agents complete while the pricing agent owns the Q&A checkpoint", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("empty", TEST_WORK_ITEM);
	for (const [agentId, agentName] of [["a1", "Agent One"], ["a2", "Agent Two"], ["a3", "Agent Three"]]) {
		state = model.jiraWorkItemReducer(state, { type: "launch-session", agentId, agentName });
	}
	const pricingSession = state.sessions.find((session) => session.scriptId === "pricing-draft");
	assert.ok(pricingSession);

	state = tickUntil(model, state, (currentState) =>
		currentState.sessions.every((session) =>
			session.id === pricingSession.id ? session.status === "waiting" : session.status === "completed",
		),
	);
	assert.deepEqual(state.sessions.map((session) => [session.scriptId, session.status]), [
		["compliance-matrix", "completed"],
		["risk-review", "completed"],
		["pricing-draft", "waiting"],
	]);

	// A reply resumes the waiting agent (from chat or Activity — same path).
	state = model.jiraWorkItemReducer(state, {
		type: "reply-session",
		sessionId: pricingSession.id,
		text: "Assume 5,000 seats.",
	});
	const resumed = state.sessions.find((session) => session.id === pricingSession.id);
	assert.equal(resumed.status, "running");
	assert.ok(resumed.messages.some((message) => message.role === "human" && message.content === "Assume 5,000 seats."));

	state = tickUntil(model, state, (currentState) =>
		currentState.sessions.find((session) => session.id === pricingSession.id)?.status === "completed",
	);
	const completed = state.sessions.find((session) => session.id === pricingSession.id);
	assert.equal(completed.status, "completed");
	assert.equal(completed.progress, 1);
});

test("Activity @-reply and chat reply share one session state", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("running", TEST_WORK_ITEM);
	const waiting = state.sessions.find((s) => s.status === "waiting");
	state = model.jiraWorkItemReducer(state, { type: "reply-session", sessionId: waiting.id, text: "5,000 seats" });
	const resumed = state.sessions.find((s) => s.id === waiting.id);
	assert.equal(resumed.status, "running");
	assert.equal(state.activeSessionId, waiting.id);
});

test("session switching sets and clears the active session", async () => {
	const model = await loadSessionModel();
	let state = model.hydratePreset("running", TEST_WORK_ITEM);
	assert.equal(model.selectActiveSession(state), null);
	const target = state.sessions[1];
	state = model.jiraWorkItemReducer(state, { type: "set-active-session", sessionId: target.id });
	assert.equal(model.selectActiveSession(state).id, target.id);
	state = model.jiraWorkItemReducer(state, { type: "set-active-session", sessionId: null });
	assert.equal(model.selectActiveSession(state), null);
});

test("empty work item launcher opens a general session; filled launcher reopens the latest", async () => {
	const model = await loadSessionModel();
	let empty = model.hydratePreset("empty", TEST_WORK_ITEM);
	empty = model.jiraWorkItemReducer(empty, { type: "open-latest-or-general" });
	assert.equal(empty.sessions.length, 1);
	assert.equal(empty.activeSessionId, empty.sessions[0].id);

	let running = model.hydratePreset("running", TEST_WORK_ITEM);
	running = model.jiraWorkItemReducer(running, { type: "open-latest-or-general" });
	assert.ok(running.activeSessionId);
	assert.equal(running.sessions.length, model.hydratePreset("running", TEST_WORK_ITEM).sessions.length); // reopened, not created
});
