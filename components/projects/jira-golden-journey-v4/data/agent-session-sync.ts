import type { PulseLooseWork } from "@/components/blocks/jira-kanban/experimental/pulse/types";

type JiraGoldenJourneyV4SyncSession = Extract<PulseLooseWork, { kind: "agent-session" }>;

const SYNC_DELAY_MIN_MS = 4_000;
const SYNC_DELAY_MAX_MS = 8_000;

export const JIRA_GOLDEN_JOURNEY_V4_SYNC_SESSIONS = [
	{
		agentId: "cursor",
		detail: "host local · worktree .worktrees/pay-107-webhook-gap · findings have not been linked yet",
		host: "local",
		id: "lw-sync-webhook-gap",
		issueStatus: "In progress",
		kind: "agent-session",
		machineName: "MacBook-Pro.local",
		memberIds: ["maya", "venn"],
		pullRequest: {
			number: 1856,
			status: "created",
			title: "Move retry and backoff out of LegacyGatewayAdapter",
			files: 7,
			additions: 163,
			deletions: 88,
			branch: "pay-107-retry-backoff-extract",
			description: "Lift retry and exponential backoff into a shared policy the v2 client owns, so deleting the adapter does not take the retry semantics with it.",
		},
		shortTitle: "Challenge webhook gap",
		sourceTitle: "PAY-107",
		timeLabel: "Just now",
		title: "Challenge webhook gap notes just landed from a local Cursor session",
	},
	{
		agentId: "codex",
		detail: "host local · worktree .worktrees/pay-112-sandbox-401 · the root cause is still untracked",
		host: "local",
		id: "lw-sync-sandbox-root-cause",
		issueStatus: "In review",
		kind: "agent-session",
		machineName: "H13XSGKLS1",
		memberIds: ["jordan", "venn"],
		pullRequest: {
			number: 1858,
			status: "failed",
			title: "Confirm the sandbox key retention window before replay",
			files: 4,
			additions: 97,
			deletions: 12,
			branch: "pay-112-sandbox-key-retention",
			description: "Pin the sandbox key retention window so replayed requests stop 401ing. Checks are red: the retention probe needs a credential the CI runner does not hold yet.",
		},
		shortTitle: "Sandbox 401 root cause",
		sourceTitle: "PAY-112",
		timeLabel: "Just now",
		title: "Sandbox 401 root cause just arrived from a local Codex session",
	},
	{
		agentId: "copilot",
		detail: "host local · worktree .worktrees/pay-118-replay-risk · the blast radius is not on the item",
		host: "local",
		id: "lw-sync-replay-blast-radius",
		issueStatus: "To do",
		kind: "agent-session",
		machineName: "DESKTOP-7K2M9Q1",
		memberIds: ["priya", "jordan"],
		pullRequest: {
			number: 1871,
			status: "merged",
			title: "Measure saved-card round-trip latency",
			files: 8,
			additions: 204,
			deletions: 57,
			branch: "pay-118-saved-card-latency",
			description: "Instrument the saved-card path end to end and publish the p95 round trip, so the replay-risk blast radius is argued from a number rather than a hunch.",
		},
		shortTitle: "Replay-risk blast radius",
		sourceTitle: "PAY-118",
		timeLabel: "Just now",
		title: "Replay-risk blast radius just synced from a local GitHub Copilot session",
	},
	{
		agentId: "claude",
		detail: "host local · worktree .worktrees/pay-121-kill-switch · rollout notes still need a work item link",
		host: "local",
		id: "lw-sync-kill-switch-rollout",
		issueStatus: "In review",
		kind: "agent-session",
		machineName: "Venn’s MacBook",
		memberIds: ["venn", "jordan"],
		pullRequest: {
			number: 1866,
			status: "created",
			title: "Add per-account targeting and an armed kill switch",
			files: 6,
			additions: 142,
			deletions: 16,
			branch: "pay-121-account-targeting-kill-switch",
			description: "Target the v2 rollout per account and add a kill switch that reverts to the v1 path in one call, with the armed state readable from the rollout dashboard.",
		},
		shortTitle: "Kill switch rollout notes",
		sourceTitle: "PAY-121",
		timeLabel: "Just now",
		title: "Kill switch rollout notes just appeared from a local Claude session",
	},
	{
		agentId: "codex",
		detail: "host local · worktree .worktrees/pay-115-retry-telemetry · the verification summary is still local",
		host: "local",
		id: "lw-sync-retry-telemetry",
		issueStatus: "In review",
		kind: "agent-session",
		machineName: "Maya’s Studio",
		memberIds: ["maya", "priya"],
		shortTitle: "Retry telemetry review",
		sourceTitle: "PAY-115",
		timeLabel: "Just now",
		title: "Retry telemetry review just synced from a local Codex session",
	},
	{
		agentId: "cursor",
		detail: "host local · worktree .worktrees/pay-119-contract-tests · uncovered cases have not been captured",
		host: "local",
		id: "lw-sync-contract-test-gaps",
		issueStatus: "In review",
		kind: "agent-session",
		machineName: "MacBook-Pro.local",
		memberIds: ["jordan", "maya"],
		shortTitle: "Contract test gaps",
		sourceTitle: "PAY-119",
		timeLabel: "Just now",
		title: "Contract test gaps just landed from a local Cursor session",
	},
	{
		agentId: "cursor",
		detail: "host local · worktree .worktrees/pay-104-deprecation-copy · the migration copy is still untracked",
		host: "local",
		id: "lw-sync-deprecation-copy",
		issueStatus: "In review",
		kind: "agent-session",
		machineName: "DESKTOP-7K2M9Q1",
		memberIds: ["priya", "venn"],
		shortTitle: "Deprecation copy pass",
		sourceTitle: "PAY-104",
		timeLabel: "Just now",
		title: "Deprecation copy pass just arrived from a local Cursor session",
	},
	{
		agentId: "claude",
		detail: "host local · worktree .worktrees/pay-132-release-gate · the final gate decision is not linked",
		host: "local",
		id: "lw-sync-release-gate",
		issueStatus: "In review",
		kind: "agent-session",
		machineName: "Venn’s MacBook",
		memberIds: ["venn", "priya"],
		shortTitle: "Release gate decision",
		sourceTitle: "PAY-132",
		timeLabel: "Just now",
		title: "Release gate decision just synced from a local Claude session",
	},
] as const satisfies readonly JiraGoldenJourneyV4SyncSession[];

export function getJiraGoldenJourneyV4SyncDelayMs(
	random: () => number = Math.random,
): number {
	return SYNC_DELAY_MIN_MS + Math.round(random() * (SYNC_DELAY_MAX_MS - SYNC_DELAY_MIN_MS));
}

export function takeJiraGoldenJourneyV4SyncBatch(
	nextIndex: number,
	random: () => number = Math.random,
): Readonly<{
	nextIndex: number;
	sessions: readonly JiraGoldenJourneyV4SyncSession[];
}> {
	const batchSize = random() < 0.5 ? 1 : 2;
	const sessions = JIRA_GOLDEN_JOURNEY_V4_SYNC_SESSIONS.slice(
		nextIndex,
		nextIndex + batchSize,
	);

	return {
		nextIndex: nextIndex + sessions.length,
		sessions,
	};
}

export function removeReviewedJiraGoldenJourneyV4AgentSessionIds(
	currentIds: ReadonlySet<string>,
	reviewedIds?: readonly string[],
): ReadonlySet<string> {
	if (currentIds.size === 0) {
		return currentIds;
	}
	if (reviewedIds === undefined) {
		return new Set();
	}

	const reviewed = new Set(reviewedIds);
	const nextIds = new Set([...currentIds].filter((id) => !reviewed.has(id)));
	return nextIds.size === currentIds.size ? currentIds : nextIds;
}
