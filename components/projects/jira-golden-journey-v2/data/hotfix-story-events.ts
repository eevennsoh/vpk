import type { AgentListItem, AgentListState } from "@/components/blocks/agent-list";
import type { StaticTimelineEvent } from "@/components/blocks/jira-work-item/data/session-state";
import { statusLozengeSegment } from "@/components/blocks/jira-work-item/experimental-v2/components/detail-field-editor-data";

import {
	FAILED_PR_CHECKS,
	PASSED_PR_CHECKS,
	RERUNNING_PR_CHECKS,
	RUNNING_PR_CHECKS,
	SETTLING_PR_CHECKS,
	STARTED_PR_CHECKS,
	UNIT_PASSED_PR_CHECKS,
} from "./story-pull-request-checks";
import {
	CLAUDE_CODE,
	CLAUDE_CODE_ACTOR,
	CODE_PLANNER,
	GITHUB_ACTOR,
	HUMAN_ACTOR,
	JIRA_AGENTS_STATUS_PHASES,
	STORY_CREATED_AT_MS,
	STORY_EPOCH_MS,
	VENN_ACTOR,
	createFixAgentActor,
	resolveFixAgent,
	type JiraAgentsBuildStep,
	type JiraAgentsFixStep,
	type JiraAgentsReviewStep,
	type JiraAgentsStoryAgent,
	type JiraAgentsStoryChapter,
	type JiraAgentsStoryStateOptions,
} from "./story-model";

function createStoryArtifactSession({
	agent,
	branch,
	elapsedSeconds,
	id,
	state,
	title,
}: {
	agent: JiraAgentsStoryAgent;
	branch: string;
	elapsedSeconds: number;
	id: string;
	state: AgentListState;
	title: string;
}): AgentListItem {
	return {
		id,
		title,
		state,
		agent: {
			id: agent.id,
			name: agent.name,
			...(agent.brandName ? { brandName: agent.brandName } : { avatarSrc: agent.avatarSrc }),
		},
		branch,
		elapsedSeconds,
	};
}

function statusEvent(
	id: string,
	from: string,
	to: string,
	createdAtMs: number,
): StaticTimelineEvent {
	return {
		id,
		kind: "event",
		// Venn drives the SDLC status moves after intake setup.
		actor: VENN_ACTOR,
		icon: "status",
		segments: [
			{ type: "text", text: "moved from " },
			statusLozengeSegment(from, JIRA_AGENTS_STATUS_PHASES),
			{ type: "transition-arrow" },
			statusLozengeSegment(to, JIRA_AGENTS_STATUS_PHASES),
		],
		createdAtMs,
	};
}

const INTAKE_EVENTS: readonly StaticTimelineEvent[] = [
	{
		id: "story-created",
		kind: "event",
		actor: HUMAN_ACTOR,
		icon: "created",
		segments: [{ type: "text", text: "created the feature story from the storefront conversion roadmap" }],
		createdAtMs: STORY_CREATED_AT_MS,
	},
	{
		id: "story-impact-labelled",
		kind: "event",
		actor: HUMAN_ACTOR,
		icon: "label",
		segments: [
			{ type: "text", text: "added " },
			{ type: "label", text: "storefront", color: "blue" },
			{ type: "text", text: " " },
			{ type: "label", text: "checkout", color: "blue" },
			{ type: "text", text: " " },
			{ type: "label", text: "feature", color: "yellow" },
		],
		createdAtMs: STORY_EPOCH_MS - 3_480_000,
	},
];

const DESCRIPTION_APPLIED_EVENT: StaticTimelineEvent = {
	id: "story-description-applied",
	kind: "event",
	actor: VENN_ACTOR,
	icon: "description",
	// Actor renders as a user-mention chip via JiraActivityEvent (person → user).
	segments: [{ type: "text", text: "updated the description" }],
	// After intake description discussion, before move-to-in-progress /
	// orchestration / agent sessions (oldest→newest top→bottom).
	createdAtMs: STORY_EPOCH_MS - 3_120_000,
};

const PLAN_EVENTS: readonly StaticTimelineEvent[] = [
	...INTAKE_EVENTS,
	// Public trail after the private Improve description skill is accepted.
	DESCRIPTION_APPLIED_EVENT,
	statusEvent("story-moved-in-progress", "To do", "In progress", STORY_EPOCH_MS - 3_000_000),
	{
		id: "story-lead-delegated",
		kind: "event",
		actor: CLAUDE_CODE_ACTOR,
		icon: "delegated",
		showActor: false,
		showTimestamp: false,
		segments: [
			{ type: "agent-mention", text: CLAUDE_CODE.name, brandName: CLAUDE_CODE.brandName },
			{ type: "agent-mention", text: CODE_PLANNER.name, avatarSrc: CODE_PLANNER.avatarSrc },
			{ type: "text", text: " Started working" },
		],
		createdAtMs: STORY_EPOCH_MS - 2_880_000,
	},
];

const BUILD_EVENTS: readonly StaticTimelineEvent[] = PLAN_EVENTS;

const HANDOFF_EVENT: StaticTimelineEvent = {
	id: "story-changed-files",
	kind: "changed-files",
	actor: CLAUDE_CODE_ACTOR,
	summary: "Changed 12 files",
	description: "Implemented the guest order service plus the storefront delivery, payment, validation, confirmation, and post-purchase account flows against Code Planner's contract.",
	branch: "feature/shop-4821-guest-checkout",
	tag: { text: "Implementation complete", color: "green" },
	sessionItem: createStoryArtifactSession({
		id: "story-claude-checkout",
		title: "Implemented guest checkout end to end",
		state: "complete",
		agent: CLAUDE_CODE,
		branch: "feature/shop-4821-guest-checkout",
		elapsedSeconds: 482,
	}),
	outputs: [
		{
			id: "guest-checkout-implementation",
			title: "Guest checkout implementation",
			source: "Agent output",
			owner: CLAUDE_CODE.name,
			iconName: "ai-chat",
		},
	],
	createdAtMs: STORY_EPOCH_MS - 1_320_000,
};

const FAILED_CI_EVENT: StaticTimelineEvent = {
	id: "story-ci-failed",
	kind: "event",
	actor: GITHUB_ACTOR,
	icon: "linked",
	segments: [
		{ type: "text", text: "blocked PR #1847 after " },
		{ type: "code", text: "lint-and-typecheck" },
		{ type: "text", text: " reported " },
		{ type: "lozenge", text: "1 failed", variant: "danger" },
	],
	createdAtMs: STORY_EPOCH_MS - 1_140_000,
};

type StoryPullRequestChecks = NonNullable<
	NonNullable<Extract<StaticTimelineEvent, { kind: "event" }>["pullRequest"]>["checks"]
>;

function createPullRequestEvent({
	additions = 86,
	authorAvatarSrc,
	authorName = HUMAN_ACTOR.name,
	branch = "feature/shop-4821-guest-checkout",
	checks,
	createdAtMs = STORY_EPOCH_MS - 1_200_000,
	deletions = 21,
	id,
	mergeState,
	number = 1847,
	repository = "acme/storefront",
	reviewDecision,
	status = "Open",
	title = "Implement guest checkout without account creation",
	updatedAtMs,
}: {
	additions?: number;
	authorAvatarSrc?: string;
	authorName?: string;
	branch?: string;
	checks?: StoryPullRequestChecks;
	createdAtMs?: number;
	deletions?: number;
	id: string;
	mergeState: "ready" | "blocked" | "merged";
	number?: number;
	repository?: string;
	reviewDecision: "approved" | "review-required";
	status?: "Open" | "Merged";
	title?: string;
	updatedAtMs: number;
}): StaticTimelineEvent {
	return {
		id,
		kind: "event",
		actor: GITHUB_ACTOR,
		icon: "linked",
		segments: [],
		pullRequest: {
			number,
			title,
			status,
			additions,
			deletions,
			repository,
			branch,
			targetBranch: "main",
			url: `https://github.com/${repository}/pull/${number}`,
			authorName,
			...(authorAvatarSrc ? { authorAvatarSrc } : {}),
			createdAtMs,
			updatedAtMs,
			reviewDecision,
			mergeState,
			...(checks ? { checks } : {}),
		},
		createdAtMs: updatedAtMs,
	};
}

const ACCEPTANCE_MATRIX_EVENT: StaticTimelineEvent = {
	id: "story-regression-matrix",
	kind: "changed-files",
	actor: CLAUDE_CODE_ACTOR,
	summary: "Acceptance matrix passed",
	description: "Verified guest purchase, validation errors, inventory changes, declined payments, duplicate submissions, confirmation, and optional post-purchase account creation.",
	branch: "#1847",
	tag: { text: "18 checks passing", color: "green" },
	sessionItem: createStoryArtifactSession({
		id: "story-test-report",
		title: "Acceptance matrix passed",
		state: "complete",
		agent: CLAUDE_CODE,
		branch: "#1847",
		elapsedSeconds: 438,
	}),
	outputs: [{
		id: "acceptance-report",
		title: "SHOP-4821 acceptance report",
		source: "Test artifact",
		owner: CLAUDE_CODE.name,
		iconName: "page",
	}],
	createdAtMs: STORY_EPOCH_MS - 720_000,
};

function reviewChecksForStep(step: JiraAgentsReviewStep) {
	switch (step) {
		case "queued":
			return STARTED_PR_CHECKS;
		case "running":
			return RUNNING_PR_CHECKS;
		case "unit-passed":
			return UNIT_PASSED_PR_CHECKS;
		case "settling":
			return SETTLING_PR_CHECKS;
		case "failed":
			return FAILED_PR_CHECKS;
		default: {
			const _exhaustive: never = step;
			return _exhaustive;
		}
	}
}

function reviewUpdatedAtMsForStep(step: JiraAgentsReviewStep): number {
	switch (step) {
		case "queued":
			return STORY_EPOCH_MS - 1_200_000;
		case "running":
			return STORY_EPOCH_MS - 1_170_000;
		case "unit-passed":
			return STORY_EPOCH_MS - 1_160_000;
		case "settling":
			return STORY_EPOCH_MS - 1_155_000;
		case "failed":
			return STORY_EPOCH_MS - 1_140_000;
		default: {
			const _exhaustive: never = step;
			return _exhaustive;
		}
	}
}

function createReviewEvents(step: JiraAgentsReviewStep): readonly StaticTimelineEvent[] {
	return [
		...BUILD_EVENTS,
		HANDOFF_EVENT,
		statusEvent("story-moved-review", "In progress", "In review", STORY_EPOCH_MS - 1_260_000),
		createPullRequestEvent({
			checks: reviewChecksForStep(step),
			id: "story-pr-review",
			mergeState: "blocked",
			reviewDecision: "review-required",
			updatedAtMs: reviewUpdatedAtMsForStep(step),
		}),
		...(step === "failed" ? [FAILED_CI_EVENT] : []),
	];
}

function createFixEvents(
	fixStep: JiraAgentsFixStep,
	options: Pick<JiraAgentsStoryStateOptions, "fixAgentId"> = {},
): readonly StaticTimelineEvent[] {
	// Continue from Review's failed PR settle; status returns to In progress.
	const reviewEnd: readonly StaticTimelineEvent[] = [
		...createReviewEvents("failed"),
		statusEvent("story-moved-fix", "In review", "In progress", STORY_EPOCH_MS - 1_020_000),
	];
	if (fixStep === "failed") {
		return reviewEnd;
	}
	const repairComplete = fixStep === "complete";
	const fixAgent = resolveFixAgent(options);
	return [
		...reviewEnd,
		{
			id: "story-ci-repair",
			kind: "changed-files",
			actor: createFixAgentActor(fixAgent),
			summary: repairComplete ? "Repaired the failed CI path" : "Repairing the failed CI path",
			description: repairComplete
				? "Narrowed the nullable delivery address before order creation and reran the failed lint and typecheck check to green while preserving the existing green unit and browser results."
				: "Narrowed the nullable delivery address before order creation and is rerunning the failed lint and typecheck check while preserving the green unit and browser results.",
			branch: "feature/shop-4821-guest-checkout",
			tag: repairComplete
				? { text: "CI rerun passed", color: "green" }
				: { text: "CI rerun active", color: "blue" },
			sessionItem: createStoryArtifactSession({
				id: "story-ci-repair-session",
				title: "Repair delivery-address validation",
				state: repairComplete ? "complete" : "running",
				agent: fixAgent,
				branch: "feature/shop-4821-guest-checkout",
				elapsedSeconds: repairComplete ? 174 : 96,
			}),
			outputs: [],
			createdAtMs: STORY_EPOCH_MS - 960_000,
		},
		createPullRequestEvent({
			checks: repairComplete ? PASSED_PR_CHECKS : RERUNNING_PR_CHECKS,
			id: "story-pr-fix-rerun",
			mergeState: "blocked",
			reviewDecision: "review-required",
			updatedAtMs: STORY_EPOCH_MS - (repairComplete ? 780_000 : 900_000),
		}),
	];
}

function createApproveEvents(pullRequestApproved: boolean): readonly StaticTimelineEvent[] {
	return [
		...createFixEvents("complete"),
		ACCEPTANCE_MATRIX_EVENT,
		statusEvent("story-moved-approve", "In progress", "In review", STORY_EPOCH_MS - 660_000),
		createPullRequestEvent({
			checks: PASSED_PR_CHECKS,
			id: "story-pr-approve",
			mergeState: pullRequestApproved ? "ready" : "blocked",
			reviewDecision: pullRequestApproved ? "approved" : "review-required",
			updatedAtMs: STORY_EPOCH_MS - 600_000,
		}),
		...(pullRequestApproved ? [{
			id: "story-venn-approved",
			kind: "event" as const,
			actor: VENN_ACTOR,
			icon: "linked" as const,
			segments: [
				{ type: "text" as const, text: "approved " },
				{ type: "code" as const, text: "PR #1847" },
				{ type: "text" as const, text: " for production release" },
			],
			createdAtMs: STORY_EPOCH_MS - 540_000,
		}] : []),
	];
}

const RELEASE_EVENTS: readonly StaticTimelineEvent[] = [
	...createApproveEvents(true),
	createPullRequestEvent({
		checks: PASSED_PR_CHECKS,
		id: "story-pr-merged",
		mergeState: "merged",
		reviewDecision: "approved",
		status: "Merged",
		updatedAtMs: STORY_EPOCH_MS - 480_000,
	}),
	// List-only follow-up PR for Release metrics / select — no guided-review detail.
	// Distinct author/repo from #1847 so the Release select rows stay visually distinct.
	createPullRequestEvent({
		additions: 24,
		authorAvatarSrc: "/avatar-human/priya-hansra.png",
		authorName: "Priya Hansra",
		branch: "fix/shop-4821-guest-email-validation",
		checks: PASSED_PR_CHECKS,
		createdAtMs: STORY_EPOCH_MS - 420_000,
		deletions: 6,
		id: "story-pr-merged-follow-up",
		mergeState: "merged",
		number: 1848,
		repository: "shop/checkout-api",
		reviewDecision: "approved",
		status: "Merged",
		title: "Harden guest checkout email validation",
		updatedAtMs: STORY_EPOCH_MS - 400_000,
	}),
	{
		id: "story-release-feature-flag",
		kind: "event",
		actor: GITHUB_ACTOR,
		icon: "linked",
		segments: [
			{ type: "text", text: "deployed to production behind " },
			{ type: "code", text: "guest_checkout_v1" },
			{ type: "text", text: " at 5% rollout" },
		],
		createdAtMs: STORY_EPOCH_MS - 360_000,
	},
	{
		id: "story-release-smoke-telemetry",
		kind: "event",
		actor: CLAUDE_CODE_ACTOR,
		icon: "linked",
		segments: [
			{ type: "text", text: "passed production smoke checks and confirmed healthy telemetry: guest completion increased 11.8%, payment failures held at 2.1%, duplicate orders remained at zero, and checkout support contacts stayed within baseline" },
		],
		createdAtMs: STORY_EPOCH_MS - 240_000,
	},
	{
		id: "story-release-rollout-complete",
		kind: "event",
		actor: VENN_ACTOR,
		icon: "linked",
		segments: [
			{ type: "text", text: "completed the feature-flag rollout to " },
			{ type: "lozenge", text: "100%", variant: "success" },
		],
		createdAtMs: STORY_EPOCH_MS - 120_000,
	},
	statusEvent("story-moved-release", "In review", "Done", STORY_EPOCH_MS - 60_000),
];

export function resolveBuildStep(options: JiraAgentsStoryStateOptions): JiraAgentsBuildStep {
	return options.buildStep ?? "complete";
}

export function resolveFixStep(options: JiraAgentsStoryStateOptions): JiraAgentsFixStep {
	return options.fixStep ?? "failed";
}

/**
 * Build stages that already show the PR card artifact also surface work-item PR
 * chrome (title meta, Review pull request resource, Activity Open #1847 entry).
 *
 * Match Review's PR-creation snapshot (Open #1847, +86/−21, first check started)
 * but keep CI failure / running progression in Review. Timestamp sits after the
 * live Claude session so the Open row appears below the tall Build agent card —
 * the same after-agent placement Review shows once Claude is historical.
 */
function createBuildPullRequestEvent(): StaticTimelineEvent {
	return createPullRequestEvent({
		checks: STARTED_PR_CHECKS,
		id: "story-pr-review",
		mergeState: "blocked",
		reviewDecision: "review-required",
		// After Claude's live Build clock (order 1 → STORY_EPOCH_MS - 30_000).
		updatedAtMs: STORY_EPOCH_MS - 12_000,
	});
}

export function storyEventsForChapter(
	chapter: JiraAgentsStoryChapter,
	options: JiraAgentsStoryStateOptions,
): readonly StaticTimelineEvent[] {
	const buildStep = resolveBuildStep(options);
	switch (chapter) {
		case "intake":
			return options.descriptionSkillPhase === "applied"
				? [...INTAKE_EVENTS, DESCRIPTION_APPLIED_EVENT]
				: INTAKE_EVENTS;
		case "plan":
			return PLAN_EVENTS;
		case "build": {
			// Plan-end orientation hold: no PR chrome yet.
			// Later Build steps surface the Open #1847 snapshot after the live
			// Claude session card. The changed-files / agent-output handoff card
			// stays out of Build — Claude's live session already carries that
			// implementation evidence; Review+ reintroduces HANDOFF_EVENT.
			if (buildStep === "ready") return BUILD_EVENTS;
			return [...BUILD_EVENTS, createBuildPullRequestEvent()];
		}
		case "review":
			return createReviewEvents(options.reviewStep ?? "queued");
		case "fix":
			return createFixEvents(resolveFixStep(options), options);
		case "approve":
			return createApproveEvents(options.pullRequestApproved ?? false);
		case "release":
			return RELEASE_EVENTS;
		default: {
			const _exhaustive: never = chapter;
			return _exhaustive;
		}
	}
}
