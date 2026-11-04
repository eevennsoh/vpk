const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const MODULE_PATH = join(__dirname, "pull-request-activity-adapter.ts");

let adapterPromise;
function loadAdapter() {
	if (!adapterPromise) {
		adapterPromise = esbuild
			.build({
				entryPoints: [MODULE_PATH],
				bundle: true,
				format: "cjs",
				platform: "node",
				loader: { ".css": "empty" },
				tsconfig: join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(
				result.outputFiles[0].text,
				"pull-request-activity-adapter-harness.cjs",
			));
	}
	return adapterPromise;
}

const VENN = { id: "venn", name: "Venn", kind: "person" };
const GITHUB = { id: "github", name: "GitHub", kind: "app" };
const CODEX = { id: "codex", name: "Codex", kind: "app" };

test("adapts provider-neutral activity oldest first without mutating its input", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const activity = [
		{
			id: "ready",
			kind: "ready-to-merge",
			actor: GITHUB,
			occurredAtMs: 300,
			timestamp: "now",
		},
		{
			id: "opened",
			kind: "opened",
			actor: VENN,
			occurredAtMs: 100,
			timestamp: "earlier",
			baseBranch: "main",
			headBranch: "feature/checkout",
		},
		{
			id: "checks",
			kind: "checks-completed",
			actor: GITHUB,
			occurredAtMs: 200,
			timestamp: "later",
			passed: 18,
			total: 18,
		},
	];

	const entries = adaptPullRequestActivity(activity);

	assert.deepEqual(entries.map(({ id }) => id), [
		"pull-request-opened",
		"pull-request-checks",
		"pull-request-ready",
	]);
	assert.deepEqual(activity.map(({ id }) => id), ["ready", "opened", "checks"]);
	assert.equal(entries[0].actor.kind, "person");
	assert.equal(entries[0].actor.name, "Venn");
	assert.equal(entries[0].icon, "pull-request");
	assert.deepEqual(entries[0].segments, [
		{ type: "text", text: "opened the pull request from " },
		{ type: "code", text: "feature/checkout" },
		{ type: "text", text: " into " },
		{ type: "code", text: "main" },
	]);
	assert.equal(entries[1].actor.brandName, "github");
	assert.equal(entries[1].icon, "app");
	assert.deepEqual(entries[1].segments.at(-1), {
		type: "lozenge",
		text: "18/18 passed",
		variant: "success",
	});
	assert.equal(entries[2].icon, "app");
});

test("maps every SCM event kind to a gutter EventGlyph icon", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const entries = adaptPullRequestActivity([
		{
			id: "opened",
			kind: "opened",
			actor: VENN,
			occurredAtMs: 1,
			timestamp: "a",
			baseBranch: "main",
			headBranch: "feature/x",
		},
		{
			id: "push",
			kind: "commits-pushed",
			actor: {
				id: "claude-code",
				name: "Claude Code",
				kind: "agent",
				brandName: "claude",
			},
			occurredAtMs: 2,
			timestamp: "b",
			commitCount: 4,
			headSha: "d34c112",
		},
		{
			id: "checks",
			kind: "checks-completed",
			actor: GITHUB,
			occurredAtMs: 3,
			timestamp: "c",
			passed: 1,
			total: 1,
		},
		{
			id: "ready",
			kind: "ready-to-merge",
			actor: GITHUB,
			occurredAtMs: 4,
			timestamp: "d",
		},
	]);

	assert.deepEqual(
		entries.map(({ kind, icon }) => ({ kind, icon })),
		[
			{ kind: "event", icon: "pull-request" },
			{ kind: "event", icon: "commit" },
			{ kind: "event", icon: "app" },
			{ kind: "event", icon: "app" },
		],
	);
});

test("prefers agent brand marks over template avatars", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const [entry] = adaptPullRequestActivity([{
		id: "push",
		kind: "commits-pushed",
		actor: {
			id: "claude-code",
			name: "Claude Code",
			kind: "agent",
			brandName: "claude",
			avatarSrc: "/avatar-agent-new/lime/auto-dev.svg",
		},
		occurredAtMs: 100,
		timestamp: "18 minutes ago",
		commitCount: 4,
		headSha: "d34c112",
	}]);

	assert.deepEqual(entry.actor, {
		id: "claude-code",
		name: "Claude Code",
		kind: "agent",
		brandName: "claude",
	});
	// Gutter uses the commit glyph; actor branding stays for the inline Tag.
	assert.equal(entry.icon, "commit");
});

test("uses singular commit copy for one pushed commit", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const [entry] = adaptPullRequestActivity([{
		id: "fix-push",
		kind: "commits-pushed",
		actor: { id: "codex", name: "Codex", kind: "app" },
		occurredAtMs: 100,
		timestamp: "11 minutes ago",
		commitCount: 1,
		headSha: "8b4e6fa",
	}]);

	assert.equal(entry.kind, "event");
	assert.deepEqual(entry.segments[0], {
		type: "text",
		text: "pushed 1 commit ending in ",
	});
});

test("moves review discussion into read-only Jira Activity comments", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const [entry] = adaptPullRequestActivity([{
		id: "review",
		kind: "review-submitted",
		actor: {
			id: "code-planner",
			name: "Code Planner",
			kind: "agent",
			avatarSrc: "/avatar-agent-new/lime/auto-dev.svg",
		},
		occurredAtMs: 100,
		timestamp: "6 minutes ago",
		decision: "approved",
		body: "Order creation stays server-owned.",
		filePath: "backend/services/guest-order-service.js",
	}]);

	assert.equal(entry.kind, "comment");
	assert.equal(entry.allowReply, false);
	assert.equal(entry.tag, undefined);
	assert.deepEqual(entry.statusLozenge, { text: "Approved", variant: "success" });
	assert.deepEqual(entry.body, [
		{ type: "text", text: "Approved this pull request. Order creation stays server-owned." },
		{ type: "text", text: " Reviewed " },
		{ type: "link", text: "backend/services/guest-order-service.js" },
	]);
});

test("preserves provider comments, review replies, and connected app branding", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const entries = adaptPullRequestActivity([
		{
			id: "actions",
			kind: "comment-posted",
			actor: { id: "github-actions", name: "github-actions", kind: "app" },
			occurredAtMs: 100,
			timestamp: "7 minutes ago",
			tag: "Bot",
			body: "React Doctor found no new issues.",
			detail: { label: "Review details", body: "Reviewed commit abc1234." },
		},
		{
			id: "codex",
			kind: "review-submitted",
			actor: { id: "codex", name: "Codex", kind: "app" },
			occurredAtMs: 200,
			timestamp: "5 minutes ago",
			decision: "commented",
			body: "Narrow the nullable address.",
			filePath: "guest-order-service.js",
			allowReply: true,
			allowResolve: true,
			resolved: true,
			detail: { label: "About Codex in GitHub", body: "Automated review." },
			replies: [{
				id: "fixed",
				actor: VENN,
				timestamp: "3 minutes ago",
				body: "Fixed in abc1234.",
			}],
		},
	]);

	assert.equal(entries[0].actor.brandName, "github");
	assert.deepEqual(entries[0].tag, { text: "Bot" });
	assert.deepEqual(entries[0].collapsible, {
		label: "Review details",
		content: [{ type: "text", text: "Reviewed commit abc1234." }],
	});
	assert.equal(entries[1].actor.brandName, "openai-codex");
	assert.equal(entries[1].allowReply, true);
	assert.equal(entries[1].allowResolve, true);
	assert.equal(entries[1].resolved, true);
	assert.deepEqual(entries[1].statusLozenge, {
		text: "Reviewed",
		variant: "information",
	});
	assert.deepEqual(entries[1].body[0], {
		type: "text",
		text: "Reviewed this pull request. Narrow the nullable address.",
	});
	assert.equal(entries[1].replies[0].actor.name, "Venn");
	assert.equal(entries[1].replies[0].body, "Fixed in abc1234.");
});

test("maps review decisions to semantic activity lozenges", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const entries = adaptPullRequestActivity([
		{
			id: "approved",
			kind: "review-submitted",
			actor: VENN,
			occurredAtMs: 1,
			timestamp: "3 minutes ago",
			decision: "approved",
			body: "Looks good.",
		},
		{
			id: "reviewed",
			kind: "review-submitted",
			actor: VENN,
			occurredAtMs: 2,
			timestamp: "2 minutes ago",
			decision: "commented",
			body: "Left a note.",
		},
		{
			id: "changes",
			kind: "review-submitted",
			actor: VENN,
			occurredAtMs: 3,
			timestamp: "1 minute ago",
			decision: "changes-requested",
			body: "Please revise.",
		},
	]);

	assert.deepEqual(
		entries.map(({ statusLozenge }) => statusLozenge),
		[
			{ text: "Approved", variant: "success" },
			{ text: "Reviewed", variant: "information" },
			{ text: "Changes requested", variant: "danger" },
		],
	);
});

test("maps unresolved review discussion threads with reply and resolve", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const [entry] = adaptPullRequestActivity([{
		id: "priya-thread",
		kind: "review-comment",
		parentActivityId: "automated-review",
		actor: {
			id: "priya-narayanan",
			name: "Priya Narayanan",
			kind: "person",
		},
		occurredAtMs: 100,
		timestamp: "6 minutes ago",
		body: "Can we assert the recoverable validation path?",
		filePath: "tests/storefront/guest-checkout.spec.ts",
		allowReply: true,
		allowResolve: true,
		resolved: false,
	}]);

	assert.equal(entry.kind, "comment");
	assert.equal(entry.parentId, "pull-request-automated-review");
	assert.equal(entry.allowReply, true);
	assert.equal(entry.allowResolve, true);
	assert.equal(entry.resolved, false);
	assert.equal(entry.tag, undefined);
	assert.deepEqual(entry.body, [
		{ type: "text", text: "Can we assert the recoverable validation path?" },
		{ type: "text", text: " Commented on " },
		{ type: "link", text: "tests/storefront/guest-checkout.spec.ts" },
	]);
});

test("groups sibling review threads under one review summary with independent state", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const entries = adaptPullRequestActivity([
		{
			id: "automated-review",
			kind: "review-submitted",
			actor: GITHUB,
			occurredAtMs: 100,
			timestamp: "7 minutes ago",
			decision: "commented",
			body: "Found two review comments.",
			allowReply: false,
			allowResolve: false,
		},
		{
			id: "thread-a",
			kind: "review-comment",
			parentActivityId: "automated-review",
			actor: CODEX,
			occurredAtMs: 110,
			timestamp: "6 minutes ago",
			body: "First thread.",
			filePath: "first.ts",
			resolved: true,
			replies: [{
				id: "thread-a-fix",
				actor: VENN,
				timestamp: "4 minutes ago",
				body: "Fixed in abc1234.",
			}],
		},
		{
			id: "thread-b",
			kind: "review-comment",
			parentActivityId: "automated-review",
			actor: CODEX,
			occurredAtMs: 120,
			timestamp: "5 minutes ago",
			body: "Second thread.",
			filePath: "second.ts",
			resolved: false,
		},
	]);

	assert.equal(entries[0].allowReply, false);
	assert.equal(entries[0].allowResolve, false);
	assert.equal(entries[0].actor.name, "GitHub");
	assert.ok(entries.slice(1).every(({ actor }) => actor.name === "Codex"));
	assert.equal(entries[1].replies[0].actor.name, "Venn");
	assert.deepEqual(
		entries.slice(1).map(({ parentId, resolved }) => ({ parentId, resolved })),
		[
			{ parentId: "pull-request-automated-review", resolved: true },
			{ parentId: "pull-request-automated-review", resolved: false },
		],
	);
});

test("changes the activity revision when provider payload values change", async () => {
	const { getPullRequestActivityRevision } = await loadAdapter();
	const activity = [{
		id: "checks",
		kind: "checks-completed",
		actor: GITHUB,
		occurredAtMs: 100,
		timestamp: "later",
		passed: 2,
		total: 3,
	}];

	assert.notEqual(
		getPullRequestActivityRevision(activity),
		getPullRequestActivityRevision([{ ...activity[0], passed: 3 }]),
	);
});

test("keeps equal-time provider events in source order", async () => {
	const { adaptPullRequestActivity } = await loadAdapter();
	const entries = adaptPullRequestActivity([
		{
			id: "push-a",
			kind: "commits-pushed",
			actor: VENN,
			occurredAtMs: 100,
			timestamp: "1 minute ago",
			commitCount: 2,
			headSha: "abc1234",
		},
		{
			id: "thread",
			kind: "thread-resolved",
			actor: VENN,
			occurredAtMs: 100,
			timestamp: "1 minute ago",
			filePath: "checkout.tsx",
		},
	]);

	assert.deepEqual(entries.map(({ id }) => id), [
		"pull-request-push-a",
		"pull-request-thread",
	]);
});
