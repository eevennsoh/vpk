const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(process.cwd() + "/scripts/lib/esbuild-cjs-loader.js");

// Story-chapter progression and Activity chronology split from jira-golden-journeys-v2.test.js
// so the parent file stays inside the default file-size budget.

let storyModulePromise;
function loadStoryModule() {
	if (!storyModulePromise) {
		storyModulePromise = esbuild
			.build({
				entryPoints: [path.join(__dirname, "data/hotfix-story.ts")],
				bundle: true,
				format: "cjs",
				loader: { ".css": "empty" },
				platform: "node",
				tsconfig: path.join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(
				result.outputFiles[0].text,
				"jira-golden-journeys-v2-story-chapters-harness.cjs",
			));
	}
	return storyModulePromise;
}

let stateModulePromise;
function loadStateModule() {
	if (!stateModulePromise) {
		stateModulePromise = esbuild
			.build({
				entryPoints: [path.join(process.cwd(), "components/blocks/jira-work-item/data/session-state.ts")],
				bundle: true,
				format: "cjs",
				loader: { ".css": "empty" },
				platform: "node",
				tsconfig: path.join(process.cwd(), "tsconfig.json"),
				write: false,
			})
			.then((result) => loadCjsModuleFromText(
				result.outputFiles[0].text,
				"jira-golden-journeys-v2-story-chapters-session-state-harness.cjs",
			));
	}
	return stateModulePromise;
}

let pullRequestChromeModulePromise;
function loadPullRequestChromeModules() {
	if (!pullRequestChromeModulePromise) {
		pullRequestChromeModulePromise = Promise.all([
			esbuild
				.build({
					entryPoints: [
						path.join(
							process.cwd(),
							"components/blocks/jira-work-item/experimental-v2/lib/jira-activity-adapter.ts",
						),
					],
					bundle: true,
					format: "cjs",
					loader: { ".css": "empty" },
					platform: "node",
					tsconfig: path.join(process.cwd(), "tsconfig.json"),
					write: false,
				})
				.then((result) => loadCjsModuleFromText(
					result.outputFiles[0].text,
					"jira-golden-journeys-v2-story-chapters-pr-adapter-harness.cjs",
				)),
			esbuild
				.build({
					entryPoints: [
						path.join(
							process.cwd(),
							"components/blocks/jira-work-item/experimental-v2/lib/pull-request-phases.ts",
						),
					],
					bundle: true,
					format: "cjs",
					loader: { ".css": "empty" },
					platform: "node",
					tsconfig: path.join(process.cwd(), "tsconfig.json"),
					write: false,
				})
				.then((result) => loadCjsModuleFromText(
					result.outputFiles[0].text,
					"jira-golden-journeys-v2-story-chapters-pr-phases-harness.cjs",
				)),
		]);
	}
	return pullRequestChromeModulePromise;
}

test("Claude leads one evolving A2A thread with checklist and design evidence", async () => {
	const story = await loadStoryModule();
	const plan = story.createJiraAgentsStoryState("plan");
	const buildReady = story.createJiraAgentsStoryState("build", { buildStep: "ready" });
	const buildImplementing = story.createJiraAgentsStoryState("build", { buildStep: "implementing" });
	const buildVerifying = story.createJiraAgentsStoryState("build", { buildStep: "verifying" });
	const build = story.createJiraAgentsStoryState("build");
	const review = story.createJiraAgentsStoryState("review");
	const fix = story.createJiraAgentsStoryState("fix");
	const approve = story.createJiraAgentsStoryState("approve");
	const release = story.createJiraAgentsStoryState("release");
	const planClaude = plan.sessions.find((session) => session.agentId === "claude-code");
	const planPlanner = plan.sessions.find((session) => session.agentId === "code-planner");
	const buildReadyClaude = buildReady.sessions.find((session) => session.agentId === "claude-code");
	const buildImplementingClaude = buildImplementing.sessions.find((session) => session.agentId === "claude-code");
	const buildVerifyingClaude = buildVerifying.sessions.find((session) => session.agentId === "claude-code");
	const buildClaude = build.sessions.find((session) => session.agentId === "claude-code");
	const buildPlanner = build.sessions.find((session) => session.agentId === "code-planner");
	const reviewClaude = review.sessions.find((session) => session.agentId === "claude-code");
	const fixClaude = fix.sessions.find((session) => session.agentId === "claude-code");
	const approveClaude = approve.sessions.find((session) => session.agentId === "claude-code");
	const releaseClaude = release.sessions.find((session) => session.agentId === "claude-code");

	assert.equal(planClaude.agentId, "claude-code");
	assert.equal(planClaude.status, "running");
	assert.equal(planPlanner.status, "running");
	assert.equal(planPlanner.messages[0].authorName, "Claude");
	assert.match(planClaude.previewText, /Code Planner, review this work item/u);
	// Early Plan snapshot: Consult still open (orchestration consult/complete checks it).
	assert.equal(planClaude.progressChecklist.filter((item) => item.completed).length, 0);
	assert.equal(planClaude.outputs, undefined);
	assert.equal(planClaude.imageAttachment, undefined);
	assert.equal(
		plan.staticEvents.some((event) => event.id === "story-pr-review"),
		false,
	);
	// Build starts at Plan end (Consult ✓, no artifacts), then Implement ✓ + PR, then Verify ✓ + screenshot.
	assert.equal(buildReadyClaude.status, "running");
	assert.equal(buildReadyClaude.progressChecklist.filter((item) => item.completed).length, 1);
	assert.equal(buildReadyClaude.progressChecklist[0]?.completed, true);
	assert.equal(buildReadyClaude.progressChecklist[1]?.completed, false);
	assert.equal(buildReadyClaude.outputs, undefined);
	assert.equal(buildReadyClaude.imageAttachment, undefined);
	assert.equal(
		buildReady.staticEvents.some((event) => event.id === "story-pr-review"),
		false,
	);
	assert.equal(buildImplementingClaude.status, "running");
	assert.equal(buildImplementingClaude.progressChecklist.filter((item) => item.completed).length, 2);
	assert.equal(buildImplementingClaude.progressChecklist[0]?.completed, true);
	assert.equal(buildImplementingClaude.progressChecklist[1]?.completed, true);
	assert.equal(buildImplementingClaude.progressChecklist[2]?.completed, false);
	assert.equal(buildImplementingClaude.imageAttachment, undefined);
	assert.equal(buildImplementingClaude.outputs?.[0]?.source, "Pull request");
	assert.equal(
		buildImplementing.staticEvents.some((event) => event.id === "story-changed-files"),
		false,
	);
	assert.equal(buildVerifyingClaude.status, "running");
	assert.equal(buildVerifyingClaude.progressChecklist.filter((item) => item.completed).length, 3);
	assert.equal(buildVerifyingClaude.outputs?.[0]?.source, "Pull request");
	assert.deepEqual(buildVerifyingClaude.imageAttachment, {
		src: "/illustration/jira-golden-journeys-v2/guest-checkout-final.png",
		alt: "Final guest checkout design",
		filename: "guest-checkout-final.png",
	});
	assert.equal(
		buildVerifying.staticEvents.some((event) => event.id === "story-changed-files"),
		false,
	);
	assert.equal(buildClaude.status, "running");
	assert.equal(buildPlanner.status, "completed");
	assert.match(buildPlanner.previewText, /Consultation complete/u);
	assert.equal(buildClaude.progressChecklist.filter((item) => item.completed).length, 3);
	assert.equal(build.comments.find(
		(comment) => comment.id === "story-channel-orchestration",
	).reactions, undefined);
	assert.deepEqual(buildClaude.imageAttachment, {
		src: "/illustration/jira-golden-journeys-v2/guest-checkout-final.png",
		alt: "Final guest checkout design",
		filename: "guest-checkout-final.png",
	});
	assert.equal(buildClaude.outputs?.[0]?.pullRequest?.number, 1847);
	// Build uses the live Claude session for implementation evidence — do not
	// also surface the redundant changed-files / agent-output handoff card.
	assert.equal(
		build.staticEvents.some((event) => event.id === "story-changed-files"),
		false,
	);
	// PR artifact stages also seed Review's PR-creation Activity snapshot
	// (Open #1847 +86/−21, first check started) plus title-meta / resource chrome.
	const reviewQueuedPr = review.staticEvents.find(
		(event) => event.id === "story-pr-review",
	)?.pullRequest;
	assert.ok(reviewQueuedPr);
	for (const [label, state] of [
		["implementing", buildImplementing],
		["verifying", buildVerifying],
		["complete", build],
	]) {
		const buildPrEvent = state.staticEvents.find((event) => event.id === "story-pr-review");
		const buildPr = buildPrEvent?.pullRequest;
		assert.ok(buildPr, `build ${label} should include story-pr-review`);
		assert.equal(buildPr.number, reviewQueuedPr.number);
		assert.equal(buildPr.status, reviewQueuedPr.status);
		assert.equal(buildPr.title, reviewQueuedPr.title);
		assert.equal(buildPr.additions, reviewQueuedPr.additions);
		assert.equal(buildPr.deletions, reviewQueuedPr.deletions);
		assert.deepEqual(
			buildPr.checks.map((check) => check.status),
			["running", "queued", "queued"],
			`build ${label} keeps the PR-creation checks, not failed CI`,
		);
		assert.equal(
			state.staticEvents.some((event) => event.id === "story-ci-failed"),
			false,
			`build ${label} must not include Review's CI-failure event`,
		);
		assert.equal(state.metadata.status, "In progress", `build ${label} stays In progress`);
		// Place the Open row after the live Claude card (Review's after-agent snapshot).
		const claude = state.sessions.find((session) => session.agentId === "claude-code");
		assert.ok(buildPrEvent.createdAtMs > claude.startedAtMs);
	}
	assert.equal(reviewClaude.status, "waiting");
	assert.deepEqual(reviewClaude.waitingOn, {
		kind: "agent",
		agentId: "github-actions",
		agentName: "GitHub Actions",
	});
	assert.equal(reviewClaude.progressChecklist.filter((item) => item.completed).length, 4);
	assert.equal(fixClaude.status, "waiting");
	assert.deepEqual(fixClaude.waitingOn, {
		kind: "agent",
		agentId: "github-actions",
		agentName: "GitHub Actions",
	});
	assert.equal(fixClaude.progressChecklist.filter((item) => item.completed).length, 5);
	assert.match(fixClaude.previewText, /blocked PR #1847[\s\S]*nullable delivery-address path[\s\S]*unit and browser coverage passed/u);
	const fixingPr = fix.staticEvents.find((event) => event.id === "story-pr-review");
	assert.equal(fixingPr.pullRequest.mergeState, "blocked");
	assert.deepEqual(
		fixingPr.pullRequest.checks.map((check) => check.status),
		["failed", "passed", "passed"],
	);
	assert.equal(
		fix.staticEvents.some((event) => event.id === "story-ci-repair"),
		false,
		"Fix starts at Review end — repair waits for PullRequestFix submit",
	);
	assert.equal(approveClaude.status, "waiting");
	assert.deepEqual(approveClaude.waitingOn, { kind: "user" });
	assert.equal(approveClaude.progressChecklist.filter((item) => item.completed).length, 6);
	assert.equal(
		approveClaude.progressChecklist[6]?.label,
		"Obtain the required human approval in the PR guide",
	);
	assert.doesNotMatch(approveClaude.progressChecklist[6]?.label ?? "", /Venn/u);
	const openedPr = approve.staticEvents.find((event) => event.id === "story-pr-approve");
	const mergedPr = release.staticEvents.find((event) => event.id === "story-pr-merged");
	const followUpMergedPr = release.staticEvents.find(
		(event) => event.id === "story-pr-merged-follow-up",
	);
	assert.ok(openedPr?.pullRequest);
	assert.ok(mergedPr?.pullRequest);
	assert.ok(followUpMergedPr?.pullRequest);
	assert.equal(openedPr.pullRequest.authorName, "Venn");
	assert.equal(mergedPr.pullRequest.authorName, "Venn");
	assert.equal(openedPr.pullRequest.reviewDecision, "review-required");
	assert.ok(openedPr.pullRequest.checks.every((check) => check.status === "passed"));
	assert.equal(openedPr.pullRequest.branch, "feature/shop-4821-guest-checkout");
	assert.equal(openedPr.pullRequest.targetBranch, "main");
	assert.equal(mergedPr.pullRequest.targetBranch, "main");
	assert.equal(typeof openedPr.pullRequest.createdAtMs, "number");
	assert.equal(typeof openedPr.pullRequest.updatedAtMs, "number");
	assert.equal(mergedPr.pullRequest.createdAtMs, openedPr.pullRequest.createdAtMs);
	assert.ok(mergedPr.pullRequest.updatedAtMs > mergedPr.pullRequest.createdAtMs);
	assert.equal(followUpMergedPr.pullRequest.number, 1848);
	assert.equal(followUpMergedPr.pullRequest.status, "Merged");
	assert.equal(followUpMergedPr.pullRequest.authorName, "Priya Hansra");
	assert.equal(followUpMergedPr.pullRequest.authorAvatarSrc, "/avatar-human/priya-hansra.png");
	assert.equal(followUpMergedPr.pullRequest.repository, "shop/checkout-api");
	assert.notEqual(
		followUpMergedPr.pullRequest.repository,
		mergedPr.pullRequest.repository,
		"Follow-up merged PR uses a distinct repo from #1847",
	);
	assert.notEqual(
		followUpMergedPr.pullRequest.authorName,
		mergedPr.pullRequest.authorName,
		"Follow-up merged PR uses a distinct author from #1847",
	);
	assert.equal(followUpMergedPr.pullRequest.branch, "fix/shop-4821-guest-email-validation");
	assert.equal(followUpMergedPr.pullRequest.targetBranch, "main");
	assert.equal(followUpMergedPr.pullRequest.additions, 24);
	assert.equal(followUpMergedPr.pullRequest.deletions, 6);
	assert.match(followUpMergedPr.pullRequest.title, /guest checkout email validation/u);
	assert.equal(releaseClaude.progressChecklist.filter((item) => item.completed).length, 8);
	assert.match(releaseClaude.previewText, /approved by Venn and merged[\s\S]*feature flag[\s\S]*production smoke checks[\s\S]*healthy telemetry[\s\S]*rollout/u);
	assert.ok(release.sessions.every((session) => session.status === "completed"));
});

test("Review moves deterministically from queued through settling to failed and Fix continues from that PR until repair", async () => {
	const story = await loadStoryModule();
	const reviewSteps = ["queued", "running", "unit-passed", "settling", "failed"];
	const reviewStates = reviewSteps.map((reviewStep) => (
		story.createJiraAgentsStoryState("review", { reviewStep })
	));
	const reviewPullRequests = reviewStates.map((state) => (
		state.staticEvents.find(
			(event) => event.id === "story-pr-review",
		)?.pullRequest
	));

	// CI picks up the first job as the PR opens, widens, lands unit then browser, then fails lint.
	assert.deepEqual(
		reviewPullRequests.map((pullRequest) => pullRequest.checks.map((check) => check.status)),
		[
			["running", "queued", "queued"],
			["running", "running", "queued"],
			["running", "passed", "running"],
			["running", "passed", "passed"],
			["failed", "passed", "passed"],
		],
	);
	assert.ok(reviewPullRequests.every((pullRequest) => pullRequest.mergeState === "blocked"));
	assert.ok(reviewPullRequests.every((pullRequest) => pullRequest.reviewDecision === "review-required"));
	assert.deepEqual(
		reviewStates.map((state) => {
			const claude = state.sessions.find((session) => session.agentId === "claude-code");
			return { status: claude.status, waitingOn: claude.waitingOn ?? null };
		}),
		[
			{
				status: "waiting",
				waitingOn: { kind: "agent", agentId: "github-actions", agentName: "GitHub Actions" },
			},
			{
				status: "waiting",
				waitingOn: { kind: "agent", agentId: "github-actions", agentName: "GitHub Actions" },
			},
			{
				status: "waiting",
				waitingOn: { kind: "agent", agentId: "github-actions", agentName: "GitHub Actions" },
			},
			{
				status: "waiting",
				waitingOn: { kind: "agent", agentId: "github-actions", agentName: "GitHub Actions" },
			},
			// Failed settle still waits on GitHub Actions so Review keeps the
			// "agents working" story; Fix-failed matches until chip submit repairs.
			{
				status: "waiting",
				waitingOn: { kind: "agent", agentId: "github-actions", agentName: "GitHub Actions" },
			},
		],
	);
	const failedReview = story.createJiraAgentsStoryState("review", { reviewStep: "failed" });
	assert.ok(failedReview.staticEvents.some((event) => event.id === "story-ci-failed"));
	const failedReviewClaude = failedReview.sessions.find((session) => session.agentId === "claude-code");
	assert.equal(failedReviewClaude.status, "waiting");
	assert.deepEqual(failedReviewClaude.waitingOn, {
		kind: "agent",
		agentId: "github-actions",
		agentName: "GitHub Actions",
	});

	const fixFailed = story.createJiraAgentsStoryState("fix");
	assert.equal(
		fixFailed.sessions.filter((session) => session.status !== "completed").length,
		1,
		"Fix-failed keeps only Claude working",
	);
	assert.equal(
		fixFailed.sessions.some((session) => session.id === story.JIRA_AGENTS_CI_REPAIR_SESSION_ID),
		false,
		"CI repair session starts only after the Fix composer submit",
	);
	assert.deepEqual(
		fixFailed.sessions.find((session) => session.agentId === "claude-code").waitingOn,
		{ kind: "agent", agentId: "github-actions", agentName: "GitHub Actions" },
		"Fix-failed keeps agents-working until Approve (human review) needs input",
	);
	const fixFailedPr = fixFailed.staticEvents.find((event) => event.id === "story-pr-review")?.pullRequest;
	assert.deepEqual(fixFailedPr.checks.map((check) => check.status), ["failed", "passed", "passed"]);
	assert.equal(fixFailed.staticEvents.some((event) => event.id === "story-ci-repair"), false);
	assert.equal(fixFailed.staticEvents.some((event) => event.id === "story-moved-fix"), true);

	const fixRepairing = story.createJiraAgentsStoryState("fix", { fixStep: "repairing" });
	const repairingLead = fixRepairing.sessions.find(
		(session) => session.id === "story-session-claude-code",
	);
	const repairingAgent = fixRepairing.sessions.find(
		(session) => session.id === story.JIRA_AGENTS_CI_REPAIR_SESSION_ID,
	);
	const repair = fixRepairing.staticEvents.find((event) => event.id === "story-ci-repair");
	const rerun = fixRepairing.staticEvents.find((event) => event.id === "story-pr-fix-rerun")?.pullRequest;
	assert.equal(repairingLead.status, "running");
	assert.deepEqual(repairingLead.waitingOn, {
		kind: "agent",
		agentId: "codex",
		agentName: "Codex",
	});
	assert.equal(repairingAgent.status, "running");
	assert.equal(repairingAgent.agentId, "codex");
	assert.equal(repairingAgent.agentName, "Codex");
	assert.equal(repairingAgent.scriptId, story.JIRA_AGENTS_CI_REPAIR_SCRIPT_ID);
	assert.equal(
		fixRepairing.sessions.filter((session) => session.status !== "completed").length,
		2,
		"Fix-repairing exposes lead Claude and default Codex repair as working",
	);
	assert.match(repairingAgent.previewText, /gh[\s\S]*deliveryAddress[\s\S]*lint and typecheck/u);
	assert.ok(repairingAgent.progressChecklist.every((item) => !item.completed));
	assert.equal(repair.summary, "Repairing the failed CI path");
	assert.match(repair.description, /nullable delivery address[\s\S]*rerunning/u);
	assert.equal(repair.actor.name, "Codex");
	assert.equal(repair.sessionItem.agent.id, "codex");
	assert.deepEqual(rerun.checks.map((check) => check.status), ["running", "passed", "passed"]);

	const fixComplete = story.createJiraAgentsStoryState("fix", { fixStep: "complete" });
	const completedRepairSession = fixComplete.sessions.find(
		(session) => session.id === story.JIRA_AGENTS_CI_REPAIR_SESSION_ID,
	);
	const completedRepair = fixComplete.staticEvents.find((event) => event.id === "story-ci-repair");
	const completedRerun = fixComplete.staticEvents.find((event) => event.id === "story-pr-fix-rerun")?.pullRequest;
	assert.equal(completedRepairSession.status, "completed");
	assert.equal(completedRepairSession.agentId, "codex");
	assert.ok(completedRepairSession.progressChecklist.every((item) => item.completed));
	assert.match(completedRepairSession.previewText, /CI is green[\s\S]*committed[\s\S]*pushed/u);
	assert.equal(
		fixComplete.sessions.filter((session) => session.status !== "completed").length,
		1,
		"Fix-complete returns to only Claude working",
	);
	assert.equal(completedRepair.summary, "Repaired the failed CI path");
	assert.equal(completedRepair.actor.name, "Codex");
	assert.ok(completedRerun.checks.every((check) => check.status === "passed"));
	assert.equal(
		fixComplete.sessions.find((session) => session.id === "story-session-claude-code")
			.progressChecklist.filter((item) => item.completed).length,
		6,
	);

	const claudeRepairing = story.createJiraAgentsStoryState("fix", {
		fixStep: "repairing",
		fixAgentId: "claude-code",
	});
	const claudeRepair = claudeRepairing.sessions.find(
		(session) => session.id === story.JIRA_AGENTS_CI_REPAIR_SESSION_ID,
	);
	const claudeRepairEvent = claudeRepairing.staticEvents.find(
		(event) => event.id === "story-ci-repair",
	);
	assert.equal(claudeRepair.agentId, "claude-code");
	assert.equal(claudeRepair.agentName, "Claude");
	assert.notEqual(claudeRepair.id, "story-session-claude-code");
	assert.deepEqual(
		claudeRepairing.sessions.find((session) => session.id === "story-session-claude-code").waitingOn,
		{ kind: "agent", agentId: "claude-code", agentName: "Claude" },
	);
	assert.equal(
		claudeRepairing.sessions.filter((session) => session.status !== "completed").length,
		2,
		"Claude as Fix agent still yields a distinct repair session beside the lead",
	);
	assert.equal(claudeRepairEvent.actor.name, "Claude");
	assert.equal(claudeRepairEvent.sessionItem.agent.id, "claude-code");
});

test("Approve fixture can wait for approval; pullRequestApproved lands ready-to-merge for Release evidence", async () => {
	const story = await loadStoryModule();
	// Pre-approval fixture (explicit false / omitted) — controller still starts Approve approved.
	const available = story.createJiraAgentsStoryState("approve");
	const approved = story.createJiraAgentsStoryState("approve", { pullRequestApproved: true });
	const availablePullRequest = available.staticEvents.find(
		(event) => event.id === "story-pr-approve",
	)?.pullRequest;
	const approvedPullRequest = approved.staticEvents.find(
		(event) => event.id === "story-pr-approve",
	)?.pullRequest;
	const approvedClaude = approved.sessions.find((session) => session.agentId === "claude-code");
	const completedRepair = approved.staticEvents.find((event) => event.id === "story-ci-repair");
	assert.equal(completedRepair.actor.name, "Codex");
	assert.equal(completedRepair.sessionItem.agent.id, "codex");

	assert.ok(availablePullRequest.checks.every((check) => check.status === "passed"));
	assert.equal(availablePullRequest.reviewDecision, "review-required");
	assert.equal(availablePullRequest.mergeState, "blocked");
	assert.equal(availablePullRequest.authorName, "Venn");
	assert.equal(story.JIRA_AGENTS_PULL_REQUEST_IDENTITY, availablePullRequest.url);
	assert.equal(approvedPullRequest.reviewDecision, "approved");
	assert.equal(approvedPullRequest.mergeState, "ready");
	assert.equal(approvedClaude.status, "completed");
	assert.equal(approvedClaude.waitingOn, undefined);
	assert.match(approvedClaude.previewText, /Venn approved PR #1847[\s\S]*ready to merge and release/u);
	assert.match(
		completedRepair.description,
		/reran the failed lint and typecheck check to green[\s\S]*preserving the existing green unit and browser results/u,
	);
	assert.doesNotMatch(completedRepair.description, /reran lint, typecheck, unit, and browser/u);
	assert.ok(approvedClaude.progressChecklist.some(
		(item) => item.label === "Repair the failed path and rerun its failed check to green" && item.completed,
	));
	assert.deepEqual(
		available.staticEvents
			.filter((event) => ["story-ci-repair", "story-pr-fix-rerun", "story-pr-approve"].includes(event.id))
			.map((event) => event.id),
		["story-ci-repair", "story-pr-fix-rerun", "story-pr-approve"],
	);
	assert.ok(approved.staticEvents.some((event) => event.id === "story-venn-approved"));

	const release = story.createJiraAgentsStoryState("release");
	assert.deepEqual(
		release.staticEvents.filter((event) => event.id.startsWith("story-release-")).map((event) => event.id),
		[
			"story-release-feature-flag",
			"story-release-smoke-telemetry",
			"story-release-rollout-complete",
		],
	);
	const mergedPullRequest = release.staticEvents.find(
		(event) => event.id === "story-pr-merged",
	)?.pullRequest;
	assert.ok(mergedPullRequest);
	assert.deepEqual(mergedPullRequest.checks, approvedPullRequest.checks);
	assert.ok(mergedPullRequest.checks.every((check) => check.status === "passed"));
	assert.equal(release.metadata.status, "Done");
	const releaseMergedPullRequests = release.staticEvents.filter(
		(event) => event.pullRequest?.status === "Merged",
	);
	assert.deepEqual(
		releaseMergedPullRequests.map((event) => event.pullRequest.number),
		[1847, 1848],
		"Release lists both merged guest-checkout PRs for the select and title-meta count",
	);
	const [adapter, phases] = await loadPullRequestChromeModules();
	const releasePullRequestEntries = adapter.selectPullRequestEntries(release.staticEvents);
	assert.deepEqual(
		phases.summarizePullRequestTagMetrics(releasePullRequestEntries),
		[{ value: "2 Merged", color: "purple" }],
	);
});

test("the authored artifact and pull-request chronology is complete and renderable", async () => {
	const story = await loadStoryModule();
	const release = story.createJiraAgentsStoryState("release");
	const artifactEvents = release.staticEvents.filter((event) => event.kind === "changed-files");

	assert.deepEqual(
		release.staticEvents
			.filter((event) => [
				"story-changed-files",
				"story-ci-repair",
				"story-pr-fix-rerun",
				"story-regression-matrix",
				"story-pr-approve",
				"story-pr-merged",
				"story-pr-merged-follow-up",
			].includes(event.id))
			.map((event) => event.id),
		[
			"story-changed-files",
			"story-ci-repair",
			"story-pr-fix-rerun",
			"story-regression-matrix",
			"story-pr-approve",
			"story-pr-merged",
			"story-pr-merged-follow-up",
		],
	);
	assert.ok(artifactEvents.every((event) => event.sessionItem));
	assert.deepEqual(
		artifactEvents.flatMap((event) => event.outputs.map((output) => output.title)),
		[
			"Guest checkout implementation",
			"SHOP-4821 acceptance report",
		],
	);
});

test("the orchestration timeline and live broadcasts remain chronological", async () => {
	const [story, stateModel] = await Promise.all([loadStoryModule(), loadStateModule()]);
	const plan = story.createJiraAgentsStoryState("plan");
	const build = story.createJiraAgentsStoryState("build");
	const release = story.createJiraAgentsStoryState("release");
	const intakeComment = build.comments.find((comment) => comment.id === "story-channel-intake");
	const descriptionApplied = build.staticEvents.find(
		(event) => event.id === "story-description-applied",
	);
	const movedInProgress = build.staticEvents.find(
		(event) => event.id === "story-moved-in-progress",
	);
	const prompt = build.comments.find((comment) => comment.id === "story-channel-orchestration");
	const leadClaim = build.staticEvents.find((event) => event.id === "story-lead-delegated");
	const planClaude = plan.sessions.find((session) => session.agentId === "claude-code");
	const planPlanner = plan.sessions.find((session) => session.agentId === "code-planner");
	const buildClaude = build.sessions.find((session) => session.agentId === "claude-code");
	const buildPlanner = build.sessions.find((session) => session.agentId === "code-planner");

	assert.ok(intakeComment.createdAtMs < descriptionApplied.createdAtMs);
	assert.ok(descriptionApplied.createdAtMs < movedInProgress.createdAtMs);
	assert.ok(movedInProgress.createdAtMs < prompt.createdAtMs);
	assert.ok(prompt.createdAtMs < leadClaim.createdAtMs);
	assert.equal(descriptionApplied.actor.name, "Venn");
	assert.equal(movedInProgress.actor.name, "Venn");
	assert.equal(intakeComment.authorName, "Venn");
	assert.equal(
		build.staticEvents.find((event) => event.id === "story-created")?.actor.name,
		"Venn",
	);
	assert.equal(
		build.staticEvents.find((event) => event.id === "story-impact-labelled")?.actor.name,
		"Venn",
	);
	assert.equal(story.JIRA_AGENTS_STORY_WORK_ITEM_BASE.assignee.name, "Venn");
	assert.equal(build.metadata.assignee?.name, "Venn");
	for (const eventId of [
		"story-moved-in-progress",
		"story-moved-review",
		"story-moved-fix",
		"story-moved-approve",
		"story-moved-release",
	]) {
		const statusMove = release.staticEvents.find((event) => event.id === eventId);
		assert.equal(statusMove?.actor.name, "Venn", `${eventId} should credit Venn`);
	}
	// Live plan sessions share a near-now clock and keep start order.
	assert.ok(leadClaim.createdAtMs < planClaude.startedAtMs);
	assert.ok(planClaude.startedAtMs < planPlanner.startedAtMs);
	assert.equal(planClaude.status, "running");
	assert.equal(planPlanner.status, "running");
	// In build, Claude stays live near now while the completed consult remains historical.
	// Open #1847 sits after Claude (no duplicate changed-files handoff card).
	assert.ok(leadClaim.createdAtMs < buildClaude.startedAtMs);
	assert.equal(buildClaude.status, "running");
	assert.equal(buildPlanner.status, "completed");
	assert.ok(buildPlanner.startedAtMs < buildClaude.startedAtMs);
	assert.equal(
		build.staticEvents.some((event) => event.id === "story-changed-files"),
		false,
	);
	const buildPullRequest = build.staticEvents.find((event) => event.id === "story-pr-review");
	assert.ok(buildClaude.startedAtMs < buildPullRequest.createdAtMs);
	const buildActivityIds = stateModel.selectActivityEvents(build).map((event) => event.id);
	const claudeActivityIndex = buildActivityIds.indexOf("activity-story-session-claude-code");
	const prActivityIndex = buildActivityIds.indexOf("story-pr-review");
	assert.ok(claudeActivityIndex >= 0, "Build should include the live Claude session card");
	assert.ok(prActivityIndex >= 0, "Build should include the Open #1847 snapshot");
	assert.ok(
		claudeActivityIndex < prActivityIndex,
		"Open #1847 must render underneath the Claude session card",
	);
	assert.equal(buildActivityIds.includes("story-changed-files"), false);

	const broadcast = stateModel.jiraWorkItemReducer(build, {
		type: "broadcast-comment",
		text: "Keep guest checkout fast and do not create an account before purchase.",
	});
	const events = stateModel.selectActivityEvents(broadcast);
	assert.equal(events.at(-1).kind, "human");
	assert.equal(events.at(-1).content, "Keep guest checkout fast and do not create an account before purchase.");
	assert.equal(
		broadcast.sessions.find((session) => session.agentId === "claude-code").status,
		"running",
	);
});

test("live agent activity headers resolve to immediate relative timestamps", async () => {
	const [story, stateModel] = await Promise.all([loadStoryModule(), loadStateModule()]);
	const approve = story.createJiraAgentsStoryState("approve");
	const release = story.createJiraAgentsStoryState("release");

	const liveAgentEvents = stateModel.selectActivityEvents(approve).filter((event) => (
		event.kind === "agent" && event.status !== "completed"
	));
	assert.ok(liveAgentEvents.length > 0);
	for (const event of liveAgentEvents) {
		assert.ok(
			event.elapsedSeconds < 60,
			`${event.agentName} should be under a minute old, got ${event.elapsedSeconds}s`,
		);
		const referenceTimeMs = event.createdAtMs + event.elapsedSeconds * 1000;
		assert.equal(
			stateModel.formatSessionTimestamp(event.createdAtMs, referenceTimeMs),
			"Just now",
		);
	}

	const completedEvents = stateModel.selectActivityEvents(release).filter((event) => (
		event.kind === "agent" && event.status === "completed"
	));
	assert.ok(completedEvents.length > 0);
	for (const event of completedEvents) {
		assert.ok(
			event.elapsedSeconds >= 40 * 60,
			`${event.agentName} should keep a historical completed age, got ${event.elapsedSeconds}s`,
		);
		const referenceTimeMs = event.createdAtMs + event.elapsedSeconds * 1000;
		assert.match(
			stateModel.formatSessionTimestamp(event.createdAtMs, referenceTimeMs),
			/^\d+m ago$/u,
		);
	}
});

test("Improve description stays private in Activity until the output is added", async () => {
	const [story, stateModel] = await Promise.all([loadStoryModule(), loadStateModule()]);
	const running = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "running" });
	const waiting = story.createJiraAgentsStoryState("intake", {
		descriptionSkillPhase: "awaiting-confirmation",
	});
	const dismissed = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "dismissed" });
	const applied = story.createJiraAgentsStoryState("intake", { descriptionSkillPhase: "applied" });
	const plan = story.createJiraAgentsStoryState("plan");

	for (const state of [running, waiting, dismissed, applied, plan]) {
		const skillSession = state.sessions.find(
			(session) => session.agentId === "skill:improve-description",
		);
		assert.ok(skillSession);
		assert.equal(skillSession.activityVisibility, "private");
		assert.equal(
			stateModel.selectActivityEvents(state).some(
				(event) => event.kind === "agent" && event.sessionId === skillSession.id,
			),
			false,
			"private skill session must not appear as a public Activity card",
		);
	}

	assert.equal(
		stateModel.selectActivityEvents(waiting).some(
			(event) => event.id === "story-description-applied",
		),
		false,
	);
	assert.equal(
		stateModel.selectActivityEvents(dismissed).some(
			(event) => event.id === "story-description-applied",
		),
		false,
	);

	const published = stateModel.selectActivityEvents(applied).find(
		(event) => event.id === "story-description-applied",
	);
	assert.equal(published?.kind, "event");
	assert.equal(published?.actor.name, "Venn");
	assert.equal(published?.actor.kind, "person");
	assert.equal(published?.icon, "description");
	assert.notEqual(published?.showActor, false);
	assert.deepEqual(published?.segments, [
		{ type: "text", text: "updated the description" },
	]);

	const planEvents = stateModel.selectActivityEvents(plan);
	const planIds = planEvents.map((event) => event.id);
	const descriptionIndex = planIds.indexOf("story-description-applied");
	const intakeCommentIndex = planIds.indexOf("story-channel-intake");
	const movedInProgressIndex = planIds.indexOf("story-moved-in-progress");
	const orchestrationIndex = planIds.indexOf("story-channel-orchestration");
	assert.ok(descriptionIndex > intakeCommentIndex);
	assert.ok(descriptionIndex < movedInProgressIndex);
	assert.ok(movedInProgressIndex < orchestrationIndex);
	assert.equal(planEvents[descriptionIndex]?.actor.name, "Venn");
	assert.equal(planEvents[movedInProgressIndex]?.actor.name, "Venn");
	// Resolve story "now" the same way live agent timestamp checks do.
	const planClaudeEvent = planEvents.find(
		(event) => event.kind === "agent" && event.agentId === "claude-code",
	);
	assert.ok(planClaudeEvent);
	const referenceTimeMs = planClaudeEvent.createdAtMs + planClaudeEvent.elapsedSeconds * 1000;
	assert.equal(
		stateModel.formatSessionTimestamp(
			planEvents[descriptionIndex].createdAtMs,
			referenceTimeMs,
		),
		"52m ago",
	);
	assert.ok(
		planEvents.some((event) => event.id === "story-description-applied"),
		"later chapters keep the published description activity",
	);
});

test("SHOP-4821 is one shared route-owned item across board, list, and detail data", async () => {
	const story = await loadStoryModule();
	const chapters = story.JIRA_AGENTS_STORY_CHAPTERS.map((chapter) => chapter.value);

	for (const chapter of chapters) {
		const columns = story.createJiraAgentsBoardColumns(chapter);
		const expectedStatus = story.getJiraAgentsStoryStatus(chapter);
		const targetColumn = columns.find((column) => column.title === expectedStatus);
		const storyCards = columns.flatMap((column) => column.cards).filter(
			(card) => card.code === "SHOP-4821",
		);
		const sections = story.createJiraAgentsWorkspaceSections(chapter);
		const storyItems = sections.flatMap((section) => section.items).filter(
			(item) => item.issueKey === "SHOP-4821",
		);

		assert.equal(storyCards.length, 1);
		assert.equal(targetColumn.cards[0].code, "SHOP-4821");
		assert.equal(storyItems.length, 1);
		assert.equal(storyItems[0].jiraStatus, expectedStatus);
	}

	assert.equal(story.getJiraAgentsStoryChapterForStatus("To do"), "intake");
	assert.equal(story.getJiraAgentsStoryChapterForStatus("In progress"), "build");
	assert.equal(story.getJiraAgentsStoryChapterForStatus("Review"), "review");
	assert.equal(story.getJiraAgentsStoryChapterForStatus("In review"), "review");
	assert.equal(story.getJiraAgentsStoryChapterForStatus("Done"), "release");

	const build = story.createJiraAgentsBoardColumns("build");
	const unrelatedCard = build.find((column) => column.cards.some((card) => card.code !== "SHOP-4821")).cards.find(
		(card) => card.code !== "SHOP-4821",
	);
	const withLocalEdit = build.map((column) => ({
		...column,
		cards: column.cards.map((card) => card.code === unrelatedCard.code
			? { ...card, title: "Locally edited board card" }
			: card),
	}));
	const review = story.createJiraAgentsBoardColumns("review", withLocalEdit);
	const preserved = review.flatMap((column) => column.cards).find((card) => card.code === unrelatedCard.code);

	assert.equal(preserved.title, "Locally edited board card");
	assert.equal(story.getJiraAgentsStoryColumn(review), "In review");
});

test("agent session copy reads as a full comment, never a truncated preview", async () => {
	const story = await loadStoryModule();
	const chapters = ["intake", "plan", "build", "review", "fix", "approve", "release"];

	for (const chapter of chapters) {
		for (const session of story.createJiraAgentsStoryState(chapter).sessions) {
			assert.doesNotMatch(
				session.previewText ?? "",
				/(?:…|\.\.\.)\s*$/u,
				`${chapter}/${session.agentName} preview text is truncated`,
			);
			for (const reply of session.threadReplies ?? []) {
				assert.doesNotMatch(
					reply.content,
					/(?:…|\.\.\.)\s*$/u,
					`${chapter}/${session.agentName} thread reply is truncated`,
				);
			}
		}
	}
});
