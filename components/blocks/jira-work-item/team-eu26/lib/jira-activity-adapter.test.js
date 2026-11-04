const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

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
			.then((result) => loadCjsModuleFromText(result.outputFiles[0].text, "jira-activity-adapter-v5-harness.cjs"));
	}
	return adapterPromise;
}

test("uses Venn as the Jira work-item current user with the supplied face avatar", async () => {
	const adapter = await loadAdapter();

	assert.deepEqual(adapter.JIRA_WORK_ITEM_CURRENT_USER, {
		id: "jira-work-item-current-user",
		name: "Venn",
		kind: "person",
		avatarSrc: "/avatar-user/venn/venn.png",
	});
});

test("maps human activity to a replyable Jira comment", async () => {
	const adapter = await loadAdapter();
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "comment-1",
			kind: "human",
			author: { name: "Jordan Lee", avatarUrl: "/jordan.png" },
			content: "Budget qualification is still open.",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 5),
		},
	]);

	assert.deepEqual(entry, {
		id: "comment-1",
		kind: "comment",
		actor: {
			id: "jira-work-item-person-jordan-lee",
			name: "Jordan Lee",
			kind: "person",
			avatarSrc: "/jordan.png",
		},
		timestamp: "9:05 AM",
		body: [{ type: "text", text: "Budget qualification is still open." }],
		allowReply: true,
	});
});

test("collects reaction actors without mapping rendered activity entries", async () => {
	const adapter = await loadAdapter();
	const events = [
		{
			id: "comment-1",
			kind: "human",
			author: { name: "Jordan Lee", avatarUrl: "/jordan.png" },
			content: "Please review this.",
			createdAtMs: 1,
			threadReplies: [
				{
					id: "reply-1",
					authorName: "Venn",
					authorAvatarSrc: "/venn.png",
					content: "On it.",
					createdAtMs: 2,
				},
			],
		},
		{
			id: "agent-1",
			kind: "agent",
			sessionId: "session-1",
			agentId: "claude-code",
			agentName: "Claude Code",
			agentBrandName: "claude",
			status: "completed",
			title: "Reviewed checkout",
			elapsedSeconds: 12,
			commandPreview: "Review checkout",
			createdAtMs: 3,
			threadReplies: [
				{
					id: "agent-reply-1",
					agentId: "code-planner",
					agentName: "Code Planner",
					content: "Plan ready.",
					createdAtMs: 4,
				},
			],
		},
		{
			id: "event-1",
			kind: "event",
			actor: { id: "github", name: "GitHub", kind: "app", brandName: "github" },
			segments: [],
			createdAtMs: 5,
		},
	];

	const actorsFromEntries = new Map();
	for (const entry of adapter.mapActivityEventsToJiraEntries(events)) {
		actorsFromEntries.set(entry.actor.id, entry.actor);
		if (entry.kind === "comment") {
			for (const reply of entry.replies ?? []) {
				actorsFromEntries.set(reply.actor.id, reply.actor);
			}
		}
	}

	assert.deepEqual(
		adapter.collectActivityActors(events),
		[...actorsFromEntries.values()],
	);
});

test("maps activity timestamps relative to the supplied story clock", async () => {
	const adapter = await loadAdapter();
	const referenceTimeMs = Date.UTC(2026, 4, 12, 9, 9);
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "comment-relative-time",
			kind: "human",
			author: { name: "Maya Chen" },
			content: "Keep the release focused.",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 5),
		},
	], referenceTimeMs);

	assert.equal(entry.timestamp, "4m ago");
});

test("selects unique pull requests newest-first for the metadata rail", async () => {
	const adapter = await loadAdapter();
	const actor = { id: "github", name: "GitHub", kind: "agent" };
	const events = [
		{
			id: "pr-1847-opened",
			kind: "event",
			actor,
			segments: [],
			pullRequest: {
				number: 1847,
				title: "Add guest checkout to the storefront",
				status: "Open",
				additions: 86,
				deletions: 21,
			},
			createdAtMs: Date.UTC(2026, 4, 12, 9, 5),
		},
		{
			id: "pr-1901-opened",
			kind: "event",
			actor,
			segments: [],
			pullRequest: {
				number: 1901,
				title: "Tighten checkout validation",
				status: "Open",
				additions: 12,
				deletions: 3,
			},
			createdAtMs: Date.UTC(2026, 4, 12, 9, 6),
		},
		{
			id: "pr-1847-merged",
			kind: "event",
			actor,
			segments: [],
			pullRequest: {
				number: 1847,
				title: "Add guest checkout to the storefront",
				status: "Merged",
				additions: 86,
				deletions: 21,
			},
			createdAtMs: Date.UTC(2026, 4, 12, 9, 7),
		},
	];

	assert.deepEqual(adapter.selectPullRequestEntries([]), []);
	assert.deepEqual(
		adapter.selectPullRequestEntries(events).map((entry) => ({
			id: entry.id,
			number: entry.pullRequest.number,
			status: entry.pullRequest.status,
		})),
		[
			{ id: "pr-1847-merged", number: 1847, status: "Merged" },
			{ id: "pr-1901-opened", number: 1901, status: "Open" },
		],
	);
	assert.equal(adapter.selectPullRequestEntries(events.slice(0, 1)).length, 1);
});

test("keeps same-numbered pull requests from distinct repositories", async () => {
	const adapter = await loadAdapter();
	const actor = { id: "github", name: "GitHub", kind: "agent" };
	const events = [
		{
			id: "storefront-1847",
			kind: "event",
			actor,
			segments: [],
			pullRequest: {
				number: 1847,
				title: "Storefront checkout",
				status: "Open",
				additions: 40,
				deletions: 4,
				repository: "acme/storefront",
				url: "https://github.com/acme/storefront/pull/1847",
			},
			createdAtMs: Date.UTC(2026, 4, 12, 9, 5),
		},
		{
			id: "payments-1847",
			kind: "event",
			actor,
			segments: [],
			pullRequest: {
				number: 1847,
				title: "Payments retry",
				status: "Open",
				additions: 18,
				deletions: 2,
				repository: "acme/payments",
				url: "https://github.com/acme/payments/pull/1847",
			},
			createdAtMs: Date.UTC(2026, 4, 12, 9, 6),
		},
		{
			id: "storefront-1847-merged",
			kind: "event",
			actor,
			segments: [],
			pullRequest: {
				number: 1847,
				title: "Storefront checkout",
				status: "Merged",
				additions: 40,
				deletions: 4,
				repository: "acme/storefront",
				url: "https://github.com/acme/storefront/pull/1847",
			},
			createdAtMs: Date.UTC(2026, 4, 12, 9, 7),
		},
	];

	assert.deepEqual(
		adapter.selectPullRequestEntries(events).map((entry) => ({
			id: entry.id,
			repository: entry.pullRequest.repository,
			status: entry.pullRequest.status,
		})),
		[
			{ id: "storefront-1847-merged", repository: "acme/storefront", status: "Merged" },
			{ id: "payments-1847", repository: "acme/payments", status: "Open" },
		],
	);
	assert.equal(
		adapter.getPullRequestIdentity(events[0].pullRequest),
		"https://github.com/acme/storefront/pull/1847",
	);
	assert.equal(
		adapter.getPullRequestIdentity(events[1].pullRequest),
		"https://github.com/acme/payments/pull/1847",
	);
	assert.notEqual(
		adapter.getPullRequestIdentity(events[0].pullRequest),
		adapter.getPullRequestIdentity(events[1].pullRequest),
	);
	assert.equal(
		adapter.getPullRequestIdentity(events[0].pullRequest),
		adapter.getPullRequestIdentity(events[2].pullRequest),
	);
});

test("maps authored eyes reactions and agent handoff replies into Jira comments", async () => {
	const adapter = await loadAdapter();
	const [humanEntry, agentEntry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "comment-broadcast",
			kind: "human",
			author: { name: "Venn" },
			content: "Check the live reconnect path.",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 5),
			threadReplies: [{
				id: "human-reply-1",
				authorName: "Maya Chen",
				authorAvatarSrc: "/maya.png",
				content: "Include mobile web in the acceptance proof.",
				createdAtMs: Date.UTC(2026, 4, 12, 9, 5, 30),
			}],
			reactions: [{
				emoji: "👀",
				actorIds: ["jira-work-item-agent-service-impact", "jira-work-item-agent-claude-code"],
			}],
		},
		{
			id: "activity-claude",
			kind: "agent",
			sessionId: "session-claude",
			agentId: "claude-code",
			agentName: "Claude Code",
			status: "waiting",
			waitingOn: {
				kind: "agent",
				agentId: "service-impact",
				agentName: "Service Impact agent",
				agentAvatarSrc: "/service-impact.svg",
			},
			title: "Patch reconnect handling",
			branch: "codex/jra-4821",
			elapsedSeconds: 45,
			commandPreview: "Fix the reset",
			createdAtMs: Date.UTC(2026, 4, 12, 9, 6),
			threadReplies: [{
				id: "handoff-1",
				agentId: "service-impact",
				agentName: "Service Impact agent",
				agentAvatarSrc: "/service-impact.svg",
				content: "The stale filter snapshot is restored after the reconnect subscription resolves.",
				createdAtMs: Date.UTC(2026, 4, 12, 9, 7),
			}],
		},
	]);

	assert.deepEqual(humanEntry.reactions, [{
		emoji: "👀",
		actorIds: ["jira-work-item-agent-service-impact", "jira-work-item-agent-claude-code"],
	}]);
	assert.deepEqual(humanEntry.replies, [{
		id: "human-reply-1",
		actor: {
			id: "jira-work-item-person-maya-chen",
			name: "Maya Chen",
			kind: "person",
			avatarSrc: "/maya.png",
		},
		timestamp: "9:05 AM",
		body: "Include mobile web in the acceptance proof.",
	}]);
	assert.deepEqual(agentEntry.tag, { text: "Waiting for Service Impact agent", color: "yellow" });
	assert.deepEqual(agentEntry.replies, [{
		id: "handoff-1",
		actor: {
			id: "jira-work-item-agent-service-impact",
			name: "Service Impact agent",
			kind: "agent",
			avatarSrc: "/service-impact.svg",
		},
		timestamp: "9:07 AM",
		body: "The stale filter snapshot is restored after the reconnect subscription resolves.",
	}]);
});

test("composes visible delegated sessions as replies beneath one lead agent", async () => {
	const adapter = await loadAdapter();
	const events = [
		{
			id: "activity-planner",
			kind: "agent",
			sessionId: "session-planner",
			agentId: "code-planner",
			agentName: "Code Planner",
			status: "running",
			title: "Plan guest checkout",
			branch: "rovo/plan",
			elapsedSeconds: 12,
			commandPreview: "Lead the plan",
			responsePreview: "Designing the checkout contract…",
			createdAtMs: 100,
		},
		{
			id: "activity-copilot",
			kind: "agent",
			sessionId: "session-copilot",
			agentId: "github-copilot",
			agentName: "GitHub Copilot",
			status: "running",
			title: "Implement guest checkout",
			branch: "rovo/implement",
			elapsedSeconds: 8,
			commandPreview: "Implement guest checkout",
			responsePreview: "Implementing against the approved contract…",
			createdAtMs: 200,
			threadReplies: [{
				id: "copilot-test-handoff",
				agentId: "unit-test-creator",
				agentName: "Unit Test Creator",
				agentAvatarSrc: "/unit-test-creator.svg",
				content: "The implementation is ready for acceptance coverage.",
				createdAtMs: 250,
			}],
		},
		{
			id: "activity-tests",
			kind: "agent",
			sessionId: "session-tests",
			agentId: "unit-test-creator",
			agentName: "Unit Test Creator",
			status: "running",
			title: "Verify acceptance coverage",
			branch: "rovo/tests",
			elapsedSeconds: 4,
			commandPreview: "Build acceptance proof",
			responsePreview: "Building deterministic acceptance cases…",
			createdAtMs: 300,
		},
	];
	const config = {
		parentSessionId: "session-planner",
		childSessionIds: ["session-copilot", "session-tests"],
		visibleSessionIds: ["session-planner", "session-copilot"],
	};

	const composed = adapter.composeActivitySessionThread(events, config);
	assert.equal(composed.length, 1);
	assert.equal(composed[0].sessionId, "session-planner");
	assert.deepEqual(composed[0].threadReplies, [{
		id: "activity-copilot-thread-reply",
		sessionId: "session-copilot",
		agentId: "github-copilot",
		agentName: "GitHub Copilot",
		agentAvatarSrc: undefined,
		content: "Implementing against the approved contract…",
		createdAtMs: 200,
	}, {
		id: "copilot-test-handoff",
		agentId: "unit-test-creator",
		agentName: "Unit Test Creator",
		agentAvatarSrc: "/unit-test-creator.svg",
		content: "The implementation is ready for acceptance coverage.",
		createdAtMs: 250,
	}]);

	const [mappedEntry] = adapter.mapActivityEventsToJiraEntries(composed, undefined, events);
	assert.deepEqual(
		mappedEntry.replies.map((reply) => reply.sessionItem?.id),
		["session-copilot", "session-tests"],
		"agent replies retain the session used by their View action",
	);

	assert.deepEqual(
		adapter.composeActivitySessionThread(events, { ...config, visibleSessionIds: [] }),
		[],
	);
	assert.equal(events.length, 3, "composition must not mutate the source timeline");

	const presented = adapter.applyActivitySessionThreadPresentation(
		[mappedEntry],
		{ ...config, defaultRepliesExpanded: false },
	);
	assert.equal(presented[0].defaultRepliesExpanded, false);
	assert.equal(
		adapter.applyActivitySessionThreadPresentation([mappedEntry], config)[0].defaultRepliesExpanded,
		undefined,
		"omit defaultRepliesExpanded to keep Activity's expanded default",
	);
});

test("status transition lozenges reuse the status dropdown tone map", async () => {
	const adapter = await loadAdapter();
	const [movedInProgress, movedDone, nonStatus] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "story-moved-in-progress",
			kind: "event",
			actor: {
				id: "jira-work-item-current-user",
				name: "Venn",
				kind: "person",
			},
			icon: "status",
			segments: [
				{ type: "text", text: "moved from " },
				{ type: "lozenge", text: "To do" },
				{ type: "transition-arrow" },
				{ type: "lozenge", text: "In progress" },
			],
			createdAtMs: Date.UTC(2026, 4, 12, 9, 5),
		},
		{
			id: "story-moved-done",
			kind: "event",
			actor: {
				id: "jira-work-item-current-user",
				name: "Venn",
				kind: "person",
			},
			icon: "status",
			segments: [
				{ type: "text", text: "moved from " },
				{ type: "lozenge", text: "In review" },
				{ type: "transition-arrow" },
				{ type: "lozenge", text: "Done" },
			],
			createdAtMs: Date.UTC(2026, 4, 12, 9, 6),
		},
		{
			id: "non-status-lozenge",
			kind: "event",
			actor: {
				id: "github",
				name: "GitHub",
				kind: "agent",
			},
			icon: "linked",
			segments: [
				{ type: "lozenge", text: "1 failed", variant: "danger" },
			],
			createdAtMs: Date.UTC(2026, 4, 12, 9, 7),
		},
	]);

	assert.deepEqual(
		movedInProgress.segments.filter((segment) => segment.type === "lozenge"),
		[
			{ type: "lozenge", text: "To do", variant: "neutral" },
			{ type: "lozenge", text: "In progress", variant: "information" },
		],
	);
	assert.deepEqual(
		movedDone.segments.filter((segment) => segment.type === "lozenge"),
		[
			{ type: "lozenge", text: "In review", variant: "warning" },
			{ type: "lozenge", text: "Done", variant: "success" },
		],
	);
	assert.deepEqual(nonStatus.segments, [
		{ type: "lozenge", text: "1 failed", variant: "danger" },
	]);
});

test("maps agent activity to rich Jira comments with lifecycle tags", async () => {
	const adapter = await loadAdapter();
	const statuses = [
		["running", "Working", "blue"],
		["waiting", "Waiting for you", "yellow"],
		["completed", "Done", "green"],
	];

	for (const [index, [status, text, color]] of statuses.entries()) {
		const [entry] = adapter.mapActivityEventsToJiraEntries([
			{
				id: `activity-${index}`,
				kind: "agent",
				sessionId: `session-${index}`,
				agentId: "research-agent",
				agentName: "Research agent",
				agentAvatarSrc: "/research.svg",
				status,
				title: "Review qualification evidence",
				branch: "rovo/rfp-101-qualification",
				elapsedSeconds: 180 + index,
				commandPreview: "Review the qualification evidence",
				responsePreview: `Latest response ${index}`,
				createdAtMs: Date.UTC(2026, 4, 12, 13, index),
			},
		]);

		assert.deepEqual(entry.actor, {
			id: "jira-work-item-agent-research-agent",
			name: "Research agent",
			kind: "agent",
			avatarSrc: "/research.svg",
		});
		assert.deepEqual(entry.tag, { text, color });
		assert.deepEqual(entry.body, [{ type: "text", text: `Latest response ${index}` }]);
		assert.deepEqual(entry.collapsible, {
			label: "Prompt",
			content: [{ type: "text", text: "Review the qualification evidence" }],
		});
		assert.equal(entry.allowReply, status !== "completed");
		assert.deepEqual(entry.sessionItem, {
			id: `session-${index}`,
			title: "Review qualification evidence",
			state: status === "waiting" ? "needs-input" : status === "completed" ? "complete" : "running",
			agent: {
				name: "Research agent",
				avatarSrc: "/research.svg",
			},
			branch: "rovo/rfp-101-qualification",
			elapsedSeconds: 180 + index,
		});
	}
});

test("maps the human session invoker onto AgentListItem.invokedBy", async () => {
	const adapter = await loadAdapter();
	const [withFace, currentUser, youAlias] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "activity-invoker-face",
			kind: "agent",
			sessionId: "session-invoker-face",
			agentId: "claude-code",
			agentName: "Claude Code",
			agentBrandName: "claude",
			status: "running",
			title: "Lead guest checkout",
			branch: "feature/guest-checkout",
			elapsedSeconds: 120,
			commandPreview: "Implement guest checkout",
			createdAtMs: Date.UTC(2026, 4, 12, 13, 30),
			invokedBy: {
				name: "Jordan Lee",
				avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
			},
		},
		{
			id: "activity-invoker-venn",
			kind: "agent",
			sessionId: "session-invoker-venn",
			agentId: "research-agent",
			agentName: "Research agent",
			agentAvatarSrc: "/research.svg",
			status: "running",
			title: "Review evidence",
			branch: "rovo/review",
			elapsedSeconds: 60,
			commandPreview: "Review the evidence",
			createdAtMs: Date.UTC(2026, 4, 12, 13, 31),
			invokedBy: { name: "Venn" },
		},
		{
			id: "activity-invoker-you",
			kind: "agent",
			sessionId: "session-invoker-you",
			agentId: "code-planner",
			agentName: "Code Planner",
			agentAvatarSrc: "/code-planner.svg",
			status: "running",
			title: "Plan the contract",
			branch: "rovo/plan",
			elapsedSeconds: 30,
			commandPreview: "Define the API contract",
			createdAtMs: Date.UTC(2026, 4, 12, 13, 32),
			invokedBy: { name: "You" },
		},
	]);

	assert.deepEqual(withFace.sessionItem.invokedBy, {
		name: "Jordan Lee",
		avatarSrc: "/avatar-user/andrew-park/color/asow-dev-lime.png",
	});
	assert.deepEqual(currentUser.sessionItem.invokedBy, {
		name: "Venn",
		avatarSrc: "/avatar-user/venn/venn.png",
	});
	assert.deepEqual(youAlias.sessionItem.invokedBy, {
		name: "Venn",
		avatarSrc: "/avatar-user/venn/venn.png",
	});
});

test("maps a human comment progress checklist into the same Agent progress contract", async () => {
	const adapter = await loadAdapter();
	const progressChecklist = [
		{ id: "story-claude-progress-1", label: "Implement SHOP-4821 in the local terminal", completed: true },
		{ id: "story-claude-progress-2", label: "Run focused local checks", completed: true },
		{ id: "story-claude-progress-3", label: "Open PR #1847 and request Priya and Jordan", completed: false },
	];
	const outputs = [{
		id: "story-changed-files",
		title: "Changed 12 files",
		source: "Agent output",
		owner: "feature/shop-4821-guest-checkout",
		iconName: "ai-chat",
	}];
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "story-channel-claude-pr-handoff",
			kind: "human",
			author: { name: "Claude Code", brandName: "claude" },
			content: "Focused local checks pass, so the work is ready for a pull request.",
			progressChecklist,
			outputs,
			createdAtMs: Date.UTC(2026, 4, 12, 13, 20),
		},
	]);

	assert.deepEqual(entry.progressChecklist, progressChecklist);
	assert.deepEqual(entry.outputs, outputs);
});

test("maps an agent progress checklist, outputs, and image proof into its Jira comment", async () => {
	const adapter = await loadAdapter();
	const progressChecklist = [
		{ id: "consult", label: "Consult Code Planner", completed: true },
		{ id: "implement", label: "Implement guest checkout", completed: true },
		{ id: "verify-design", label: "Verify the final design", completed: false },
	];
	const outputs = [{
		id: "guest-checkout-pr",
		title: "Add guest checkout to the storefront",
		source: "Pull request",
		logoName: "github",
		href: "https://github.com/acme/storefront/pull/1847",
		pullRequest: {
			number: 1847,
			status: "Open",
			additions: 86,
			deletions: 21,
		},
	}];
	const imageAttachment = {
		src: "/jira-golden-journeys-v2/guest-checkout-final.png",
		alt: "Final guest checkout design",
		filename: "guest-checkout-final.png",
		href: "/jira-golden-journeys-v2/guest-checkout-final.png",
	};
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "activity-claude-progress",
			kind: "agent",
			sessionId: "session-claude-progress",
			agentId: "claude-code",
			agentName: "Claude Code",
			agentBrandName: "claude",
			status: "running",
			title: "Implement guest checkout",
			branch: "claude/shop-4821-guest-checkout",
			elapsedSeconds: 210,
			commandPreview: "Take the lead on guest checkout",
			responsePreview: "Implementing the approved guest checkout contract.",
			progressChecklist,
			outputs,
			imageAttachment,
			createdAtMs: Date.UTC(2026, 4, 12, 13, 20),
		},
	]);

	assert.deepEqual(entry.progressChecklist, progressChecklist);
	assert.deepEqual(entry.outputs, outputs);
	assert.deepEqual(entry.imageAttachment, imageAttachment);
});

test("maps skill activity to the canonical VPK Rovo logo", async () => {
	const adapter = await loadAdapter();
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "activity-skill-1",
			kind: "agent",
			sessionId: "session-skill-1",
			agentId: "skill:improve-description",
			agentName: "Rovo",
			status: "running",
			title: "Improve description",
			branch: "rovo/risk-review",
			elapsedSeconds: 0,
			commandPreview: "/Improve description",
			responsePreview: "Reviewing the current description…",
			createdAtMs: Date.UTC(2026, 4, 12, 13, 30),
		},
	]);

	assert.deepEqual(entry.actor, {
		id: "jira-work-item-agent-skill:improve-description",
		name: "Rovo",
		kind: "agent",
		vpkLogo: "rovo",
	});
	assert.deepEqual(entry.sessionItem.agent, {
		name: "Rovo",
		vpkLogo: "rovo",
	});
});

test("promotes @Rovo mentions to the canonical VPK logo segment", async () => {
	const adapter = await loadAdapter();
	const [comment] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "comment-rovo",
			kind: "human",
			author: { name: "Venn" },
			content: "Ask @Rovo to follow up.",
			createdAtMs: Date.UTC(2026, 4, 12, 9),
		},
		{
			id: "activity-skill-1",
			kind: "agent",
			sessionId: "session-skill-1",
			agentId: "skill:improve-description",
			agentName: "Rovo",
			status: "running",
			title: "Improve description",
			branch: "rovo/risk-review",
			elapsedSeconds: 0,
			commandPreview: "/Improve description",
			responsePreview: "Reviewing the current description…",
			createdAtMs: Date.UTC(2026, 4, 12, 13, 30),
		},
	]);

	assert.deepEqual(
		comment.body.filter((segment) => segment.type === "agent-mention"),
		[{ type: "agent-mention", text: "Rovo", vpkLogo: "rovo" }],
	);
});

test("maps third-party coding-agent identity through activity, session, and mention surfaces", async () => {
	const adapter = await loadAdapter();
	const [comment, claudeEntry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "comment-claude",
			kind: "human",
			author: { name: "Venn" },
			content: "Ask @Claude Code to implement the change.",
			createdAtMs: Date.UTC(2026, 4, 12, 13, 30),
		},
		{
			id: "activity-claude-branded",
			kind: "agent",
			sessionId: "session-claude-branded",
			agentId: "claude-code",
			agentName: "Claude Code",
			agentAvatarSrc: "/wrong-custom-avatar.svg",
			agentBrandName: "claude",
			status: "running",
			title: "Implement the change",
			branch: "feature/change",
			elapsedSeconds: 10,
			commandPreview: "Implement the change",
			createdAtMs: Date.UTC(2026, 4, 12, 13, 31),
		},
	]);

	assert.deepEqual(claudeEntry.actor, {
		id: "jira-work-item-agent-claude-code",
		name: "Claude Code",
		kind: "agent",
		brandName: "claude",
	});
	assert.deepEqual(claudeEntry.sessionItem.agent, {
		name: "Claude Code",
		brandName: "claude",
	});
	assert.deepEqual(comment.body, [
		{ type: "text", text: "Ask " },
		{ type: "agent-mention", text: "Claude Code", brandName: "claude" },
		{ type: "text", text: " to implement the change." },
	]);
});

test("maps a Claude Code channel comment to the brand mark instead of a template avatar", async () => {
	const adapter = await loadAdapter();
	const [entry] = adapter.mapActivityEventsToJiraEntries([
		{
			id: "comment-claude-handoff",
			kind: "human",
			author: {
				name: "Claude Code",
				brandName: "claude",
				avatarUrl: "/avatar-agent-new/lime/auto-dev.svg",
			},
			content: "PR #1847 is open.",
			createdAtMs: Date.UTC(2026, 4, 12, 13, 30),
		},
	]);

	assert.deepEqual(entry.actor, {
		id: "jira-work-item-person-claude-code",
		name: "Claude Code",
		kind: "agent",
		brandName: "claude",
	});
	assert.equal(entry.actor.avatarSrc, undefined);
});
