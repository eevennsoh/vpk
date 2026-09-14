import type {
	PulseAgentSessionPullRequest,
	PulseAgentSessionState,
	PulseCodingAgentId,
	PulseLooseWork,
	PulseLooseWorkPullRequest,
} from "../types";

/**
 * Uncaptured work — coding artifacts that never became a work item.
 *
 * Titles must wrap to two visible lines at the 300px uncaptured card
 * (276px after `p-3`). Lengthen copy naturally; do not pad with empty
 * min-height, `<br>`, or zero-width fillers.
 *
 * `shortTitle` on a session is the other half of that pair: the name the coding
 * agent gave the thread, sized for the single-line session row that sits under
 * a board card. Keep it around 26 characters — the row truncates past that —
 * and name the work, not the narrative around it.
 */

/**
 * The PAY space's configured GitHub repo. Every uncaptured PR, branch, and
 * commit lives here — the same repo Pulse already names on PR #1847.
 */
export const PULSE_SPACE_REPOSITORY = "acme/storefront";

const REPO = PULSE_SPACE_REPOSITORY;

/**
 * The signed-in viewer's own machine. A local session can only be resumed from
 * the device it is running on, so surfaces gate the Resume affordance on this
 * name rather than on a hand-listed set of session ids — reordering or adding
 * fixtures then cannot silently change which rows offer Resume.
 */
export const PULSE_VIEWER_MACHINE_NAME = "Venn’s MacBook";

function session(
	id: string,
	title: string,
	sourceTitle: string,
	detail: string,
	memberIds: readonly string[],
	fields: Readonly<{
		agentId: PulseCodingAgentId;
		machineName: string;
		pullRequest?: PulseAgentSessionPullRequest;
		shortTitle: string;
		state?: PulseAgentSessionState;
		timeLabel: string;
	}>,
): PulseLooseWork {
	return {
		id,
		title,
		kind: "agent-session",
		sourceTitle,
		detail,
		memberIds,
		host: "local",
		agentId: fields.agentId,
		machineName: fields.machineName,
		...(fields.pullRequest === undefined ? {} : { pullRequest: fields.pullRequest }),
		shortTitle: fields.shortTitle,
		...(fields.state === undefined ? {} : { state: fields.state }),
		timeLabel: fields.timeLabel,
	};
}

function pullRequest(
	id: string,
	title: string,
	sourceTitle: string,
	detail: string,
	memberIds: readonly string[],
	fields: PulseLooseWorkPullRequest,
): PulseLooseWork {
	return { id, title, kind: "pull-request", sourceTitle, detail, memberIds, pullRequest: fields };
}

function branch(
	id: string,
	title: string,
	sourceTitle: string,
	detail: string,
	memberIds: readonly string[],
): PulseLooseWork {
	return { id, title, kind: "branch", sourceTitle, detail, memberIds };
}

function commit(
	id: string,
	title: string,
	sourceTitle: string,
	detail: string,
	memberIds: readonly string[],
): PulseLooseWork {
	return { id, title, kind: "commit", sourceTitle, detail, memberIds };
}

export const PULSE_LOOSE_WORK: readonly PulseLooseWork[] = [
	/* s1 — Adapter deleted */
	session(
		"lw-scope-thread",
		"The adapter keep-or-delete argument still lives in a local Claude session",
		"PAY-101",
		"host local · worktree .worktrees/pay-101-adapter · the decision itself is not written down",
		["priya", "maya", "jordan", "venn"],
		{
			agentId: "claude",
			machineName: PULSE_VIEWER_MACHINE_NAME,
			pullRequest: {
				number: 1839,
				status: "merged",
				title: "Call-site inventory across four services",
				files: 14,
				additions: 312,
				deletions: 8,
				branch: "pay-101-call-site-inventory",
				description: "Inventory every LegacyGatewayAdapter call site across checkout-web, payments-api, ledger, and the two test harnesses, so the keep-or-delete argument has a number behind it.",
			},
			shortTitle: "Keep or delete the adapter",
			timeLabel: "Last week",
		},
	),
	session(
		"lw-kickoff-killswitch-session",
		"Kill switch as a prerequisite still lives in a local Cursor session",
		"PAY-121",
		"host local · worktree .worktrees/pay-121-kill-switch · Jordan asked; the answer is not on the item",
		["venn", "jordan"],
		{ agentId: "cursor", machineName: PULSE_VIEWER_MACHINE_NAME, shortTitle: "Kill switch as port gate", state: "needs-input", timeLabel: "5d ago" },
	),
	pullRequest(
		"lw-kickoff-inventory-pr",
		"Fourteen extra call sites, inventoried in an unlinked pull request",
		"PR #1840",
		`${REPO} · PR #1840 · 14 files, the two test harnesses everyone forgets · no linked work item`,
		["jordan"],
		{ number: 1840, status: "Open", files: 14, additions: 312, deletions: 0, branch: "inventory/forgotten-harnesses" },
	),
	pullRequest(
		"lw-kickoff-lanes-pr",
		"Lane assignments for humans and agents, still an unlinked pull request",
		"PR #1842",
		`${REPO} · PR #1842 · 3 files · roster lives in git, not on PAY-101`,
		["priya", "release-agent"],
		{ number: 1842, status: "Open", files: 3, additions: 86, deletions: 4, branch: "docs/lane-assignments" },
	),
	commit(
		"lw-kickoff-decision-commit",
		"The adapter-delete vote is recorded only as an unlinked commit",
		"b4c19e8",
		`${REPO} · b4c19e8 · written after the scope call · never attached to PAY-101`,
		["priya"],
	),
	pullRequest(
		"lw-kickoff-port-gate-pr",
		"The first port is gated on a per-account kill switch, still unlinked",
		"PR #1841",
		`${REPO} · PR #1841 · 2 files · createPaymentIntent waits on PAY-121 · no linked work item`,
		["venn"],
		{ number: 1841, status: "Open", files: 2, additions: 28, deletions: 0, branch: "docs/port-gated-on-kill-switch" },
	),
	commit(
		"lw-kickoff-gate-commit",
		"Kill switch as a gate on the first port, recorded only as an unlinked commit",
		"c4e82b1",
		`${REPO} · c4e82b1 · one merchant has to be pullable · never attached to PAY-104`,
		["venn"],
	),

	/* s2 — Delete proven */
	pullRequest(
		"lw-adapter-branch",
		"Proof branch deleting the whole adapter, still unlinked",
		"PR #1847",
		`${REPO} · PR #1847 · 41 files, 4,180 deletions · no linked work item`,
		["maya"],
		{ number: 1847, status: "Open", files: 41, additions: 0, deletions: 4180, branch: "proof/delete-legacy-gateway-adapter" },
	),
	branch(
		"lw-loom-spike",
		"Spike branch that proves the adapter can go, still unlinked",
		"spike/delete-legacy-adapter",
		`${REPO} · unlinked spike branch · never attached to PAY-102`,
		["maya"],
	),
	session(
		"lw-spike-session",
		"Why the adapter can go, still sitting in a local Codex session",
		"PAY-102",
		"host local · worktree .worktrees/pay-102-spike · the yes-and-asterisk is not on the item",
		["maya"],
		{
			agentId: "codex",
			machineName: "Maya’s Studio",
			pullRequest: {
				number: 1847,
				status: "merged",
				title: "Prove LegacyGatewayAdapter can be deleted outright",
				files: 9,
				additions: 186,
				deletions: 41,
				branch: "pay-102-legacy-adapter-spike",
				description: "Spike that routes the last four adapter-only paths through the v2 client. The answer is yes, with one asterisk: the sandbox replay path still needs its own port.",
			},
			shortTitle: "Adapter deletion proof",
			timeLabel: "3d ago",
		},
	),
	session(
		"lw-spike-webhook-session",
		"Challenge webhook gap notes still live in a local GitHub Copilot session",
		"PAY-107",
		"host local · worktree .worktrees/pay-107-webhook · payments-api still has no handler",
		["maya", "review-agent", "venn"],
		{ agentId: "copilot", machineName: "MacBook-Pro.local", shortTitle: "Challenge webhook gap", state: "running", timeLabel: "2d ago" },
	),
	pullRequest(
		"lw-spike-retry-pr",
		"Retry path leaves the adapter on this port, still an unlinked pull request",
		"PR #1849",
		`${REPO} · PR #1849 · 3 files · reply to #1851 · never attached to PAY-104`,
		["venn"],
		{ number: 1849, status: "Open", files: 3, additions: 41, deletions: 12, branch: "fix/retry-leaves-adapter" },
	),
	pullRequest(
		"lw-spike-stub-pr",
		"PAY-107 webhook stub that never got linked to the work item",
		"PR #1848",
		`${REPO} · PR #1848 · 6 files, stub only · the item still reads “investigate”`,
		["maya", "review-agent"],
		{ number: 1848, status: "Open", files: 6, additions: 118, deletions: 22, branch: "stub/challenge-webhook-handler" },
	),
	commit(
		"lw-spike-compile-commit",
		"checkout-web compiling against v2, proof left as an unlinked commit",
		"d2a70f1",
		`${REPO} · d2a70f1 · challenge handler stubbed · never attached to PAY-102`,
		["maya"],
	),

	/* s3 — Keys bouncing */
	session(
		"lw-sandbox-triage",
		"Root cause of the sandbox 401s still sits in a local Claude session",
		"PAY-112",
		"host local · worktree .worktrees/pay-112-sandbox-401 · PAY-112 still reads “investigating”",
		["jordan", "review-agent", "venn"],
		{
			agentId: "claude",
			machineName: "H13XSGKLS1",
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
			timeLabel: "Yesterday",
		},
	),
	commit(
		"lw-oncall-note",
		"On-call handover note on key truncation, still an unlinked commit",
		"a3f81c2",
		`${REPO} · a3f81c2 · written at 03:10 Tuesday · no linked work item`,
		["jordan"],
	),
	pullRequest(
		"lw-sandbox-chase-pr",
		"Who owns the sandbox retention window, still an unlinked pull request",
		"PR #1854",
		`${REPO} · PR #1854 · 1 file · the question Priya asked at 11:02 · never attached to PAY-112`,
		["venn"],
		{ number: 1854, status: "Open", files: 1, additions: 16, deletions: 0, branch: "docs/who-owns-key-retention" },
	),
	commit(
		"lw-sandbox-retention-commit",
		"Retention window still unanswered, recorded only as an unlinked commit",
		"8f1a03c",
		`${REPO} · 8f1a03c · PAY-112 still reads investigating · no linked work item`,
		["venn"],
	),
	session(
		"lw-regression-replay-session",
		"Replay-risk blast radius still lives in a local Cursor session",
		"PAY-112",
		"host local · worktree .worktrees/pay-112-replay-risk · retention window still unknown",
		["jordan", "priya"],
		{ agentId: "cursor", machineName: "DESKTOP-7K2M9Q1", shortTitle: "Key replay blast radius", state: "needs-input", timeLabel: "5hr ago" },
	),
	pullRequest(
		"lw-regression-reject-pr",
		"Reject over-length keys loudly, still an unlinked pull request",
		"PR #1853",
		`${REPO} · PR #1853 · 2 files · the two-line fix never attached to PAY-107`,
		["jordan"],
		{ number: 1853, status: "Open", files: 2, additions: 18, deletions: 6, branch: "fix/reject-overlength-keys" },
	),
	pullRequest(
		"lw-regression-sentry-pr",
		"Sentry grouping for truncated keys, still an unlinked pull request",
		"PR #1856",
		`${REPO} · PR #1856 · fingerprint rule · 1,204 events still have no work item`,
		["priya", "review-agent"],
		{ number: 1856, status: "Open", files: 1, additions: 24, deletions: 0, branch: "ops/sentry-idempotency-fingerprint" },
	),
	commit(
		"lw-regression-boundary-commit",
		"Key-length boundary case, committed and never linked to PAY-113",
		"9e18c44",
		`${REPO} · 9e18c44 · suite still passes at 73 characters · no linked work item`,
		["review-agent"],
	),

	/* s4 — Six merges */
	pullRequest(
		"lw-night-prs",
		"Six agent pull requests merged overnight, none of them linked",
		"PRs #1862–#1867",
		`${REPO} · #1862–#1867 · all green, none linked to a work item`,
		["review-agent", "test-agent", "release-agent", "venn"],
		{ number: 1862, status: "Merged", files: 18, additions: 1240, deletions: 86, branch: "agent/night-shift-contract-suite" },
	),
	branch(
		"lw-flag-edits",
		"Kill switch targeting rules live on a branch, with no Jira record",
		"flag/payments-sdk-v2-kill-switch",
		`${REPO} · 3 targeting rules changed at 01:14 · no change record in Jira`,
		["release-agent"],
	),
	session(
		"lw-night-suite-session",
		"Overnight contract-suite Cursor session never captured on PAY-113",
		"PAY-113",
		"host local · worktree .worktrees/pay-113-contract-suite · 214 assertions, no work item",
		["test-agent", "venn"],
		{
			agentId: "cursor",
			machineName: "MBP-M4-MAX",
			pullRequest: {
				number: 1863,
				status: "merged",
				title: "Land the 3-D Secure contract suite with 214 assertions",
				files: 22,
				additions: 531,
				deletions: 19,
				branch: "pay-113-3ds-contract-suite",
				description: "Overnight run that turns the 3-D Secure challenge matrix into 214 contract assertions, including the three decline codes the manual suite never covered.",
			},
			shortTitle: "3-D Secure suite run",
			timeLabel: "2hr ago",
		},
	),
	session(
		"lw-night-killswitch-session",
		"Why the kill switch is per-account, still a local Codex session",
		"PAY-121",
		"host local · worktree .worktrees/pay-121-per-account · read out of PAY-112, never filed",
		["release-agent", "priya"],
		{ agentId: "codex", machineName: "esoh-mbp", shortTitle: "Per-account kill switch", state: "running", timeLabel: "1hr ago" },
	),
	pullRequest(
		"lw-night-reject-pr",
		"Returned challenge-retry PR still unlinked while the author sleeps",
		"PR #1868",
		`${REPO} · PR #1868 · swallowed error in the retry path · author is not awake`,
		["review-agent"],
		{ number: 1868, status: "Open", files: 4, additions: 62, deletions: 11, branch: "fix/challenge-retry-swallow" },
	),
	commit(
		"lw-night-harness-commit",
		"Webhook replay harness landed as a commit with no work item",
		"f6d3a91",
		`${REPO} · f6d3a91 · replays the challenge webhook · never attached to PAY-113`,
		["test-agent"],
	),
	session(
		"lw-night-link-session",
		"Bulk-linking the overnight merges still lives in a local Claude session",
		"PAY-113",
		"host local · worktree .worktrees/pay-113-link-merges · six merges, none on the board",
		["venn"],
		{
			agentId: "claude",
			machineName: "Studio",
			pullRequest: {
				number: 1869,
				status: "created",
				title: "Map overnight merges to PAY-113 and PAY-105",
				files: 6,
				additions: 88,
				deletions: 34,
				branch: "pay-113-map-overnight-merges",
				description: "Backfill the work-item trailer on six overnight merges so the board stops showing PAY-113 and PAY-105 as untouched since Friday.",
			},
			shortTitle: "Link overnight merges",
			timeLabel: "42m ago",
		},
	),
	pullRequest(
		"lw-night-link-pr",
		"Six overnight merges mapped to PAY-113 and PAY-105, still unlinked",
		"PR #1869",
		`${REPO} · PR #1869 · 1 file · the mapping the board does not have · no linked work item`,
		["venn"],
		{ number: 1869, status: "Open", files: 1, additions: 24, deletions: 0, branch: "docs/link-night-shift-merges" },
	),

	/* s5 — Wallet cut */
	session(
		"lw-figma-parked",
		"Wallet cut and card-artwork reason still live in a local Cursor session",
		"PAY-118",
		"host local · worktree .worktrees/pay-118-wallet-cut · the reason we cut it is not on the item",
		["diego"],
		{ agentId: "cursor", machineName: "Diego’s MacBook Air", shortTitle: "Why the wallet was cut", state: "needs-input", timeLabel: "18m ago" },
	),
	commit(
		"lw-copy-doc",
		"Eleven decline strings, already read by legal, still an unlinked commit",
		"c91e4b7",
		`${REPO} · c91e4b7 · approved copy with no work item and no localisation ticket`,
		["diego", "priya", "venn"],
	),
	session(
		"lw-wallet-ship-session",
		"Ship-note rewrite after the wallet cut, still a local Claude session",
		"PAY-130",
		"host local · worktree .worktrees/pay-130-ship-note · customer-facing line is not on the item",
		["venn", "priya"],
		{
			agentId: "claude",
			machineName: "MacBookPro.lan",
			pullRequest: {
				number: 1872,
				status: "created",
				title: "Rewrite the customer ship note after the wallet cut",
				files: 3,
				additions: 74,
				deletions: 46,
				branch: "pay-130-ship-note-rewrite",
				description: "Drop the saved-card wallet promise from the release note and say what actually ships: guest checkout, faster 3-D Secure, and a wallet beta with no date on it.",
			},
			shortTitle: "Ship note after the cut",
			timeLabel: "8m ago",
		},
	),
	pullRequest(
		"lw-wallet-ship-pr",
		"Customer-facing ship line after the wallet cut, still an unlinked pull request",
		"PR #1872",
		`${REPO} · PR #1872 · 2 files · the line Priya asked for · never attached to PAY-130`,
		["venn"],
		{ number: 1872, status: "Open", files: 2, additions: 22, deletions: 8, branch: "copy/ship-note-after-wallet-cut" },
	),
	pullRequest(
		"lw-wallet-latency-pr",
		"Saved-card round-trip measurement, still an unlinked pull request",
		"PR #1871",
		`${REPO} · PR #1871 · staging fixtures · 180–240 ms · never attached to PAY-118`,
		["priya"],
		{ number: 1871, status: "Open", files: 2, additions: 44, deletions: 0, branch: "perf/saved-card-round-trip" },
	),
	pullRequest(
		"lw-wallet-taxonomy-pr",
		"Eleven decline codes mapped, still an unlinked pull request",
		"PR #1873",
		`${REPO} · PR #1873 · three codes have no fixture · never attached to PAY-123`,
		["diego", "test-agent"],
		{ number: 1873, status: "Open", files: 8, additions: 196, deletions: 12, branch: "copy/v2-decline-taxonomy" },
	),
	commit(
		"lw-wallet-cut-commit",
		"Wallet cut decision recorded only as an unlinked commit",
		"1c8b5e2",
		`${REPO} · 1c8b5e2 · artwork requirement attached · lives nowhere on PAY-118`,
		["diego"],
	),

	/* s6 — Rollback proven */
	session(
		"lw-rehearsal-draft",
		"Rollback rehearsal run log, still a local Claude session on PAY-119",
		"PAY-119",
		"host local · worktree .worktrees/pay-119-rollback-rehearsal · 4m 11s recorded · not linked to the epic",
		["priya", "release-agent", "venn"],
		{ agentId: "claude", machineName: "Home Mini", shortTitle: "Rollback rehearsal log", state: "running", timeLabel: "Yesterday" },
	),
	pullRequest(
		"lw-rehearsal-runbook-pr",
		"Kill-switch runbook moved out of a worktree, still an unlinked pull request",
		"PR #1876",
		`${REPO} · PR #1876 · 4 files · somewhere a pager-holder can find at 3am · never attached to PAY-121`,
		["venn"],
		{ number: 1876, status: "Open", files: 4, additions: 96, deletions: 0, branch: "docs/kill-switch-runbook-from-worktree" },
	),
	branch(
		"lw-killswitch-loom",
		"How to flip the kill switch at 3am, sitting on an unlinked branch",
		"docs/kill-switch-3am-runbook",
		`${REPO} · runbook branch · recorded at 22:00 Sydney · never linked to PAY-121`,
		["maya"],
	),
	session(
		"lw-rehearsal-pager-session",
		"How to hold the pager at 3am, still sitting in a local Cursor session",
		"PAY-121",
		"host local · worktree .worktrees/pay-121-pager · the runbook is a worktree, not the epic",
		["maya", "jordan"],
		{
			agentId: "cursor",
			machineName: "MAYA-MBP16",
			pullRequest: {
				number: 1876,
				status: "created",
				title: "Publish the kill-switch runbook for pager holders",
				files: 3,
				additions: 64,
				deletions: 3,
				branch: "pay-121-kill-switch-runbook",
				description: "Write down the 3am path: how to read the rollout dashboard, when to arm the kill switch, and who to wake once it is armed.",
			},
			shortTitle: "3am pager handover",
			timeLabel: "3m ago",
		},
	),
	pullRequest(
		"lw-rehearsal-harness-pr",
		"Synthetic-payment rehearsal harness, still an unlinked pull request",
		"PR #1875",
		`${REPO} · PR #1875 · 200 payments, flag pulled mid-flight · never attached to PAY-119`,
		["priya", "jordan"],
		{ number: 1875, status: "Open", files: 11, additions: 420, deletions: 8, branch: "rehearsal/synthetic-payments" },
	),
	pullRequest(
		"lw-rehearsal-export-pr",
		"Finance-export stamp fix, still an unlinked pull request",
		"PR #1878",
		`${REPO} · PR #1878 · write version at settlement · never attached to PAY-128`,
		["release-agent"],
		{ number: 1878, status: "Open", files: 3, additions: 88, deletions: 14, branch: "fix/settlement-sdk-version" },
	),
	commit(
		"lw-rehearsal-numbers-commit",
		"Rehearsal timings — 4m 11s to a clean ledger — only an unlinked commit",
		"4a7f03d",
		`${REPO} · 4a7f03d · both in-flight challenges recovered · no linked work item`,
		["priya"],
	),

	/* s7 — Two blockers */
	commit(
		"lw-p95-screenshot",
		"v2 is 42 ms faster at p95, and the graph lives only in an unlinked commit",
		"e7b02d4",
		`${REPO} · e7b02d4 · changes the rollout argument, lives nowhere on the board`,
		["maya"],
	),
	session(
		"lw-ship-p95-session",
		"The 42 ms p95 win still lives only in a local Codex session",
		"PAY-126",
		"host local · worktree .worktrees/pay-126-p95 · strongest argument for going faster, unfiled",
		["maya"],
		{ agentId: "codex", machineName: "Gaming PC", shortTitle: "42 ms p95 win on v2", state: "running", timeLabel: "18m ago" },
	),
	session(
		"lw-ship-approval-session",
		"One-percent targeting rule, staged in a local Codex session",
		"PAY-121",
		"host local · worktree .worktrees/pay-121-targeting · the agent will not arm it",
		["release-agent", "jordan"],
		{
			agentId: "codex",
			machineName: "Jordan’s MacBook Pro",
			pullRequest: {
				number: 1882,
				status: "created",
				title: "Stage the one-percent English-only targeting rule",
				files: 5,
				additions: 129,
				deletions: 11,
				branch: "pay-121-one-percent-targeting",
				description: "Stage the rollout rule at one percent of English-only accounts. Staged, not armed: the agent will not flip it without a named human on the approval.",
			},
			shortTitle: "One-percent targeting",
			timeLabel: "Just now",
		},
	),
	pullRequest(
		"lw-ship-targeting-pr",
		"Unapproved one-percent targeting rule, still an unlinked pull request",
		"PR #1882",
		`${REPO} · PR #1882 · one account, English only · never attached to PAY-121`,
		["release-agent"],
		{ number: 1882, status: "Open", files: 2, additions: 36, deletions: 0, branch: "flag/one-percent-english-only" },
	),
	pullRequest(
		"lw-ship-exports-pr",
		"Two dead adapter exports flagged in an unlinked pull request",
		"PR #1885",
		`${REPO} · PR #1885 · follow-up after the deletion · never attached to PAY-126`,
		["jordan", "maya"],
		{ number: 1885, status: "Open", files: 5, additions: 12, deletions: 40, branch: "cleanup/dead-adapter-exports" },
	),
	session(
		"lw-ship-english-session",
		"English-only first slice still lives in a local Codex session",
		"PAY-121",
		"host local · worktree .worktrees/pay-121-english-only · the Monday path is not on the item",
		["venn"],
		{ agentId: "codex", machineName: "C02Y91N8JGH5", shortTitle: "English-only first slice", state: "needs-input", timeLabel: "3m ago" },
	),
	pullRequest(
		"lw-ship-retention-pr",
		"Still chasing the sandbox retention window, still an unlinked pull request",
		"PR #1886",
		`${REPO} · PR #1886 · 1 file · four days open with platform · never attached to PAY-112`,
		["venn"],
		{ number: 1886, status: "Open", files: 1, additions: 11, deletions: 0, branch: "ops/chase-sandbox-retention" },
	),
];
