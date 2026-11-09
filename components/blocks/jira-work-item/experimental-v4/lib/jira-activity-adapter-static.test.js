const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

// Static-event and @mention mapping contracts split from jira-activity-adapter.test.js
// so the parent file stays inside the default file-size budget.

const ADAPTER_PATH = path.join(__dirname, "jira-activity-adapter.ts");

let adapterPromise;
function loadAdapter() {
	if (!adapterPromise) {
		adapterPromise = esbuild
			.build({
				entryPoints: [ADAPTER_PATH],
				bundle: true,
				format: "cjs",
				platform: "node",
				// The adapter's import graph reaches Atlaskit packages that `require()`
				// their compiled CSS. Node only needs the module's behavior, so drop
				// stylesheets instead of failing the bundle.
				loader: { ".css": "empty" },
				tsconfig: path.join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(result.outputFiles[0].text, "jira-activity-adapter-v4-static-harness.cjs"));
	}
	return adapterPromise;
}

test("maps a static event to a Jira event row with icon, segments, and timestamp", async () => {
	const adapter = await loadAdapter();
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "static-labelled",
			kind: "event",
			actor: {
				id: "static-triage-assistant",
				name: "Triage assistant",
				kind: "agent",
				avatarSrc: "/triage.svg",
			},
			icon: "label",
			segments: [
				{ type: "text", text: "added " },
				{ type: "label", text: "RFP", color: "blue" },
			],
			createdAtMs: Date.UTC(2026, 4, 12, 13, 5),
		},
	]);

	assert.equal(entry.kind, "event");
	assert.equal(entry.icon, "label");
	assert.deepEqual(entry.actor, {
		id: "static-triage-assistant",
		name: "Triage assistant",
		kind: "agent",
		avatarSrc: "/triage.svg",
	});
	assert.deepEqual(entry.segments, [
		{ type: "text", text: "added " },
		{ type: "label", text: "RFP", color: "blue" },
	]);
	assert.equal(typeof entry.timestamp, "string");
});

test("splits leftover set-priority text into a priority segment", async () => {
	const adapter = await loadAdapter();
	const [highEntry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "static-assigned",
			kind: "event",
			actor: { id: "jordan", name: "Jordan Lee", kind: "person" },
			segments: [{ type: "text", text: "self-assigned the issue and set priority to High" }],
			createdAtMs: Date.UTC(2026, 4, 12, 13, 12),
		},
	]);
	assert.deepEqual(highEntry.segments, [
		{ type: "text", text: "self-assigned the issue and set priority to " },
		{ type: "priority", text: "High" },
	]);

	const [highestEntry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "static-priority-highest",
			kind: "event",
			actor: { id: "jordan", name: "Jordan Lee", kind: "person" },
			segments: [{ type: "text", text: "set priority to Highest" }],
			createdAtMs: Date.UTC(2026, 4, 12, 13, 13),
		},
	]);
	assert.deepEqual(highestEntry.segments, [
		{ type: "text", text: "set priority to " },
		{ type: "priority", text: "Highest" },
	]);

	const structured = [
		{ type: "text", text: "self-assigned the issue and set priority to " },
		{ type: "priority", text: "Low" },
	];
	const [structuredEntry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "static-priority-low",
			kind: "event",
			actor: { id: "jordan", name: "Jordan Lee", kind: "person" },
			segments: structured,
			createdAtMs: Date.UTC(2026, 4, 12, 13, 14),
		},
	]);
	assert.deepEqual(structuredEntry.segments, structured);
});

test("maps a static event without an icon and an app actor with a brand name", async () => {
	const adapter = await loadAdapter();
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "static-linked",
			kind: "event",
			actor: { id: "static-github", name: "GitHub", kind: "app", brandName: "github" },
			segments: [{ type: "text", text: "linked the response workspace" }],
			createdAtMs: Date.UTC(2026, 4, 12, 13, 20),
		},
	]);

	assert.equal(entry.kind, "event");
	assert.equal(entry.icon, undefined);
	assert.deepEqual(entry.actor, { id: "static-github", name: "GitHub", kind: "app", brandName: "github" });
});

test("forwards pull-request metadata on a static event so it renders the Jira Activity PR row", async () => {
	const adapter = await loadAdapter();
	const pullRequest = {
		number: 1847,
		title: "Add Acmecorp ESM RFP response workspace",
		status: "Open",
		additions: 148,
		deletions: 37,
	};
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "static-linked",
			kind: "event",
			actor: { id: "static-github", name: "GitHub", kind: "app", brandName: "github" },
			icon: "linked",
			segments: [],
			pullRequest,
			createdAtMs: Date.UTC(2026, 4, 12, 13, 20),
		},
	]);

	assert.equal(entry.kind, "event");
	assert.equal(entry.icon, "pull-request");
	assert.deepEqual(entry.pullRequest, pullRequest);
});

test("maps a static changed-files event to a Jira changed-files card", async () => {
	const adapter = await loadAdapter();
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "static-changed-files",
			kind: "changed-files",
			actor: { id: "static-readiness", name: "Readiness Checker", kind: "agent", avatarSrc: "/readiness.svg" },
			summary: "Updated 3 resources",
			description: "Refreshed the compliance matrix and owners.",
			branch: "#RFP-101",
			sessionItem: {
				id: "readiness-output-session",
				title: "Refresh compliance resources",
				state: "complete",
				agent: { name: "Readiness Checker", avatarSrc: "/readiness.svg" },
				branch: "rovo/rfp-101-risk-review",
				elapsedSeconds: 300,
			},
			outputs: [
				{
					id: "compliance-matrix",
					title: "Acmecorp compliance matrix",
					source: "Confluence page",
					iconName: "globe",
				},
			],
			createdAtMs: Date.UTC(2026, 4, 12, 13, 30),
		},
	]);

	assert.equal(entry.kind, "changed-files");
	assert.equal(entry.summary, "Updated 3 resources");
	assert.equal(entry.description, "Refreshed the compliance matrix and owners.");
	assert.equal(entry.branch, "#RFP-101");
	assert.equal(entry.sessionItem.title, "Refresh compliance resources");
	assert.deepEqual(entry.outputs.map((output) => output.title), ["Acmecorp compliance matrix"]);
	assert.deepEqual(entry.actor, {
		id: "static-readiness",
		name: "Readiness Checker",
		kind: "agent",
		avatarSrc: "/readiness.svg",
	});
});

test("preserves input chronology and represents a missing agent response as an empty body", async () => {
	const adapter = await loadAdapter();
	const entries = adapter.mapActivityEventsToJiraEntries([
		{
			id: "later-human",
			kind: "human",
			author: { name: "Venn" },
			content: "Keep this first because the input placed it first.",
			createdAtMs: Date.UTC(2026, 4, 12, 12),
		},
		{
			id: "earlier-agent",
			kind: "agent",
			sessionId: "session-1",
			agentId: "rovo",
			agentName: "Rovo",
			status: "running",
			title: "Investigate",
			branch: "rovo/investigate",
			elapsedSeconds: 60,
			commandPreview: "Investigate",
			createdAtMs: Date.UTC(2026, 4, 12, 11),
		},
	]);

	assert.deepEqual(entries.map((entry) => entry.id), ["later-human", "earlier-agent"]);
	assert.deepEqual(entries[0].actor, adapter.JIRA_WORK_ITEM_CURRENT_USER);
	assert.deepEqual(entries[1].body, []);
	assert.equal(entries[1].sessionItem.agent.avatarSrc, entries[1].actor.avatarSrc);
});

test("promotes @mentions of agents with a session in the stream into mention chips", async () => {
	const adapter = await loadAdapter();
	const [comment] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "comment-orchestration",
			kind: "human",
			author: { name: "Venn" },
			content: "@Code Planner lead the plan, and @Unit Test Creator prove it.",
			createdAtMs: Date.UTC(2026, 4, 12, 9),
		},
		{
			id: "activity-planner",
			kind: "agent",
			sessionId: "session-planner",
			agentId: "code-planner",
			agentName: "Code Planner",
			agentAvatarSrc: "/planner.png",
			status: "running",
			title: "Plan",
			branch: "rovo/plan",
			elapsedSeconds: 10,
			commandPreview: "Plan",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 1),
		},
		{
			id: "activity-tests",
			kind: "agent",
			sessionId: "session-tests",
			agentId: "unit-test-creator",
			agentName: "Unit Test Creator",
			agentAvatarSrc: "/tests.png",
			status: "running",
			title: "Test",
			branch: "rovo/test",
			elapsedSeconds: 10,
			commandPreview: "Test",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 2),
		},
	]);

	assert.deepEqual(comment.body, [
		{ type: "agent-mention", text: "Code Planner", avatarSrc: "/planner.png" },
		{ type: "text", text: " lead the plan, and " },
		{ type: "agent-mention", text: "Unit Test Creator", avatarSrc: "/tests.png" },
		{ type: "text", text: " prove it." },
	]);
});

test("resolves case-varied overlapping agent mentions to the longest canonical name", async () => {
	const adapter = await loadAdapter();
	const [comment] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "comment-overlapping-mentions",
			kind: "human",
			author: { name: "Venn" },
			content: "Ask @code planner pro to review the rollout.",
			createdAtMs: Date.UTC(2026, 4, 12, 9),
		},
		{
			id: "activity-planner",
			kind: "agent",
			sessionId: "session-planner",
			agentId: "code-planner",
			agentName: "Code Planner",
			agentAvatarSrc: "/planner.png",
			status: "running",
			title: "Plan",
			branch: "rovo/plan",
			elapsedSeconds: 10,
			commandPreview: "Plan",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 1),
		},
		{
			id: "activity-planner-pro",
			kind: "agent",
			sessionId: "session-planner-pro",
			agentId: "code-planner-pro",
			agentName: "Code Planner Pro",
			agentAvatarSrc: "/planner-pro.png",
			status: "running",
			title: "Review",
			branch: "rovo/review",
			elapsedSeconds: 10,
			commandPreview: "Review",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 2),
		},
	]);

	assert.deepEqual(comment.body, [
		{ type: "text", text: "Ask " },
		{ type: "agent-mention", text: "Code Planner Pro", avatarSrc: "/planner-pro.png" },
		{ type: "text", text: " to review the rollout." },
	]);
});

test("leaves @text with no matching agent session as plain comment copy", async () => {
	const adapter = await loadAdapter();
	const [comment] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "comment-unmatched",
			kind: "human",
			author: { name: "Venn" },
			content: "Email @support and ping @Code Planners about the retry.",
			createdAtMs: Date.UTC(2026, 4, 12, 9),
		},
		{
			id: "activity-planner",
			kind: "agent",
			sessionId: "session-planner",
			agentId: "code-planner",
			agentName: "Code Planner",
			agentAvatarSrc: "/planner.png",
			status: "running",
			title: "Plan",
			branch: "rovo/plan",
			elapsedSeconds: 10,
			commandPreview: "Plan",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 1),
		},
	]);

	assert.deepEqual(comment.body, [
		{ type: "text", text: "Email @support and ping @Code Planners about the retry." },
	]);
});

test("keeps delegated agents mentionable after their sessions fold into the lead thread", async () => {
	const adapter = await loadAdapter();
	const events = [
		{
			id: "comment-orchestration",
			kind: "human",
			author: { name: "Venn" },
			content: "@Code Planner lead, @GitHub Copilot build, @Unit Test Creator verify.",
			createdAtMs: Date.UTC(2026, 4, 12, 9),
		},
		{
			id: "activity-planner",
			kind: "agent",
			sessionId: "session-planner",
			agentId: "code-planner",
			agentName: "Code Planner",
			agentAvatarSrc: "/planner.png",
			status: "running",
			title: "Plan",
			branch: "rovo/plan",
			elapsedSeconds: 10,
			commandPreview: "Plan",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 1),
		},
		{
			id: "activity-copilot",
			kind: "agent",
			sessionId: "session-copilot",
			agentId: "github-copilot",
			agentName: "GitHub Copilot",
			agentAvatarSrc: "/copilot.png",
			status: "running",
			title: "Build",
			branch: "rovo/build",
			elapsedSeconds: 10,
			commandPreview: "Build",
			responsePreview: "Building the service.",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 2),
		},
		{
			id: "activity-tests",
			kind: "agent",
			sessionId: "session-tests",
			agentId: "unit-test-creator",
			agentName: "Unit Test Creator",
			agentAvatarSrc: "/tests.png",
			status: "running",
			title: "Verify",
			branch: "rovo/verify",
			elapsedSeconds: 10,
			commandPreview: "Verify",
			responsePreview: "Writing acceptance cases.",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 3),
		},
	];

	// The delegated sessions no longer exist as standalone agent events here.
	const composed = adapter.composeActivitySessionThread(events, {
		parentSessionId: "session-planner",
		childSessionIds: ["session-copilot", "session-tests"],
		visibleSessionIds: ["session-planner", "session-copilot", "session-tests"],
	});
	const [comment] = adapter.mapActivityEventsToJiraEntries(composed);

	assert.deepEqual(
		comment.body.filter((segment) => segment.type === "agent-mention"),
		[
			{ type: "agent-mention", text: "Code Planner", avatarSrc: "/planner.png" },
			{ type: "agent-mention", text: "GitHub Copilot", avatarSrc: "/copilot.png" },
			{ type: "agent-mention", text: "Unit Test Creator", avatarSrc: "/tests.png" },
		],
	);
});

test("parses @mentions on first paint when agent sessions are staged hidden from Activity", async () => {
	const adapter = await loadAdapter();
	const events = [
		{
			id: "story-channel-orchestration",
			kind: "human",
			author: { name: "Venn" },
			content:
				"@Claude Code take the lead on implementing guest checkout. Consult @Code Planner on the secure API and validation contract first, then implement and verify the work.",
			createdAtMs: Date.UTC(2026, 4, 12, 9),
		},
		{
			id: "activity-claude",
			kind: "agent",
			sessionId: "story-session-claude-code",
			agentId: "claude-code",
			agentName: "Claude Code",
			agentBrandName: "claude",
			status: "running",
			title: "Implement guest checkout",
			branch: "feature/guest-checkout",
			elapsedSeconds: 10,
			commandPreview: "Implement guest checkout",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 1),
		},
		{
			id: "activity-planner",
			kind: "agent",
			sessionId: "story-session-code-planner",
			agentId: "code-planner",
			agentName: "Code Planner",
			agentAvatarSrc: "/planner.png",
			status: "running",
			title: "Plan the contract",
			branch: "rovo/plan",
			elapsedSeconds: 10,
			commandPreview: "Plan the contract",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 2),
		},
	];

	// Jira Golden Journey v2 keeps agent cards hidden until the lead/consult steps, so the
	// composed stream is only the human prompt — the same first-paint shape the
	// Activity tab shows right after submit.
	const composed = adapter.composeActivitySessionThread(events, {
		parentSessionId: "story-session-claude-code",
		childSessionIds: ["story-session-code-planner"],
		visibleSessionIds: [],
	});
	assert.deepEqual(composed.map((event) => event.id), ["story-channel-orchestration"]);

	const [commentWithoutSource] = adapter.mapActivityEventsToJiraEntries(composed);
	assert.deepEqual(commentWithoutSource.body, [{
		type: "text",
		text: events[0].content,
	}]);

	const [comment] = adapter.mapActivityEventsToJiraEntries(
		composed,
		undefined,
		events,
	);
	assert.deepEqual(comment.body, [
		{ type: "agent-mention", text: "Claude Code", brandName: "claude" },
		{
			type: "text",
			text: " take the lead on implementing guest checkout. Consult ",
		},
		{ type: "agent-mention", text: "Code Planner", avatarSrc: "/planner.png" },
		{
			type: "text",
			text: " on the secure API and validation contract first, then implement and verify the work.",
		},
	]);
});
