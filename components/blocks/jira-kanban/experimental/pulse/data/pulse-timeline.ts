import type {
	PulseContribution,
	PulseMember,
	PulseSnapshot,
	PulseTimeline,
	PulseWorkItem,
} from "../types";
import { PULSE_LOOSE_WORK } from "./pulse-loose-work";

export { PULSE_SPACE_REPOSITORY, PULSE_VIEWER_MACHINE_NAME } from "./pulse-loose-work";

/**
 * Pulse fixture — one sprint week of the `PAY` Payments SDK v2 migration.
 *
 * Monday 17 August through Friday 21 August 2026. Seven snapshots, each a real
 * decision point rather than a status update. Each insight records when it was
 * generated and when it was last updated — an outcome can be revised after it
 * first appears. Those clocks are deliberately uneven; the ruler ignores them
 * and steps insights evenly, because spacing counts outcomes, not elapsed time.
 *
 * All date and time strings are pre-formatted here on purpose: formatting at
 * render time drifts between server and client.
 */

/* ------------------------------------------------------------------ */
/* Avatars — every path verified against `public/`.                     */
/* ------------------------------------------------------------------ */

const AVATAR = {
	venn: "/avatar-user/venn/venn.png",
	maya: "/avatar-user/chloe-lee/color/asow-dev-lime.png",
	jordan: "/avatar-user/issac-varghese/color/asow-dev-lime.png",
	priya: "/avatar-user/ting-chen/color/asow-teamwork-blue.png",
	diego: "/avatar-user/dev-rana/color/asow-product-purple.png",
	reviewAgent: "/avatar-agent-new/blue/decision-director.svg",
	testAgent: "/avatar-agent-new/yellow/ops-agent.svg",
	releaseAgent: "/avatar-agent-new/orange/research-scout.svg",
} as const;

/* ------------------------------------------------------------------ */
/* Members — Venn is the presentation persona (leftmost in the header
 * facepile). Four other humans across four time zones, three agents. Diego
 * stays on the roster and in the story; the header shows seven faces. */
/* ------------------------------------------------------------------ */

const MEMBERS: readonly PulseMember[] = [
	{ id: "venn", name: "Venn", role: "Software engineer", kind: "human", avatarSrc: AVATAR.venn, timezone: "Singapore" },
	{ id: "maya", name: "Maya Ferreira", role: "Staff engineer", kind: "human", avatarSrc: AVATAR.maya, timezone: "Sydney" },
	{ id: "jordan", name: "Jordan Okafor", role: "Senior engineer", kind: "human", avatarSrc: AVATAR.jordan, timezone: "Austin" },
	{ id: "priya", name: "Priya Raman", role: "Engineering manager", kind: "human", avatarSrc: AVATAR.priya, timezone: "London" },
	{ id: "review-agent", name: "Review Agent", role: "Reviews every pull request", kind: "agent", avatarSrc: AVATAR.reviewAgent },
	{ id: "test-agent", name: "Test Author Agent", role: "Writes and repairs tests", kind: "agent", avatarSrc: AVATAR.testAgent },
	{ id: "release-agent", name: "Release Captain Agent", role: "Owns the flag and the rollout", kind: "agent", avatarSrc: AVATAR.releaseAgent },
	{ id: "diego", name: "Diego Santos", role: "Product designer", kind: "human", avatarSrc: AVATAR.diego, timezone: "Lisbon" },
];

/* ------------------------------------------------------------------ */
/* Work items — the part of the week that made it onto the board.       */
/* Titles must wrap to two real lines at the Pulse rail's 320px card    */
/* width. Keep meaning; do not force wrap with <br>.                    */
/* ------------------------------------------------------------------ */

const WORK_ITEMS: readonly PulseWorkItem[] = [
	{
		key: "PAY-101",
		summary: "Inventory every v1 call site across services and name an owner for each",
		tags: [{ text: "discovery", color: "purple" }],
		priority: "medium",
		status: "Done",
		memberIds: ["maya", "jordan", "priya", "venn"],
		assigneeId: "jordan",
		assigneeAvatarSrc: AVATAR.jordan,
		assigneeName: "Jordan Okafor",
	},
	{
		key: "PAY-102",
		summary: "Spike: can LegacyGatewayAdapter be deleted outright instead of ported?",
		tags: [{ text: "spike", color: "teal" }, { text: "sdk", color: "blue" }],
		priority: "major",
		status: "Done",
		memberIds: ["maya", "review-agent"],
		assigneeId: "maya",
		assigneeAvatarSrc: AVATAR.maya,
		assigneeName: "Maya Ferreira",
	},
	{
		key: "PAY-104",
		summary: "Port createPaymentIntent from the adapter onto the v2 client",
		tags: [{ text: "checkout-web", color: "blue" }],
		priority: "major",
		status: "Done",
		memberIds: ["jordan", "review-agent", "venn"],
		assigneeId: "jordan",
		assigneeAvatarSrc: AVATAR.jordan,
		assigneeName: "Jordan Okafor",
	},
	{
		key: "PAY-105",
		summary: "Port confirmPaymentIntent and the full 3-D Secure challenge flow",
		tags: [{ text: "checkout-web", color: "blue" }, { text: "3ds", color: "orange" }],
		priority: "major",
		status: "In progress",
		memberIds: ["jordan", "maya", "test-agent", "venn"],
		assigneeId: "jordan",
		assigneeAvatarSrc: AVATAR.jordan,
		assigneeName: "Jordan Okafor",
	},
	{
		key: "PAY-107",
		summary: "Move retry and backoff out of the adapter and into payments-api",
		tags: [{ text: "payments-api", color: "lime" }],
		priority: "major",
		status: "In review",
		memberIds: ["maya", "review-agent"],
		assigneeId: "maya",
		assigneeAvatarSrc: AVATAR.maya,
		assigneeName: "Maya Ferreira",
	},
	{
		key: "PAY-109",
		summary: "Regenerate typed webhook payloads from the published v2 OpenAPI spec",
		tags: [{ text: "codegen", color: "gray" }],
		priority: "medium",
		status: "Done",
		memberIds: ["test-agent", "maya"],
		assigneeId: "test-agent",
		assigneeAvatarSrc: AVATAR.testAgent,
		assigneeName: "Test Author Agent",
	},
	{
		key: "PAY-112",
		summary: "sandbox-eu rejects v2 idempotency keys that run longer than 64 characters",
		tags: [{ text: "regression", color: "red" }, { text: "3ds", color: "orange" }],
		priority: "major",
		status: "Blocked",
		memberIds: ["jordan", "priya", "review-agent", "venn"],
		assigneeId: "jordan",
		assigneeAvatarSrc: AVATAR.jordan,
		assigneeName: "Jordan Okafor",
	},
	{
		key: "PAY-113",
		summary: "Write contract tests covering the 3-D Secure challenge path",
		tags: [{ text: "tests", color: "green" }, { text: "3ds", color: "orange" }],
		priority: "medium",
		status: "Done",
		memberIds: ["test-agent", "review-agent", "venn"],
		assigneeId: "test-agent",
		assigneeAvatarSrc: AVATAR.testAgent,
		assigneeName: "Test Author Agent",
	},
	{
		key: "PAY-115",
		summary: "Migrate ledger-sync reconciliation over to v2 settlement events",
		tags: [{ text: "ledger-sync", color: "magenta" }],
		priority: "medium",
		status: "In progress",
		memberIds: ["maya", "release-agent", "venn"],
		assigneeId: "maya",
		assigneeAvatarSrc: AVATAR.maya,
		assigneeName: "Maya Ferreira",
	},
	{
		key: "PAY-118",
		summary: "Design and build the saved wallet UI for v2 payment methods",
		tags: [{ text: "design", color: "purple" }, { text: "descoped", color: "gray" }],
		priority: "minor",
		status: "Cut",
		memberIds: ["diego", "priya"],
		assigneeId: "diego",
		assigneeAvatarSrc: AVATAR.diego,
		assigneeName: "Diego Santos",
	},
	{
		key: "PAY-119",
		summary: "Run a full rollback rehearsal against payments-api staging",
		tags: [{ text: "release", color: "yellow" }],
		priority: "major",
		status: "Done",
		memberIds: ["priya", "release-agent", "maya", "venn"],
		assigneeId: "release-agent",
		assigneeAvatarSrc: AVATAR.releaseAgent,
		assigneeName: "Release Captain Agent",
	},
	{
		key: "PAY-121",
		summary: "payments_sdk_v2_rollout: targeting rules plus a per-account kill switch",
		tags: [{ text: "release", color: "yellow" }, { text: "flag", color: "teal" }],
		priority: "major",
		status: "In review",
		memberIds: ["release-agent", "priya", "venn"],
		assigneeId: "release-agent",
		assigneeAvatarSrc: AVATAR.releaseAgent,
		assigneeName: "Release Captain Agent",
	},
	{
		key: "PAY-123",
		summary: "Map the v1 error taxonomy onto all eleven v2 decline reasons",
		tags: [{ text: "content", color: "purple" }],
		priority: "medium",
		status: "In progress",
		memberIds: ["diego", "jordan"],
		assigneeId: "diego",
		assigneeAvatarSrc: AVATAR.diego,
		assigneeName: "Diego Santos",
	},
	{
		key: "PAY-126",
		summary: "Delete LegacyGatewayAdapter and the 4,180 lines sitting behind it",
		tags: [{ text: "sdk", color: "blue" }, { text: "cleanup", color: "green" }],
		priority: "major",
		status: "In review",
		memberIds: ["maya", "review-agent"],
		assigneeId: "maya",
		assigneeAvatarSrc: AVATAR.maya,
		assigneeName: "Maya Ferreira",
	},
	{
		key: "PAY-128",
		summary: "Write the SDK version at settlement time rather than at intent time",
		tags: [{ text: "ledger-sync", color: "magenta" }],
		priority: "medium",
		status: "To do",
		memberIds: ["release-agent", "maya"],
		assigneeId: "release-agent",
		assigneeAvatarSrc: AVATAR.releaseAgent,
		assigneeName: "Release Captain Agent",
	},
	{
		key: "PAY-130",
		summary: "Localise the eleven v2 decline strings into all nine languages",
		tags: [{ text: "content", color: "purple" }, { text: "blocker", color: "red" }],
		priority: "major",
		status: "To do",
		memberIds: ["diego", "priya", "venn"],
		assigneeId: "diego",
		assigneeAvatarSrc: AVATAR.diego,
		assigneeName: "Diego Santos",
	},
];

/* ------------------------------------------------------------------ */
/* Snapshots — the decision points, oldest first.                       */
/* ------------------------------------------------------------------ */

const S1_CONTRIBUTIONS: readonly PulseContribution[] = [
	{
		memberId: "jordan", workItemKeys: ["PAY-101", "PAY-104"], artifactIds: ["a1-inventory"], looseWorkIds: ["lw-scope-thread", "lw-kickoff-inventory-pr", "lw-kickoff-killswitch-session"],
		summary: "Read the inventory back and pushed the count from 47 to 61 by including the two test harnesses everyone forgets. Owns checkout-web for the week.",
	},
	{
		memberId: "priya", workItemKeys: ["PAY-101", "PAY-121"], artifactIds: ["a1-scope", "a1-lanes", "a1-thread"], looseWorkIds: ["lw-scope-thread", "lw-kickoff-lanes-pr", "lw-kickoff-decision-commit"],
		summary: "Ran the scope call, cut the backlog to fourteen items, and made the one decision that shapes the week. Has not written that decision anywhere a new joiner would find it.",
	},
	{
		memberId: "release-agent", workItemKeys: ["PAY-121"], artifactIds: ["a1-lanes"], looseWorkIds: ["lw-kickoff-lanes-pr"],
		summary: "Created payments_sdk_v2_rollout in an off state with no targeting rules, and flagged that the kill switch does not exist yet and will be needed before the first port lands.",
	},
	{
		memberId: "venn", workItemKeys: ["PAY-101", "PAY-104", "PAY-121"], artifactIds: ["a1-lanes", "a1-thread"], looseWorkIds: ["lw-scope-thread", "lw-kickoff-killswitch-session", "lw-kickoff-port-gate-pr", "lw-kickoff-gate-commit"],
		title: "The first port does not ship without a kill switch",
		summary: "Shipping createPaymentIntent without a per-account kill switch would have been cheaper this morning and unrecoverable on the first bad merchant: payments_sdk_v2_rollout is off, but flipping it still takes every account with it. The first port waits on PAY-121 as a prerequisite, not a leftover for rollout week. That is the gate on checkout-web — one merchant has to be pullable before any call site lands. The confirmation lives in a local Claude session, so nothing on PAY-104 says the port is blocked on the flag.",
	},
];

const S2_CONTRIBUTIONS: readonly PulseContribution[] = [
	{
		memberId: "maya", workItemKeys: ["PAY-102", "PAY-107", "PAY-126"], artifactIds: ["a2-spike-pr", "a2-loom", "a2-findings"], looseWorkIds: ["lw-adapter-branch", "lw-loom-spike", "lw-spike-session", "lw-spike-webhook-session", "lw-spike-stub-pr", "lw-spike-compile-commit"],
		summary: "Closed the spike in nine hours with a yes and one asterisk. Proved the delete by pushing it: 41 files, all deletions, checkout-web compiling against v2 with the challenge handler stubbed.",
	},
	{
		memberId: "review-agent", workItemKeys: ["PAY-102", "PAY-104"], artifactIds: ["a2-review", "a2-callsites"], looseWorkIds: ["lw-spike-webhook-session", "lw-spike-stub-pr"],
		summary: "Reviewed both pull requests inside four minutes of each push. Approved the spike branch as a proof, not a merge candidate. Left one unresolved comment on #1851: idempotency key length is not bounded and the upstream limit is unknown.",
	},
	{
		memberId: "venn", workItemKeys: ["PAY-104", "PAY-105", "PAY-107"], artifactIds: ["a2-callsites", "a2-review"], looseWorkIds: ["lw-spike-retry-pr", "lw-spike-webhook-session"],
		title: "Retry has to leave the adapter on this port",
		summary: "Replied to Review Agent on #1851: the retry path has to leave the adapter on this port, not the next one. That is also the PAY-107 webhook gap — payments-api still has no handler, so every 3-D Secure payment stalls the moment LegacyGatewayAdapter goes. Jordan kept going from there; the comment is still unanswered on the call-site PR.",
	},
];

const S3_CONTRIBUTIONS: readonly PulseContribution[] = [
	{
		memberId: "jordan", workItemKeys: ["PAY-105", "PAY-112"], artifactIds: ["a3-sentry", "a3-triage", "a3-handover"], looseWorkIds: ["lw-sandbox-triage", "lw-oncall-note", "lw-regression-replay-session", "lw-regression-reject-pr"],
		summary: "Found the failure at 10:20 and the cause by 10:52: merchant-scoped keys are 73 characters and sandbox-eu truncates at 64 instead of erroring. Wrote the handover note at 03:10 and it is still sitting in his personal space.",
	},
	{
		memberId: "priya", workItemKeys: ["PAY-112", "PAY-105"], artifactIds: ["a3-triage"], looseWorkIds: ["lw-sandbox-triage", "lw-regression-replay-session", "lw-regression-sentry-pr"],
		summary: "Moved PAY-112 to blocked rather than letting it look like progress, and asked payments platform for the retention window on sandbox keys. Nothing downstream moves until that answer arrives.",
	},
	{
		memberId: "review-agent", workItemKeys: ["PAY-112", "PAY-104"], artifactIds: ["a3-review", "a3-sentry"], looseWorkIds: ["lw-sandbox-triage", "lw-regression-sentry-pr", "lw-regression-boundary-commit"],
		summary: "Had already flagged this. The comment on #1851 reading “length not bounded, upstream limit unknown” predates the sandbox failure by nineteen hours and was waved through on green local tests.",
	},
	{
		memberId: "venn", workItemKeys: ["PAY-112", "PAY-104"], artifactIds: ["a3-triage", "a3-sentry"], looseWorkIds: ["lw-sandbox-triage", "lw-sandbox-chase-pr", "lw-sandbox-retention-commit"],
		title: "The retention window is the only number still unsigned",
		summary: "Priya asked who owns the sandbox key retention window two minutes before the root cause landed, and the mention is still unanswered. PAY-112 is blocked and PAY-105 stalls on that single number. Review Agent had already named unbounded key length on the first-port PR nineteen hours earlier; green local tests were treated as the stronger signal. The triage lives in a local Claude session, so the work item still reads investigating.",
	},
];

const S4_CONTRIBUTIONS: readonly PulseContribution[] = [
	{
		memberId: "review-agent", workItemKeys: ["PAY-105", "PAY-107", "PAY-113"], artifactIds: ["a4-prs", "a4-rejects"], looseWorkIds: ["lw-night-prs", "lw-night-reject-pr"],
		summary: "Reviewed all six pull requests, approved four, returned two. One for an error swallowed in the challenge retry path, one because the idempotency fix trimmed over-length keys rather than rejecting them, which is the failure mode Maya named on Tuesday.",
	},
	{
		memberId: "test-agent", workItemKeys: ["PAY-113", "PAY-109"], artifactIds: ["a4-tests", "a4-prs"], looseWorkIds: ["lw-night-prs", "lw-night-suite-session", "lw-night-harness-commit"],
		summary: "Wrote the 3-D Secure contract suite that PAY-113 has been carrying since March: 214 assertions against recorded fixtures, plus a harness that replays the challenge webhook so the tests never touch the sandbox.",
	},
	{
		memberId: "release-agent", workItemKeys: ["PAY-121", "PAY-115"], artifactIds: ["a4-killswitch", "a4-recap"], looseWorkIds: ["lw-flag-edits", "lw-night-prs", "lw-night-killswitch-session"],
		summary: "Read the truncation risk out of PAY-112 and built the per-account kill switch before anything else, so the flag can be pulled for one merchant instead of all of them. That is not what the item asked for.",
	},
	{
		memberId: "venn", workItemKeys: ["PAY-105", "PAY-113", "PAY-121"], artifactIds: ["a4-tests", "a4-prs", "a4-killswitch", "a4-rejects", "a4-recap"], looseWorkIds: ["lw-night-link-session", "lw-night-link-pr", "lw-night-prs"],
		title: "The board still thinks nothing moved overnight",
		summary: "Singapore morning, and six merges are already on main: the 3-D Secure contract suite PAY-113 has been carrying since March, four more landings Review Agent approved, and a per-account kill switch Release Captain Agent pulled out of PAY-112 without being asked. None of them are linked, so PAY-113 is still in To do and PAY-105 still looks like yesterday. Two returned pull requests are waiting for a human call, and three targeting rules on PAY-121 have no change record. The mapping lives in a local Claude session, which is why the work that unblocks the week is invisible on the board.",
	},
];

const S5_CONTRIBUTIONS: readonly PulseContribution[] = [
	{
		memberId: "diego", workItemKeys: ["PAY-118", "PAY-123", "PAY-130"], artifactIds: ["a5-figma", "a5-copy", "a5-review-notes"], looseWorkIds: ["lw-figma-parked", "lw-copy-doc", "lw-wallet-taxonomy-pr", "lw-wallet-cut-commit"],
		summary: "Walked the wallet flow, made the case for cutting it himself, and spent the afternoon on the part that survives: eleven decline reasons mapped to copy that tells the customer what to do next.",
	},
	{
		memberId: "priya", workItemKeys: ["PAY-118", "PAY-115", "PAY-130"], artifactIds: ["a5-review-notes"], looseWorkIds: ["lw-copy-doc", "lw-wallet-ship-session", "lw-wallet-latency-pr"],
		summary: "Treated the cut as a scope change rather than a failure, pulled PAY-115 forward to fill the empty lane, and has not yet created the localisation item that the approved copy now needs.",
	},
	{
		memberId: "test-agent", workItemKeys: ["PAY-123", "PAY-113"], artifactIds: ["a5-copy"], looseWorkIds: ["lw-wallet-taxonomy-pr"],
		summary: "Generated assertion coverage for all eleven decline codes against the v2 error taxonomy and reported three that no fixture currently exercises: expired_card_network, issuer_unavailable and risk_hold.",
	},
	{
		memberId: "venn", workItemKeys: ["PAY-115", "PAY-130"], artifactIds: ["a5-review-notes", "a5-copy"], looseWorkIds: ["lw-copy-doc", "lw-wallet-ship-session", "lw-wallet-ship-pr"],
		title: "The ship note matches the wallet we cut",
		summary: "Rewrote the customer-facing ship line after the wallet cut, in the thread Priya pinged and then on PAY-130 so the copy is not only in chat. The eleven decline strings are signed off and still have no localisation item; Friday is the last day the queue can start and still land before ship.",
	},
];

const S6_CONTRIBUTIONS: readonly PulseContribution[] = [
	{
		memberId: "priya", workItemKeys: ["PAY-119", "PAY-121"], artifactIds: ["a6-rehearsal", "a6-plan"], looseWorkIds: ["lw-rehearsal-draft", "lw-rehearsal-harness-pr", "lw-rehearsal-numbers-commit"],
		summary: "Ran the rehearsal properly instead of on paper: 200 synthetic payments, flag pulled mid-flight, ledger reconciled. Her run log is a draft page nobody has linked to the epic.",
	},
	{
		memberId: "maya", workItemKeys: ["PAY-115", "PAY-128", "PAY-126"], artifactIds: ["a6-loom", "a6-ledger"], looseWorkIds: ["lw-killswitch-loom", "lw-rehearsal-pager-session"],
		summary: "Caught the settlement-record problem during reconciliation and recorded a six minute walkthrough of the kill switch at 22:00 Sydney time for whoever ends up holding the pager.",
	},
	{
		memberId: "release-agent", workItemKeys: ["PAY-121", "PAY-128", "PAY-119"], artifactIds: ["a6-flag", "a6-ledger", "a6-plan"], looseWorkIds: ["lw-rehearsal-draft", "lw-rehearsal-export-pr"],
		summary: "Drove the flag through the rehearsal and proposed the fix for the poisoned version field: write the SDK version at settlement time rather than intent time. Estimated at 88 lines and filed as PAY-128.",
	},
	{
		memberId: "jordan", workItemKeys: ["PAY-105", "PAY-112"], artifactIds: ["a6-rehearsal"], looseWorkIds: ["lw-rehearsal-pager-session", "lw-rehearsal-harness-pr"],
		summary: "Watched the two in-flight challenge payments complete on v1 after the flag went off, which was the case he was most worried about. PAY-112 is still blocked on the platform team.",
	},
	{
		memberId: "venn", workItemKeys: ["PAY-119", "PAY-121"], artifactIds: ["a6-loom", "a6-rehearsal"], looseWorkIds: ["lw-rehearsal-draft", "lw-rehearsal-runbook-pr"],
		title: "The 3am runbook is still sitting in a worktree",
		summary: "Jordan asked for the kill-switch runbook somewhere findable at 3am, not in a worktree. The rehearsal proved rollback in 4m 11s, but the procedure is still spread across a draft page, a vendor console and Maya's recording. PAY-121 is the item a pager-holder would open, and nothing on it points at the runbook.",
	},
];

const S7_CONTRIBUTIONS: readonly PulseContribution[] = [
	{
		memberId: "maya", workItemKeys: ["PAY-126", "PAY-107", "PAY-115"], artifactIds: ["a7-adapter", "a7-p95"], looseWorkIds: ["lw-p95-screenshot", "lw-ship-p95-session", "lw-ship-exports-pr"],
		summary: "Merged the deletion. LegacyGatewayAdapter is gone and retry now lives in payments-api where it can be reasoned about. Also left the p95 comparison as an unlinked commit on Wednesday and never mentioned it again.",
	},
	{
		memberId: "jordan", workItemKeys: ["PAY-105", "PAY-112", "PAY-123"], artifactIds: ["a7-readiness"], looseWorkIds: ["lw-ship-exports-pr"],
		summary: "Finished the last of the 61 call sites and re-ran the full checkout suite green. Will not sign PAY-112 off until the platform team confirms how long sandbox keys are retained.",
	},
	{
		memberId: "diego", workItemKeys: ["PAY-130", "PAY-123"], artifactIds: ["a7-l10n"], looseWorkIds: ["lw-copy-doc"],
		summary: "Handed the eleven decline strings to localisation on Friday afternoon, which puts them back on Wednesday at the earliest. The English copy is final and legal have signed it.",
	},
	{
		memberId: "release-agent", workItemKeys: ["PAY-121", "PAY-128"], artifactIds: ["a7-targeting"], looseWorkIds: ["lw-ship-approval-session", "lw-ship-targeting-pr"],
		summary: "Staged the first rollout rule: one percent of traffic, one account, English-only locale, kill switch armed. The rule is written and unapproved, and will not fire until a human presses it.",
	},
	{
		memberId: "venn", workItemKeys: ["PAY-112", "PAY-121", "PAY-130"], artifactIds: ["a7-targeting", "a7-readiness"], looseWorkIds: ["lw-copy-doc", "lw-ship-english-session", "lw-ship-retention-pr"],
		title: "Monday only works if the first slice stays English-only",
		summary: "The one-percent English-only rule is written and staged; Release Captain Agent will not arm it. PAY-112 is still waiting on the sandbox retention window, which is the other unsigned number from Tuesday. The English-only first slice is the path that does not wait on PAY-130's localisation queue. Both gates are known; neither is written where a Monday approver would look.",
	},
];

const SNAPSHOTS: readonly PulseSnapshot[] = [
	{
		id: "s1-kickoff",
		timestamp: "2026-08-17T08:12:00Z",
		dateLabel: "Mon 17 Aug",
		timeLabel: "08:12",
		updatedAt: "2026-08-17T09:26:00Z",
		updatedDateLabel: "Mon 17 Aug",
		updatedTimeLabel: "09:26",
		chapterLabel: "Adapter deleted",
		rangeLabel: "Fri 17:00 – Mon 08:12",
		title: "We agreed to delete the adapter, not wrap it",
		paragraphs: [
			"Keeping LegacyGatewayAdapter as a compatibility shim would have been cheaper for two weeks and more expensive forever: the v1 adapter still owns retry semantics for 3-D Secure, so every v2 call would have to route back through it. Removal won, conditional on PAY-102 proving it is possible before anyone ports a call site. That sets the shape of the week — fourteen items, one epic, and 61 call sites to port rather than the 47 everyone had been quoting since June. The reasoning exists only in a local Claude session on PAY-101, so nothing on the board says why the adapter is going.",
		],
		artifacts: [
			{ id: "a1-scope", title: "Payments SDK v2 — migration scope", source: "Confluence page", owner: "Priya Raman", iconName: "page", tileVariant: "blueSubtle" },
			{ id: "a1-inventory", title: "Call-site inventory across four services", source: "GitHub · #1839 merged", owner: "Maya Ferreira · +312 lines", logoName: "github" },
			{ id: "a1-thread", title: "#payments-migration — keep or delete the adapter", source: "Chat summary", owner: "38 messages", iconName: "ai-chat", tileVariant: "purpleSubtle" },
			{ id: "a1-lanes", title: "Lane assignments, humans and agents", source: "Confluence page", owner: "Priya Raman", iconName: "page", tileVariant: "tealSubtle" },
		],
		workItemKeys: ["PAY-101", "PAY-102", "PAY-104", "PAY-121"],
		looseWorkIds: ["lw-scope-thread", "lw-kickoff-inventory-pr", "lw-kickoff-decision-commit", "lw-kickoff-killswitch-session", "lw-kickoff-lanes-pr", "lw-kickoff-port-gate-pr", "lw-kickoff-gate-commit"],
		attention: [
			{ id: "s1-sig-decision", tone: "decision", memberId: "priya", timeLabel: "Mon 17 Aug 07:48", workItemKey: "PAY-101", title: "Delete the adapter rather than shim it", detail: "Agreed verbally, recorded nowhere durable. The reasoning lives in a local Claude session that will be gone when the worktree is deleted." },
			{ id: "s1-sig-mention", tone: "attention", memberId: "jordan", timeLabel: "Mon 17 Aug 08:06", workItemKey: "PAY-104", title: "Jordan Okafor mentioned you on PAY-104", detail: "“@you porting createPaymentIntent first only works if the kill switch lands with it — confirm before I start?” Posted 08:06, still unanswered." },
			{ id: "s1-sig-flag", tone: "attention", memberId: "release-agent", timeLabel: "Mon 17 Aug 08:10", workItemKey: "PAY-121", title: "No kill switch on payments_sdk_v2_rollout", detail: "The flag exists and is off. There is no way to disable it for a single account, which the first port will need." },
		],
		nextActions: [
			{ id: "s1-act-decision", label: "Write the adapter decision onto PAY-101", rationale: "The local Claude session has the reasoning and the two objections. Nothing on the board does.", actionLabel: "Capture decision", workItemKey: "PAY-101" },
			{ id: "s1-act-killswitch", label: "Ask Release Captain Agent to build the kill switch first", rationale: "It is a prerequisite for the first merged port, not a rollout-week task.", actionLabel: "Assign agent", workItemKey: "PAY-121" },
		],
		stats: [
			{ id: "s1-stat-items", label: "Items in scope", value: "14" },
			{ id: "s1-stat-sites", label: "Call sites to port", value: "61" },
			{ id: "s1-stat-lanes", label: "Lanes assigned", value: "5" },
			{ id: "s1-stat-uncaptured", label: "Uncaptured", value: "7" },
		],
		memberIds: ["jordan", "priya", "release-agent", "venn"],
		contributions: S1_CONTRIBUTIONS,
	},
	{
		id: "s2-spike",
		timestamp: "2026-08-17T17:55:00Z",
		dateLabel: "Mon 17 Aug",
		timeLabel: "17:55",
		updatedAt: "2026-08-18T09:14:00Z",
		updatedDateLabel: "Tue 18 Aug",
		updatedTimeLabel: "09:14",
		chapterLabel: "Delete proven",
		rangeLabel: "Mon 08:12 – Mon 17:55",
		title: "The adapter can go, with one asterisk",
		paragraphs: [
			"PAY-102 came back yes: v2 exposes the same idempotency guarantees the adapter was faking on top of v1, so LegacyGatewayAdapter can be deleted outright rather than ported — 4,180 lines and one deprecation path instead of two. The asterisk is 3-D Secure. The adapter backed off on a challenge_pending state that v2 replaced with a webhook, and nothing in payments-api listens for that webhook yet, which makes the PAY-107 stub the only real obstacle left. The proof is a branch nobody has linked, so the work item it settles still reads “investigate”.",
		],
		artifacts: [
			{ id: "a2-spike-pr", title: "Delete LegacyGatewayAdapter (proof branch)", source: "GitHub · #1847 open", owner: "Maya Ferreira · −4,180 lines", logoName: "github" },
			{ id: "a2-loom", title: "Adapter spike walkthrough", source: "Loom recording · 9 min", owner: "Maya Ferreira", iconName: "video", tileVariant: "magentaSubtle" },
			{ id: "a2-findings", title: "PAY-102 — what the spike found", source: "Confluence page", owner: "Maya Ferreira", iconName: "page", tileVariant: "blueSubtle" },
			{ id: "a2-callsites", title: "checkout-web: port the first 18 call sites", source: "GitHub · #1851 open", owner: "Jordan Okafor · one comment unanswered", logoName: "github" },
			{ id: "a2-review", title: "Review notes on #1851", source: "Agent review", owner: "Review Agent", avatarSrc: AVATAR.reviewAgent },
		],
		workItemKeys: ["PAY-102", "PAY-104", "PAY-105", "PAY-107", "PAY-109", "PAY-126"],
		looseWorkIds: ["lw-adapter-branch", "lw-spike-session", "lw-spike-compile-commit", "lw-loom-spike", "lw-spike-stub-pr", "lw-spike-webhook-session", "lw-spike-retry-pr"],
		attention: [
			{ id: "s2-sig-webhook", tone: "risk", memberId: "maya", timeLabel: "Mon 17 Aug 17:31", workItemKey: "PAY-107", title: "Nothing listens for the challenge webhook", detail: "v2 replaced challenge_pending with a webhook. payments-api has no handler, so every 3-D Secure payment stalls the moment the adapter is removed." },
			{ id: "s2-sig-review", tone: "attention", memberId: "review-agent", timeLabel: "Mon 17 Aug 16:20", workItemKey: "PAY-104", title: "Review Agent is waiting on an answer to its comment on #1851", detail: "One comment, unanswered since 16:20: the retry path on the ported call site still reaches back through the adapter. The agent will not approve until somebody replies." },
			{ id: "s2-sig-unlinked", tone: "attention", memberId: "maya", timeLabel: "Mon 17 Aug 17:42", workItemKey: "PAY-102", title: "The proof of the whole week is an unlinked branch", detail: "PR #1847 carries the spike result. The work item it proves says only “investigate”." },
		],
		nextActions: [
			{ id: "s2-act-link", label: "Link PR #1847 and the spike branch to PAY-102", rationale: "The evidence for the delete decision is currently an unlinked PR and an unlinked branch.", actionLabel: "Link evidence", workItemKey: "PAY-102" },
			{ id: "s2-act-handler", label: "Promote the challenge webhook handler to a blocker on PAY-107", rationale: "It gates every remaining 3-D Secure call site, not just the stub.", actionLabel: "Set blocker", workItemKey: "PAY-107" },
		],
		stats: [
			{ id: "s2-stat-lines", label: "Lines the delete removes", value: "4,180" },
			{ id: "s2-stat-ported", label: "Call sites ported", value: "18 / 61" },
			{ id: "s2-stat-review", label: "Median review turnaround", value: "4 min" },
			{ id: "s2-stat-uncaptured", label: "Uncaptured", value: "7" },
		],
		memberIds: ["maya", "review-agent", "venn"],
		contributions: S2_CONTRIBUTIONS,
	},
	{
		id: "s3-regression",
		timestamp: "2026-08-18T11:05:00Z",
		dateLabel: "Tue 18 Aug",
		timeLabel: "11:05",
		updatedAt: "2026-08-18T11:05:00Z",
		updatedDateLabel: "Tue 18 Aug",
		updatedTimeLabel: "11:05",
		chapterLabel: "Keys bouncing",
		rangeLabel: "Mon 17:55 – Tue 11:05",
		title: "Idempotency keys are bouncing in sandbox-eu",
		paragraphs: [
			"v2 scopes idempotency keys to the account and rejects anything over 64 characters, but the merchant-prefixed keys carried over from v1 are 73, and sandbox-eu truncates instead of erroring — which is why unit tests stayed green while 1,204 events piled up in Sentry. The fix is two lines; the risk is not, because a truncated key replayed against a live account can charge a customer twice, so PAY-112 is blocked and PAY-105 stalls until payments platform confirms the sandbox key retention window. PAY-107 now rejects over-length keys loudly rather than trimming them. Review Agent named the unbounded key length nineteen hours before the sandbox did, and the comment was resolved because local tests passed.",
		],
		artifacts: [
			{ id: "a3-sentry", title: "invalid_idempotency_scope — 1,204 events, sandbox-eu", source: "Sentry issue", owner: "payments-api", logoName: "sentry" },
			{ id: "a3-triage", title: "#payments-oncall — sandbox 401 triage", source: "Chat summary", owner: "Root cause at 10:52", iconName: "ai-chat", tileVariant: "purpleSubtle" },
			{ id: "a3-review", title: "“Key length not bounded, upstream limit unknown”", source: "Agent review · resolved by mistake", owner: "Review Agent", avatarSrc: AVATAR.reviewAgent },
			{ id: "a3-handover", title: "On-call handover, Tuesday 03:10", source: "Confluence page", owner: "Jordan Okafor", iconName: "page", tileVariant: "blueSubtle" },
		],
		workItemKeys: ["PAY-104", "PAY-105", "PAY-107", "PAY-112"],
		looseWorkIds: ["lw-sandbox-triage", "lw-regression-reject-pr", "lw-oncall-note", "lw-regression-replay-session", "lw-regression-sentry-pr", "lw-regression-boundary-commit", "lw-sandbox-chase-pr", "lw-sandbox-retention-commit"],
		attention: [
			{ id: "s3-sig-replay", tone: "risk", memberId: "jordan", timeLabel: "Tue 18 Aug 10:58", workItemKey: "PAY-112", title: "Truncated keys could be replayed against live accounts", detail: "Two distinct payments can collapse onto the same 64-character key. Nobody yet knows how long the platform retains them, so the blast radius is unknown." },
			{ id: "s3-sig-mention", tone: "attention", memberId: "priya", timeLabel: "Tue 18 Aug 11:02", workItemKey: "PAY-112", title: "Priya Raman mentioned you on PAY-112", detail: "“@you I need the retention window before I can sign this off — who owns that number?” Posted 11:02, two minutes before the root cause landed, and still unanswered." },
			{ id: "s3-sig-ignored", tone: "attention", memberId: "review-agent", timeLabel: "Tue 18 Aug 09:14", workItemKey: "PAY-104", title: "An agent review comment was resolved without an answer", detail: "Review Agent named this failure nineteen hours before the sandbox did. Green local tests were treated as the stronger signal." },
		],
		nextActions: [
			{ id: "s3-act-retention", label: "Chase payments platform on the sandbox key retention window", rationale: "PAY-112 and PAY-105 are both waiting on a single number.", actionLabel: "Escalate", workItemKey: "PAY-112" },
			{ id: "s3-act-sync", label: "Sync the local Claude session onto PAY-112", rationale: "The root cause has been known since 10:52. The work item still reads “investigating”.", actionLabel: "Sync summary", workItemKey: "PAY-112" },
			{ id: "s3-act-tests", label: "Have Test Author Agent add a key-length boundary case", rationale: "The suite passes at 73 characters today, which is the whole problem.", actionLabel: "Assign agent", workItemKey: "PAY-113" },
		],
		stats: [
			{ id: "s3-stat-events", label: "Sandbox errors", value: "1,204" },
			{ id: "s3-stat-blocked", label: "Items blocked", value: "2" },
			{ id: "s3-stat-ttd", label: "Time to root cause", value: "32 min" },
			{ id: "s3-stat-uncaptured", label: "Uncaptured", value: "8" },
		],
		memberIds: ["jordan", "priya", "review-agent", "venn"],
		contributions: S3_CONTRIBUTIONS,
	},
	{
		id: "s4-night-shift",
		timestamp: "2026-08-19T02:30:00Z",
		dateLabel: "Wed 19 Aug",
		timeLabel: "02:30",
		updatedAt: "2026-08-19T08:15:00Z",
		updatedDateLabel: "Wed 19 Aug",
		updatedTimeLabel: "08:15",
		chapterLabel: "Six merges",
		rangeLabel: "Tue 11:05 – Wed 02:30",
		title: "Six pull requests while everyone slept",
		paragraphs: [
			"Three agents merged six pull requests with nobody awake to ask: the 3-D Secure contract suite PAY-113 has been carrying since March, 214 assertions replayed against recorded fixtures rather than the failing sandbox, and a per-account kill switch on payments_sdk_v2_rollout. Nobody asked for the kill switch — Release Captain Agent read the truncation risk out of PAY-112 and decided the flag needed to be pullable for one merchant instead of all of them. None of the six merges are linked to a work item, so the board still shows PAY-113 in To do and PAY-107 unassigned while the work that unblocks the week sits on main. The gap opened in under four hours with nobody doing anything wrong.",
		],
		artifacts: [
			{ id: "a4-tests", title: "3-D Secure contract suite — 214 assertions", source: "GitHub · #1863 merged", owner: "Test Author Agent", logoName: "github" },
			{ id: "a4-prs", title: "Five more merges, 22:40 – 02:30", source: "GitHub · #1862, #1864 – #1867 merged", owner: "Review Agent approved four", logoName: "github" },
			{ id: "a4-killswitch", title: "Per-account kill switch on payments_sdk_v2_rollout", source: "LaunchDarkly change", owner: "Release Captain Agent", logoName: "launchdarkly" },
			{ id: "a4-rejects", title: "Two pull requests returned, with reasons", source: "Agent review", owner: "Review Agent", avatarSrc: AVATAR.reviewAgent },
			{ id: "a4-recap", title: "Night-shift recap for the morning", source: "Agent summary", owner: "Release Captain Agent", avatarSrc: AVATAR.releaseAgent },
		],
		workItemKeys: ["PAY-105", "PAY-107", "PAY-109", "PAY-113", "PAY-121"],
		looseWorkIds: ["lw-night-suite-session", "lw-night-prs", "lw-night-harness-commit", "lw-night-killswitch-session", "lw-night-reject-pr", "lw-flag-edits", "lw-night-link-session", "lw-night-link-pr"],
		attention: [
			{ id: "s4-sig-unlinked", tone: "attention", memberId: "test-agent", timeLabel: "Wed 19 Aug 02:12", workItemKey: "PAY-113", title: "Six merges, zero linked work items", detail: "The board says nothing moved overnight. Main says the contract suite landed and the kill switch exists." },
			{ id: "s4-sig-review", tone: "attention", memberId: "review-agent", timeLabel: "Wed 19 Aug 01:20", workItemKey: "PAY-105", title: "Review Agent is holding two pull requests for a human call", detail: "Both were returned with reasons at 01:20 and neither author is awake. The 3-D Secure port cannot land until somebody answers one of them." },
			{ id: "s4-sig-flag", tone: "risk", memberId: "release-agent", timeLabel: "Wed 19 Aug 01:14", workItemKey: "PAY-121", title: "Flag rules changed with no change record", detail: "Three targeting rules were edited directly in LaunchDarkly at 01:14. The rollout item does not reflect them, so the plan on the page and the plan in production have already diverged." },
		],
		nextActions: [
			{ id: "s4-act-bulk", label: "Bulk-link #1862 – #1867 to PAY-105 and PAY-113", rationale: "Six merges are invisible on the board. Two work items are wrong as a result.", actionLabel: "Link pull requests", workItemKey: "PAY-113" },
			{ id: "s4-act-flagdiff", label: "Attach the LaunchDarkly rule diff to PAY-121", rationale: "The kill switch is real. The only record of how it is configured is in the vendor's audit log.", actionLabel: "Attach diff", workItemKey: "PAY-121" },
			{ id: "s4-act-close", label: "Move PAY-113 to done", rationale: "The suite is merged, reviewed and green. It has been in To do for five months.", actionLabel: "Move to done", workItemKey: "PAY-113" },
		],
		stats: [
			{ id: "s4-stat-prs", label: "Pull requests merged", value: "6" },
			{ id: "s4-stat-tests", label: "Assertions added", value: "214" },
			{ id: "s4-stat-hours", label: "Human hours", value: "0" },
			{ id: "s4-stat-window", label: "Window", value: "3h 50m" },
		],
		memberIds: ["review-agent", "test-agent", "release-agent", "venn"],
		contributions: S4_CONTRIBUTIONS,
	},
	{
		id: "s5-design-review",
		timestamp: "2026-08-19T15:20:00Z",
		dateLabel: "Wed 19 Aug",
		timeLabel: "15:20",
		updatedAt: "2026-08-19T16:48:00Z",
		updatedDateLabel: "Wed 19 Aug",
		updatedTimeLabel: "16:48",
		chapterLabel: "Wallet cut",
		rangeLabel: "Wed 02:30 – Wed 15:20",
		title: "We cut the wallet UI",
		paragraphs: [
			"The v2 payment-method object does not carry the card artwork metadata the design depends on, so a saved-card wallet costs a second round trip — 180 to 240 ms added to a checkout screen the team spent a quarter making faster. PAY-118 moves to the next epic with the artwork requirement attached rather than shipping a slower version of something customers already like. What survives is the copy: eleven v2 decline reasons mapped to language that tells the customer what to do next, signed off by legal, and still sitting in a Google Doc with no work item and no localisation ticket for nine languages. Three of the eleven codes have no fixture that exercises them.",
		],
		artifacts: [
			{ id: "a5-figma", title: "Wallet — saved payment methods, v2", source: "Figma file · frames parked", owner: "Diego Santos", logoName: "figma" },
			{ id: "a5-copy", title: "Eleven decline reasons, customer-facing copy", source: "Google Doc · approved by legal", owner: "Diego Santos", logoName: "google-docs" },
			{ id: "a5-latency", title: "Saved-card round trip on staging fixtures", source: "Confluence page", owner: "Maya Ferreira", iconName: "page", tileVariant: "blueSubtle" },
			{ id: "a5-review-notes", title: "#design-review — why the wallet is out", source: "Chat summary", owner: "Priya Raman", iconName: "ai-chat", tileVariant: "purpleSubtle" },
		],
		workItemKeys: ["PAY-115", "PAY-118", "PAY-123", "PAY-130"],
		looseWorkIds: ["lw-figma-parked", "lw-wallet-latency-pr", "lw-copy-doc", "lw-wallet-ship-session", "lw-wallet-taxonomy-pr", "lw-wallet-cut-commit", "lw-wallet-ship-pr"],
		attention: [
			{ id: "s5-sig-cut", tone: "decision", memberId: "diego", timeLabel: "Wed 19 Aug 14:41", workItemKey: "PAY-118", title: "Wallet UI cut on a 180–240 ms round-trip cost", detail: "Deferred to the next epic with the card-artwork requirement attached. The reasoning is in a local Claude session, not on the item." },
			{ id: "s5-sig-mention", tone: "attention", memberId: "priya", timeLabel: "Wed 19 Aug 14:58", workItemKey: "PAY-115", title: "Priya Raman mentioned you on PAY-115", detail: "“@you the wallet cut changes the ship note — can you rewrite the customer-facing line before Friday?” Posted 14:58, right after the review ended." },
			{ id: "s5-sig-fixtures", tone: "attention", memberId: "test-agent", timeLabel: "Wed 19 Aug 13:26", workItemKey: "PAY-123", title: "Test Author Agent stopped: three decline codes have no fixture to record", detail: "expired_card_network, issuer_unavailable and risk_hold were never exercised in v1 either. The agent will not invent responses it has not seen." },
			{ id: "s5-sig-copy", tone: "attention", memberId: "diego", timeLabel: "Wed 19 Aug 15:05", workItemKey: "PAY-130", title: "Approved copy with no localisation item", detail: "Eleven strings, nine languages, a five-day queue, and it is Wednesday. No work item exists yet." },
		],
		nextActions: [
			{ id: "s5-act-record", label: "Record the wallet cut on PAY-118", rationale: "A cut without a written reason gets re-litigated in the next planning session.", actionLabel: "Record decision", workItemKey: "PAY-118" },
			{ id: "s5-act-l10n", label: "Open the localisation item and attach the approved doc", rationale: "The queue is five working days. Starting Thursday means the strings land after the ship date.", actionLabel: "Create item", workItemKey: "PAY-130" },
			{ id: "s5-act-fixtures", label: "Ask Test Author Agent to record the three missing decline fixtures", rationale: "expired_card_network, issuer_unavailable and risk_hold are untested in both v1 and v2.", actionLabel: "Assign agent", workItemKey: "PAY-123" },
		],
		stats: [
			{ id: "s5-stat-cut", label: "Items cut", value: "1" },
			{ id: "s5-stat-latency", label: "Round-trip cost avoided", value: "180–240 ms" },
			{ id: "s5-stat-strings", label: "Decline strings approved", value: "11" },
			{ id: "s5-stat-uncaptured", label: "Uncaptured", value: "7" },
		],
		memberIds: ["diego", "priya", "test-agent", "venn"],
		contributions: S5_CONTRIBUTIONS,
	},
	{
		id: "s6-rehearsal",
		timestamp: "2026-08-20T09:45:00Z",
		dateLabel: "Thu 20 Aug",
		timeLabel: "09:45",
		updatedAt: "2026-08-20T09:45:00Z",
		updatedDateLabel: "Thu 20 Aug",
		updatedTimeLabel: "09:45",
		chapterLabel: "Rollback proven",
		rangeLabel: "Wed 15:20 – Thu 09:45",
		title: "The rollback took four minutes",
		paragraphs: [
			"Rollback is proven rather than assumed: 200 synthetic payments through the v2 path, the flag pulled mid-flight, a clean ledger in four minutes eleven seconds, and both in-flight 3-D Secure challenges completing on v1. The rehearsal also surfaced the one failure paper would have missed — ledger-sync stamps the SDK version at intent time, so a rollback leaves rows marked v2 against payments that settled on v1, which is harmless for reconciliation and poisonous for a finance export that groups by that field. Writing the version at settlement time instead is an 88-line fix, now PAY-128. The procedure you would actually need at three in the morning is spread across a draft run log, a vendor console and a branch nobody linked.",
		],
		artifacts: [
			{ id: "a6-rehearsal", title: "Rollback rehearsal — run log", source: "Confluence page · draft", owner: "Priya Raman", iconName: "page", tileVariant: "blueSubtle" },
			{ id: "a6-flag", title: "payments_sdk_v2_rollout targeting rules", source: "LaunchDarkly change", owner: "Release Captain Agent", logoName: "launchdarkly" },
			{ id: "a6-loom", title: "How to flip the kill switch at 3am", source: "Loom recording · 6 min", owner: "Maya Ferreira", iconName: "video", tileVariant: "magentaSubtle" },
			{ id: "a6-ledger", title: "ledger-sync: stamp SDK version at settlement", source: "GitHub · #1881 open", owner: "Release Captain Agent · 88 lines", logoName: "github" },
			{ id: "a6-plan", title: "Rollout plan, third revision", source: "Agent summary", owner: "Release Captain Agent", avatarSrc: AVATAR.releaseAgent },
		],
		workItemKeys: ["PAY-115", "PAY-119", "PAY-121", "PAY-126", "PAY-128"],
		looseWorkIds: ["lw-rehearsal-draft", "lw-rehearsal-harness-pr", "lw-rehearsal-numbers-commit", "lw-rehearsal-pager-session", "lw-rehearsal-export-pr", "lw-killswitch-loom", "lw-rehearsal-runbook-pr"],
		attention: [
			{ id: "s6-sig-ledger", tone: "risk", memberId: "release-agent", timeLabel: "Thu 20 Aug 09:22", workItemKey: "PAY-128", title: "Rollback poisons the finance export", detail: "Settlement rows keep a v2 stamp after a rollback. The export groups by that field and would misreport the week without anyone noticing." },
			{ id: "s6-sig-mention", tone: "attention", memberId: "jordan", timeLabel: "Thu 20 Aug 09:41", workItemKey: "PAY-121", title: "Jordan Okafor mentioned you on PAY-121", detail: "“@you if I am on call Monday I need the kill-switch runbook branch somewhere I can find at 3am, not in a worktree.” Posted 09:41, six minutes after the rehearsal ended." },
			{ id: "s6-sig-plan", tone: "attention", memberId: "priya", timeLabel: "Thu 20 Aug 09:38", workItemKey: "PAY-119", title: "The rollout plan exists in three unlinked places", detail: "A draft page, a vendor console and a runbook branch. None of them is reachable from the epic at three in the morning." },
			{ id: "s6-sig-rehearsal", tone: "shipped", memberId: "maya", timeLabel: "Thu 20 Aug 09:35", workItemKey: "PAY-119", title: "Rollback verified end to end", detail: "200 synthetic payments, clean ledger in 4m 11s, both in-flight challenges completed on v1." },
		],
		nextActions: [
			{ id: "s6-act-publish", label: "Publish the run log and link it to PAY-119", rationale: "It is the only written evidence the rollback works, and it is a draft.", actionLabel: "Publish page", workItemKey: "PAY-119" },
			{ id: "s6-act-ledger", label: "Merge PAY-128 before the flag goes above zero percent", rationale: "88 lines now, or a corrupted finance export and a manual reconciliation later.", actionLabel: "Prioritise", workItemKey: "PAY-128" },
		],
		stats: [
			{ id: "s6-stat-rollback", label: "Rollback to clean ledger", value: "4m 11s" },
			{ id: "s6-stat-payments", label: "Synthetic payments", value: "200" },
			{ id: "s6-stat-inflight", label: "In-flight challenges recovered", value: "2 / 2" },
			{ id: "s6-stat-uncaptured", label: "Uncaptured", value: "7" },
		],
		memberIds: ["priya", "maya", "release-agent", "jordan", "venn"],
		contributions: S6_CONTRIBUTIONS,
	},
	{
		id: "s7-ship-readiness",
		timestamp: "2026-08-21T17:30:00Z",
		dateLabel: "Fri 21 Aug",
		timeLabel: "17:30",
		updatedAt: "2026-08-21T18:05:00Z",
		updatedDateLabel: "Fri 21 Aug",
		updatedTimeLabel: "18:05",
		chapterLabel: "Two blockers",
		rangeLabel: "Thu 09:45 – Fri 17:30",
		title: "Two blockers between here and Monday",
		paragraphs: [
			"The migration itself is done: all 61 call sites ported, LegacyGatewayAdapter deleted, 4,180 lines gone, retry living in payments-api where it can be reasoned about, and a flag with per-account targeting and an armed kill switch. Two things stand between here and Monday — PAY-112 waits on the sandbox key retention window before anyone signs off on replaying keys against live accounts, and PAY-130's eleven decline strings entered a five working day localisation queue on a Friday afternoon. Neither blocks the first slice, which is one percent of traffic on a single English-only account, so Monday is possible and Wednesday is likely; the targeting rule is written and deliberately unapproved. The strongest argument for moving faster, v2 running 42 ms quicker at p95, exists only as an unlinked commit.",
		],
		artifacts: [
			{ id: "a7-adapter", title: "Delete LegacyGatewayAdapter", source: "GitHub · #1847 merged", owner: "Maya Ferreira · −4,180 lines", logoName: "github" },
			{ id: "a7-readiness", title: "Ship readiness checklist", source: "Confluence page", owner: "Priya Raman", iconName: "page", tileVariant: "blueSubtle" },
			{ id: "a7-p95", title: "v2 latency comparison, staging", source: "Chat summary · never filed", owner: "Maya Ferreira", iconName: "ai-chat", tileVariant: "purpleSubtle" },
			{ id: "a7-targeting", title: "One percent, one account, English only", source: "LaunchDarkly change · unapproved", owner: "Release Captain Agent", logoName: "launchdarkly" },
			{ id: "a7-l10n", title: "Decline strings handed to localisation", source: "Google Doc", owner: "Diego Santos", logoName: "google-docs" },
		],
		workItemKeys: ["PAY-105", "PAY-107", "PAY-112", "PAY-121", "PAY-123", "PAY-126", "PAY-128", "PAY-130"],
		looseWorkIds: ["lw-ship-p95-session", "lw-ship-targeting-pr", "lw-p95-screenshot", "lw-ship-approval-session", "lw-ship-exports-pr", "lw-copy-doc", "lw-ship-english-session", "lw-ship-retention-pr"],
		attention: [
			{ id: "s7-sig-keys", tone: "risk", memberId: "jordan", timeLabel: "Fri 21 Aug 16:47", workItemKey: "PAY-112", title: "Still waiting on the sandbox key retention window", detail: "Four days open with payments platform. Without the number, replaying keys against live accounts stays unsigned and the rollout stays at zero." },
			{ id: "s7-sig-approval", tone: "attention", memberId: "release-agent", timeLabel: "Fri 21 Aug 17:12", workItemKey: "PAY-121", title: "Release Captain Agent is holding the rollout for a human approval", detail: "The one percent, one account, English-only rule is written and staged. The agent deliberately will not arm it — that press belongs to a person." },
			{ id: "s7-sig-l10n", tone: "attention", memberId: "diego", timeLabel: "Fri 21 Aug 15:04", workItemKey: "PAY-130", title: "Localisation started on a Friday", detail: "Eleven strings, nine languages, five working days. The English-only first slice is the only path that does not wait for them." },
			{ id: "s7-sig-shipped", tone: "shipped", memberId: "maya", timeLabel: "Fri 21 Aug 11:26", workItemKey: "PAY-126", title: "LegacyGatewayAdapter is gone", detail: "4,180 lines removed, all 61 call sites accounted for, two dead exports flagged for follow-up." },
		],
		nextActions: [
			{ id: "s7-act-approve", label: "Approve the one percent English-only targeting rule", rationale: "It unblocks Monday without waiting on translations, and it is already written and staged.", actionLabel: "Approve rule", workItemKey: "PAY-121" },
			{ id: "s7-act-escalate", label: "Escalate PAY-112 to the payments platform on-call", rationale: "Four days on a single number. The polite channel has not worked.", actionLabel: "Page on-call", workItemKey: "PAY-112" },
			{ id: "s7-act-p95", label: "File the p95 comparison against PAY-126", rationale: "A 42 ms improvement is the strongest argument for moving faster and it is invisible to everyone outside an unlinked commit.", actionLabel: "Attach result", workItemKey: "PAY-126" },
		],
		stats: [
			{ id: "s7-stat-ported", label: "Call sites ported", value: "61 / 61" },
			{ id: "s7-stat-removed", label: "Lines removed", value: "4,180" },
			{ id: "s7-stat-blockers", label: "Blockers left", value: "2" },
			{ id: "s7-stat-p95", label: "p95 vs v1", value: "−42 ms" },
		],
		memberIds: ["maya", "jordan", "diego", "release-agent", "venn"],
		contributions: S7_CONTRIBUTIONS,
	},
];

/**
 * The epic line. It is page-level context rather than snapshot context, so it
 * is rendered once beside the Board | Pulse tabs and never again above the
 * display headline — two stacked all-caps eyebrows read as one blurry block,
 * and the outer one never changes.
 */
export const PULSE_PROJECT_LABEL = "PAY · Payments SDK v2 migration";

export const PULSE_TIMELINE: PulseTimeline = {
	projectLabel: PULSE_PROJECT_LABEL,
	members: MEMBERS,
	workItems: WORK_ITEMS,
	looseWork: PULSE_LOOSE_WORK,
	snapshots: SNAPSHOTS,
};
