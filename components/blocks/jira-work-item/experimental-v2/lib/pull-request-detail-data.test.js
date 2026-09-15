const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

const MODULE_PATH = join(__dirname, "pull-request-detail-data.ts");

let detailDataPromise;
function loadDetailData() {
	if (!detailDataPromise) {
		detailDataPromise = esbuild
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
				"pull-request-detail-data-harness.cjs",
			));
	}
	return detailDataPromise;
}

function pullRequestEntry(overrides = {}) {
	return {
		id: "pr-detail",
		kind: "event",
		actor: { id: "github", name: "GitHub", kind: "app", brandName: "github" },
		timestamp: "2m ago",
		segments: [],
		pullRequest: {
			number: 1847,
			title: "Implement guest checkout without account creation",
			status: "Open",
			additions: 86,
			deletions: 21,
			repository: "acme/storefront",
			...overrides,
		},
	};
}

test("resolves the #1847 guest-checkout guided review fixture", async () => {
	const { resolvePullRequestDetailData } = await loadDetailData();
	const detail = resolvePullRequestDetailData(pullRequestEntry());

	assert.ok(detail);
	assert.equal(detail.identity, "acme/storefront#1847");
	assert.equal(detail.url, "https://github.com/acme/storefront/pull/1847");
	assert.equal(detail.authorName, "Venn");
	assert.equal(detail.authorAvatarSrc, "/avatar-user/venn/venn.png");
	assert.equal(detail.authorKind, "person");
	assert.equal(detail.baseBranch, "main");
	assert.equal(detail.headBranch, "feature/shop-4821-guest-checkout");
	assert.deepEqual(detail.provider, { id: "github", name: "GitHub" });
	assert.equal(detail.createdTime, "25 minutes ago");
	assert.equal(detail.updatedTime, "2m ago");
	assert.equal(detail.reviewDecision, "review-required");
	assert.equal(detail.mergeState, "blocked");
	// Approvers are people, not agents — every avatar is a human portrait.
	// Author (Venn) is omitted: they don't approve their own work.
	assert.deepEqual(
		detail.reviewers.map(({ name, status }) => ({ name, status })),
		[
			{ name: "Priya Narayanan", status: "pending" },
			{ name: "Jordan Lee", status: "pending" },
		],
	);
	assert.ok(detail.reviewers.every((reviewer) => reviewer.kind === "person"));
	assert.ok(detail.reviewers.every((reviewer) => reviewer.avatarSrc?.startsWith("/avatar-user/")));
	assert.deepEqual(detail.labels.map(({ name }) => name), ["checkout", "customer experience"]);
	assert.equal(detail.commits.length, 6);
	assert.ok(
		detail.commits.every(
			(commit) =>
				typeof commit.url === "string" &&
				commit.url === `https://github.com/acme/storefront/commit/${commit.shortSha}`,
		),
	);
	assert.deepEqual(
		detail.commits.map((commit) => ({ name: commit.author.name, kind: commit.author.kind })),
		[
			{ name: "Venn", kind: "person" },
			{ name: "Maya Chen", kind: "person" },
			{ name: "Jordan Lee", kind: "person" },
			{ name: "Priya Narayanan", kind: "person" },
			{ name: "Sam Rivera", kind: "person" },
			{ name: "Maya Chen", kind: "person" },
		],
	);
	assert.ok(detail.commits.every((commit) => commit.author.kind === "person"));
	assert.ok(detail.commits.every((commit) => commit.author.avatarSrc?.startsWith("/avatar-user/")));
	assert.equal(new Set(detail.commits.map((commit) => commit.author.id)).size >= 4, true);
	assert.deepEqual(
		detail.checks.map(({ name, status }) => ({ name, status })),
		[
			{ name: "Lint and typecheck", status: "passed" },
			{ name: "Unit tests", status: "passed" },
			{ name: "Guest checkout browser tests", status: "passed" },
		],
	);
	// Demo-only checks: no SCM URLs so rows never navigate to a real provider.
	assert.ok(detail.checks.every((check) => !("url" in check)));
	assert.equal(detail.guidedReview?.summary.length, 3);
	assert.deepEqual(detail.guidedReview?.metrics, {
		risk: {
			label: "Low",
			filled: 1,
			description: "Contained to guest checkout entry and the dedicated guest-order route.",
		},
		impact: {
			label: "High",
			filled: 5,
			description: "Affects the shared checkout path for all shoppers without accounts.",
		},
		reviewDepth: {
			label: "3/5",
			filled: 3,
			description: "Spans storefront flow, guest-order API, and recovery coverage.",
		},
		mergeConfidence: {
			label: "4/5",
			filled: 4,
			description: "Browser suite and recoverable-error checks support a safe merge.",
		},
	});
	assert.match(detail.description, /^Adds a guest checkout path/u);
	assert.match(detail.description, /#### Summary\n\n- Lets shoppers complete checkout without creating an account\./u);
	assert.match(detail.description, /#### Changes/u);
	assert.match(detail.description, /#### Test plan/u);
	assert.match(detail.description, /- \[x\] From cart or sign-in/u);
	assert.doesNotMatch(detail.description, /- \[ \] /u);
	assert.equal(detail.guidedReview?.description, detail.description);
	assert.equal(
		detail.activity.find((activity) => activity.kind === "checks-completed")?.passed,
		detail.checks.filter((check) => check.status === "passed").length,
	);
	assert.equal(
		detail.activity.find((activity) => activity.kind === "checks-completed")?.total,
		detail.checks.length,
	);
	assert.deepEqual(
		detail.activity.map(({ kind }) => kind),
		[
			"opened",
			"commits-pushed",
			"review-submitted",
			"review-comment",
			"review-comment",
			"commits-pushed",
			"checks-completed",
		],
	);
	const opened = detail.activity.find((activity) => activity.id === "opened");
	assert.deepEqual(opened?.actor, {
		id: "venn",
		name: "Venn",
		kind: "person",
		avatarSrc: "/avatar-user/venn/venn.png",
	});
	assert.equal(opened?.kind, "opened");
	if (opened?.kind === "opened") {
		assert.equal(opened.headBranch, "feature/shop-4821-guest-checkout");
		assert.equal(opened.baseBranch, "main");
		assert.equal(opened.timestamp, "25 minutes ago");
	}
	assert.equal(
		detail.activity.find((activity) => activity.actor.name === "Claude")?.actor.brandName,
		"claude",
	);
	const fixPush = detail.activity.find((activity) => activity.id === "fix-commits-pushed");
	assert.equal(fixPush?.kind, "commits-pushed");
	assert.equal(fixPush?.actor.name, "Codex");
	const reviewSummary = detail.activity.find((activity) => activity.id === "github-actions-review");
	assert.equal(reviewSummary?.kind, "review-submitted");
	assert.equal(reviewSummary?.actor.name, "github-actions");
	assert.equal(reviewSummary?.allowReply, false);
	assert.equal(reviewSummary?.allowResolve, false);
	const reviewThreads = detail.activity.filter(
		(activity) => activity.kind === "review-comment",
	);
	assert.deepEqual(
		reviewThreads.map(({ id }) => id),
		["delivery-address-review-thread", "checkout-draft-review-thread"],
	);
	for (const reviewThread of reviewThreads) {
		assert.equal(reviewThread.parentActivityId, "github-actions-review");
		assert.equal(reviewThread.actor.name, "Codex");
		assert.equal(reviewThread.allowReply, true);
		assert.equal(reviewThread.allowResolve, true);
		assert.equal(reviewThread.resolved, true);
		assert.equal(reviewThread.replies?.[0]?.actor.name, "Venn");
	}
	assert.ok(detail.activity.every((activity) => activity.kind !== "thread-resolved"));
	assert.doesNotMatch(
		readFileSync(MODULE_PATH, "utf8"),
		/basic-coding-agent-template/u,
	);
	assert.deepEqual(
		detail.activity.map(({ occurredAtMs }) => occurredAtMs),
		[...detail.activity.map(({ occurredAtMs }) => occurredAtMs)].sort((left, right) => left - right),
	);
	assert.deepEqual(
		detail.activity
			.filter((activity) => activity.kind === "commits-pushed")
			.map(({ commitCount, headSha }) => ({ commitCount, headSha })),
		[
			{ commitCount: 4, headSha: "d34c112" },
			{ commitCount: 1, headSha: "8b4e6fa" },
		],
	);
	assert.deepEqual(
		detail.commits.map(({ shortSha, timestamp }) => ({ shortSha, timestamp })),
		[
			{ shortSha: "5f02a91", timestamp: "24 minutes ago" },
			{ shortSha: "91c73d4", timestamp: "22 minutes ago" },
			{ shortSha: "a2f74c1", timestamp: "20 minutes ago" },
			{ shortSha: "d34c112", timestamp: "18 minutes ago" },
			{ shortSha: "8b4e6fa", timestamp: "14 minutes ago" },
			{ shortSha: "f8cc291", timestamp: "12 minutes ago" },
		],
	);
	assert.deepEqual(
		detail.guidedReview?.chapters.map((chapter) => ({
			title: chapter.title,
			description: chapter.description,
		})),
		[
			{
				title: "Start a guest checkout",
				description:
					"Follow the new storefront path from the guest choice through validated delivery details. Confirm GuestCheckoutForm replaces the account-required entry and submits through createGuestOrder. Check that delivery and contact fields stay populated when restoreCheckoutDraft runs after a recoverable failure.",
			},
			{
				title: "Keep order creation server-owned",
				description:
					"Review the narrow API boundary and the service that owns privileged commerce calls. POST /guest-orders should accept only cart, delivery, and email, then delegate to guestOrderService.create. Confirm guest orders set customerMode: \"guest\" and return a recovery token instead of creating orders from the raw request body.",
			},
			{
				title: "Recover safely and verify the flow",
				description:
					"Check recoverable-error behavior and the browser test that completes a guest order. Declined payments and validation errors should keep safe checkout fields populated so the shopper can retry. Walk the Playwright path from Checkout as guest through confirmation, and confirm a failed retry does not create a duplicate order.",
			},
		],
	);
	assert.deepEqual(
		detail.guidedReview?.files.map((file) => ({
			path: file.path,
			additions: file.additions,
			deletions: file.deletions,
		})),
		[
			{ path: "components/storefront/checkout/guest-checkout-flow.tsx", additions: 34, deletions: 8 },
			{ path: "backend/routes/guest-orders.js", additions: 24, deletions: 6 },
			{ path: "backend/services/guest-order-service.js", additions: 18, deletions: 4 },
			{ path: "tests/storefront/guest-checkout.spec.ts", additions: 10, deletions: 3 },
		],
	);
	assert.ok(
		detail.guidedReview?.chapters.every((chapter) => chapter.fileIds.length >= 2),
		"every guided review chapter should list at least two files",
	);
	assert.deepEqual(
		detail.guidedReview?.chapters.map((chapter) => chapter.fileIds),
		[
			["guest-checkout-flow", "guest-orders-route"],
			["guest-orders-route", "guest-order-service"],
			["guest-checkout-flow", "guest-checkout-spec"],
		],
	);
	assert.ok(detail.guidedReview?.files.every((file) => file.code.startsWith("diff --git")));
	assert.ok(detail.guidedReview?.files.every((file) => (
		file.status === "modified"
		&& file.oldContents.length > 0
		&& file.newContents.length > 0
		&& file.explorerPath === file.path
	)));
});

test("guided review starts with no chapters checked, including when already approved", async () => {
	const {
		resolveInitialReviewedChapterIds,
		resolvePullRequestDetailData,
	} = await loadDetailData();
	const review = resolvePullRequestDetailData(pullRequestEntry())?.guidedReview;

	assert.ok(review);
	assert.deepEqual(
		[...resolveInitialReviewedChapterIds(review)],
		[],
	);
	assert.deepEqual(
		[...resolveInitialReviewedChapterIds(review, "available")],
		[],
	);
	// Approved merge evidence must not pre-check Guide chapters (Submit review badge).
	assert.deepEqual(
		[...resolveInitialReviewedChapterIds(review, "approved")],
		[],
	);
	// Initial seed is stable — not scroll/visibility.
	assert.deepEqual(
		[...resolveInitialReviewedChapterIds(review)],
		[...resolveInitialReviewedChapterIds(review)],
	);
});

test("an approved #1847 entry adds teammate approvals and ready-to-merge evidence", async () => {
	const { resolvePullRequestDetailData } = await loadDetailData();
	const detail = resolvePullRequestDetailData(pullRequestEntry({
		mergeState: "ready",
		reviewDecision: "approved",
	}));

	assert.ok(detail);
	assert.equal(detail.reviewDecision, "approved");
	assert.equal(detail.mergeState, "ready");
	assert.deepEqual(
		detail.reviewers.map(({ name, status }) => ({ name, status })),
		[
			{ name: "Priya Narayanan", status: "approved" },
			{ name: "Jordan Lee", status: "approved" },
		],
	);
	assert.deepEqual(detail.activity.slice(-3).map(({ kind }) => kind), [
		"review-submitted",
		"review-submitted",
		"ready-to-merge",
	]);
	assert.deepEqual(
		detail.activity.slice(-3, -1).map(({ actor, decision }) => ({
			actorKind: actor.kind,
			decision,
			name: actor.name,
		})),
		[
			{ actorKind: "person", decision: "approved", name: "Priya Narayanan" },
			{ actorKind: "person", decision: "approved", name: "Jordan Lee" },
		],
	);
});

test("explicit reviewer state preserves a partial approval and its activity", async () => {
	const { resolvePullRequestDetailData } = await loadDetailData();
	const detail = resolvePullRequestDetailData(pullRequestEntry({
		reviewDecision: "review-required",
		reviewers: [
			{ id: "priya-narayanan", name: "Priya Narayanan", status: "approved" },
			{ id: "jordan-lee", name: "Jordan Lee", status: "pending" },
		],
	}));

	assert.deepEqual(
		detail?.reviewers.map(({ name, status }) => ({ name, status })),
		[
			{ name: "Priya Narayanan", status: "approved" },
			{ name: "Jordan Lee", status: "pending" },
		],
	);
	assert.deepEqual(
		detail?.activity.filter((activity) => activity.id === "priya-review")
			.map((activity) => activity.actor.name),
		["Priya Narayanan"],
	);
});

test("changes-requested #1847 marks Priya with a declined Approvers badge", async () => {
	const { resolvePullRequestDetailData } = await loadDetailData();
	const detail = resolvePullRequestDetailData(pullRequestEntry({
		mergeState: "blocked",
		reviewDecision: "changes-requested",
	}));

	assert.ok(detail);
	assert.equal(detail.reviewDecision, "changes-requested");
	assert.equal(detail.mergeState, "blocked");
	assert.deepEqual(
		detail.reviewers.map(({ name, status }) => ({ name, status })),
		[
			{ name: "Priya Narayanan", status: "changes-requested" },
			{ name: "Jordan Lee", status: "pending" },
		],
	);
});

test("keeps URL identity while recognizing the repository fixture", async () => {
	const { resolvePullRequestDetailData } = await loadDetailData();
	const url = "https://github.com/acme/storefront/pull/1847";
	const detail = resolvePullRequestDetailData(pullRequestEntry({ url }));

	assert.equal(detail?.identity, url);
	assert.ok(detail?.guidedReview);
});

test("uses live SCM check state to block a guided pull request", async () => {
	const { resolvePullRequestDetailData } = await loadDetailData();
	const checks = [
		{ id: "lint-types", name: "Lint and typecheck", status: "failed", details: "Failed after 42s" },
		{ id: "unit-tests", name: "Unit tests", status: "passed", details: "418 tests" },
	];
	const detail = resolvePullRequestDetailData(pullRequestEntry({
		checks,
		reviewDecision: "review-required",
	}));

	assert.equal(detail?.mergeState, "blocked");
	assert.equal(detail?.reviewDecision, "review-required");
	assert.deepEqual(detail?.checks, checks);
	assert.deepEqual(
		detail?.reviewers.map(({ name, status }) => ({ name, status })),
		[
			{ name: "Priya Narayanan", status: "pending" },
			{ name: "Jordan Lee", status: "pending" },
		],
	);
	assert.match(detail?.description ?? "", /- \[ \] From cart or sign-in/u);
	assert.doesNotMatch(detail?.description ?? "", /- \[x\] /u);
	assert.equal(detail?.guidedReview?.description, detail?.description);
	assert.deepEqual(detail?.activity.map(({ kind }) => kind), [
		"opened",
		"commits-pushed",
		"review-submitted",
		"review-comment",
		"review-comment",
		"checks-completed",
	]);
	const failedThreads = detail?.activity.filter(
		(activity) => activity.kind === "review-comment",
	);
	assert.equal(failedThreads?.length, 2);
	assert.ok(failedThreads?.every((thread) => thread.resolved === false));
	assert.ok(failedThreads?.every((thread) => thread.replies === undefined));
	assert.equal(detail?.activity.at(-1)?.kind, "checks-completed");
	assert.equal(detail?.activity.at(-1)?.passed, 1);
	assert.equal(detail?.activity.at(-1)?.total, 2);
});

test("a fix rerun retains the review thread and adds the repair push before checks settle", async () => {
	const { resolvePullRequestDetailData } = await loadDetailData();
	const detail = resolvePullRequestDetailData(pullRequestEntry({
		checks: [
			{
				id: "lint-types",
				name: "Lint and typecheck",
				status: "running",
				details: "Rerunning after delivery-address repair",
			},
			{
				id: "unit-tests",
				name: "Unit tests",
				status: "passed",
				details: "418 tests",
			},
		],
		reviewDecision: "review-required",
	}));

	assert.deepEqual(detail?.activity.map(({ kind }) => kind), [
		"opened",
		"commits-pushed",
		"review-submitted",
		"review-comment",
		"review-comment",
		"commits-pushed",
	]);
	const rerunThreads = detail?.activity.filter(
		(activity) => activity.kind === "review-comment",
	);
	assert.equal(rerunThreads?.length, 2);
	assert.ok(rerunThreads?.every((thread) => thread.resolved === true));
	assert.ok(rerunThreads?.every((thread) => thread.actor.name === "Codex"));
	assert.ok(rerunThreads?.every((thread) => thread.replies?.[0]?.actor.name === "Venn"));
	assert.equal(detail?.activity.at(-1)?.actor.name, "Codex");
	assert.equal(detail?.activity.at(-1)?.id, "fix-commits-pushed");
});

test("shows the checks spinner only while a check row is non-terminal", async () => {
	const { arePullRequestChecksInProgress, resolvePullRequestDetailData } = await loadDetailData();
	const checks = [
		{
			id: "lint-types",
			name: "Lint and typecheck",
			status: "failed",
			details: "Failed after 42s · deliveryAddress may be null",
		},
		{
			id: "unit-tests",
			name: "Unit tests",
			status: "passed",
			details: "418 tests in 2m 46s",
		},
		{
			id: "browser-tests",
			name: "Guest checkout browser tests",
			status: "passed",
			details: "5 scenarios in 1m 32s",
		},
	];
	const detail = resolvePullRequestDetailData(pullRequestEntry({
		checks,
		mergeState: "blocked",
		reviewDecision: "review-required",
	}));

	assert.ok(detail);
	assert.equal(detail.mergeState, "blocked");
	assert.equal(
		detail.checks.filter((check) => check.status === "passed").length,
		2,
	);
	assert.equal(detail.checks.length, 3);
	assert.equal(arePullRequestChecksInProgress(detail.checks), false);

	const settled = resolvePullRequestDetailData(pullRequestEntry());
	assert.equal(settled?.mergeState, "blocked");
	assert.equal(arePullRequestChecksInProgress(settled.checks), false);
	assert.equal(arePullRequestChecksInProgress([{
		id: "running",
		name: "Running",
		status: "running",
		details: "In progress",
	}]), true);
});

test("falls back to metadata-only overview for other pull requests", async () => {
	const { resolvePullRequestDetailData } = await loadDetailData();
	const detail = resolvePullRequestDetailData(pullRequestEntry({
		number: 1901,
		title: "Routine dependency update",
	}));

	assert.equal(detail?.number, 1901);
	assert.equal(detail?.guidedReview, null);
	assert.equal(detail?.description, "");
	assert.deepEqual(detail?.activity, []);
	assert.equal(detail?.reviewDecision, "not-required");
	assert.equal(detail?.mergeState, "blocked");
	assert.equal(resolvePullRequestDetailData({ ...pullRequestEntry(), pullRequest: undefined }), null);
});

test("recognizes provider-neutral pull request URLs", async () => {
	const { resolvePullRequestDetailData } = await loadDetailData();
	const detail = resolvePullRequestDetailData(pullRequestEntry({
		number: 77,
		url: "https://bitbucket.org/atlassian/storefront/pull-requests/77",
	}));

	assert.deepEqual(detail?.provider, { id: "bitbucket", name: "Bitbucket" });
});
