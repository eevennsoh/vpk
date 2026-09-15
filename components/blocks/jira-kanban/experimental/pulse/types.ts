import type { ArtifactListItem } from "@/components/ui-custom/artifact-list";
import type { JiraKanbanCardTag, JiraKanbanPriority } from "../../index";

/**
 * Pulse — the experimental Kanban's timeline mode.
 *
 * One place for whoever is leading a team of humans *and* agents to see
 * everything the team produced: the work captured in work items, and the work
 * that never made it into one. Scrubbing the timeline moves between snapshots
 * — the decision points of a delivery — so the reader can reconstruct what
 * happened, what needs attention, and what to do next without a stand-up.
 *
 * These types are the contract every Pulse component codes against. Treat them
 * as frozen: components render them, `data/` supplies them.
 */

export type PulseMemberKind = "human" | "agent";

export interface PulseMember {
	id: string;
	/** Display name, e.g. "Maya Ferreira" or "Codex". */
	name: string;
	/** Short role line, e.g. "Staff engineer" / "Reviews every PR". */
	role: string;
	kind: PulseMemberKind;
	/** Human avatars use `/avatar/*`; agents use `/avatar-agent/*`. */
	avatarSrc: string;
	/** City label used by the async story, e.g. "Sydney". Agents omit it. */
	timezone?: string;
}

/** A work item the team touched inside the snapshot window. */
export interface PulseWorkItem {
	/** Jira key, e.g. "PAY-118". */
	key: string;
	summary: string;
	tags: readonly JiraKanbanCardTag[];
	priority: JiraKanbanPriority;
	/** Board column the item sat in at this point in time. */
	status: string;
	/** Everyone — human or agent — who moved this item. */
	memberIds: readonly string[];
	/** Roster id of the current assignee — look up `kind` for avatar shape. */
	assigneeId?: string;
	assigneeAvatarSrc?: string;
	assigneeName?: string;
}

/**
 * Uncaptured work in this space is only GitHub (PRs, branches, commits on the
 * configured repo) or a local coding session that refers to this space.
 */
export type PulseLooseWorkKind = "pull-request" | "branch" | "commit" | "agent-session";

export type PulseLooseWorkSource = "GitHub" | "Claude";

/** Coding agent on a local Pulse session. Mapped onto the shared row identity. */
export type PulseCodingAgentId = "claude" | "codex" | "copilot" | "cursor";

/** Lifecycle states supported by an untracked local coding session. */
export type PulseAgentSessionState = "running" | "needs-input" | "complete";

/** Flyout fields for a `pull-request` card — feeds `toPullRequestSmartLink`. */
export interface PulseLooseWorkPullRequest {
	number: number;
	status: "Open" | "Merged";
	files: number;
	additions: number;
	deletions: number;
	branch?: string;
}

/**
 * Pull request linked to a local coding session.
 *
 * The session row only shows `#number: title`, but the session flyout lists the
 * PR as a Smart Link whose hover card renders the whole diff context. Those
 * fields are required rather than optional so a new session fixture cannot ship
 * a chip that expands into a near-empty card — the same contract the sibling
 * `pull-request` loose-work kind already holds.
 */
export interface PulseAgentSessionPullRequest {
	number: number;
	status: "created" | "merged" | "failed";
	title: string;
	files: number;
	additions: number;
	deletions: number;
	/** Source branch, e.g. `pay-121-account-targeting-kill-switch`. */
	branch: string;
	/** PR body summary shown on the Smart Link hover card. */
	description: string;
	/** Owner/name path. Defaults to `PULSE_SPACE_REPOSITORY` when omitted. */
	repository?: string;
}

interface PulseLooseWorkBase {
	id: string;
	title: string;
	/**
	 * Compact destination label shown in the hoverable Smart Link trigger.
	 * Sessions use the issue key (`PAY-121`); GitHub uses `PR #1847`, a SHA, or a branch name.
	 */
	sourceTitle: string;
	/** Supporting line, e.g. "PR #1847 · no linked work item". */
	detail: string;
	memberIds: readonly string[];
}

/**
 * Work the team produced that never landed in a work item: an unlinked PR,
 * branch, or commit, or a local coding session. GitHub artifacts render as
 * uncaptured-work cards; sessions render through the shared agent list's
 * uncaptured variant.
 */
export type PulseLooseWork =
	| (PulseLooseWorkBase & {
			kind: "pull-request";
			pullRequest: PulseLooseWorkPullRequest;
	  })
	| (PulseLooseWorkBase & { kind: "branch" | "commit" })
	| (PulseLooseWorkBase & {
			kind: "agent-session";
			host: "local";
			/** Coding agent that ran the session. */
			agentId: PulseCodingAgentId;
			/**
			 * Agent-authored session name for the compact session row — the short
			 * label a coding agent derives from its opening prompt. `title` stays
			 * the two-line narrative the large uncaptured card needs.
			 */
			shortTitle: string;
			/** Viewer machine shown on the local-session metadata chip. */
			machineName: string;
			/** Static stamp. Local rows must not tick. */
			timeLabel: string;
			/** Current lifecycle; omitted legacy fixtures remain completed. */
			state?: PulseAgentSessionState;
			/** Linked PR replaces the row timestamp when present. */
			pullRequest?: PulseAgentSessionPullRequest;
			/** Authoritative Jira status when this session comes from a live board owner. */
			issueStatus?: string;
	  });

export type PulseAgentSession = Extract<PulseLooseWork, { kind: "agent-session" }>;

export type PulseGithubLooseWork = Exclude<PulseLooseWork, { kind: "agent-session" }>;

export function isPulseGithubLooseWork(item: PulseLooseWork): item is PulseGithubLooseWork {
	return item.kind !== "agent-session";
}

export function isPulseAgentSession(
	item: PulseLooseWork,
): item is Extract<PulseLooseWork, { kind: "agent-session" }> {
	return item.kind === "agent-session";
}

/**
 * Card source brand. GitHub stays an inline `GitHub · PR #1847` row.
 * Coding sessions brand as Claude and render in the agent-list uncaptured card.
 */
export function pulseLooseWorkSource(kind: PulseLooseWorkKind): PulseLooseWorkSource {
	switch (kind) {
		case "pull-request":
		case "branch":
		case "commit":
			return "GitHub";
		case "agent-session":
			return "Claude";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

/** Only GitHub artifacts can become a Jira work item from this card. */
export function pulseLooseWorkCanCreateWorkItem(kind: PulseLooseWorkKind): boolean {
	switch (kind) {
		case "pull-request":
		case "branch":
		case "commit":
			return true;
		case "agent-session":
			return false;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

export function pulseLooseWorkHostLabel(host: "local"): string {
	switch (host) {
		case "local":
			return "Local";
		default: {
			const _exhaustive: never = host;
			return _exhaustive;
		}
	}
}

export type PulseSignalTone = "attention" | "risk" | "decision" | "shipped";

/**
 * Something the reader must know about right now.
 *
 * Every signal is attributed: an agent that has stopped and is waiting on a
 * human, or a teammate who commented or @mentioned the reader. `memberId` is
 * the roster identity behind the row, and must name a member the snapshot lists
 * as active — a signal from somebody who was not in the window is not something
 * the window can show.
 */
export interface PulseSignal {
	id: string;
	tone: PulseSignalTone;
	/** Roster member the signal comes from — drives the attention row's identity. */
	memberId: string;
	/**
	 * When this actually happened, pre-formatted like every other clock in the
	 * fixture, e.g. `"Mon 17 Aug 08:06"`. Per signal rather than per window: a
	 * comment posted at 08:06 must not be stamped with the 08:12 boundary of the
	 * window that contains it. Must fall inside the snapshot's `rangeLabel`, and
	 * must agree with any time the `detail` quotes.
	 */
	timeLabel: string;
	title: string;
	detail: string;
	workItemKey?: string;
}

/** A next best action the reader can take without leaving Jira. */
export interface PulseAction {
	id: string;
	label: string;
	/** Why Pulse is suggesting it. */
	rationale: string;
	/** Button copy, e.g. "Assign agent". */
	actionLabel: string;
	workItemKey?: string;
}

/** A headline number for the snapshot window, e.g. "6 PRs merged". */
export interface PulseStat {
	id: string;
	label: string;
	value: string;
}

/** Per-member scoping: what this one person or agent did in this snapshot. */
export interface PulseContribution {
	memberId: string;
	/**
	 * Display headline when this member is the filter. Keep it a sentence a
	 * human would actually say — never the member's name. Omit it to reuse the
	 * team's insight title.
	 */
	title?: string;
	/** One or two sentences, written in the same voice as the snapshot prose. */
	summary: string;
	workItemKeys: readonly string[];
	artifactIds: readonly string[];
	looseWorkIds: readonly string[];
}

/** One captured outcome on the article — an insight, not a time-window. */
export interface PulseSnapshot {
	id: string;
	/**
	 * ISO time this outcome was first generated. Orders the article. The ruler
	 * ignores it and steps insights evenly: spacing counts outcomes, not elapsed
	 * time.
	 */
	timestamp: string;
	/** Generated date, e.g. "Wed 13 Aug". */
	dateLabel: string;
	/** Generated clock, e.g. "02:30". */
	timeLabel: string;
	/** ISO time this insight was last revised. May equal `timestamp`. */
	updatedAt: string;
	/** Last-updated date, same shape as `dateLabel`. */
	updatedDateLabel: string;
	/** Last-updated clock, same shape as `timeLabel`. */
	updatedTimeLabel: string;
	/** Terse outcome name for the story microheader and ruler, e.g. "Wallet cut". */
	chapterLabel: string;
	/**
	 * Window a quiet-member note still names, e.g. "Tue 18:00 – Wed 06:00".
	 * Not painted on the eyebrow: the header clock is last updated.
	 */
	rangeLabel: string;
	/** Display headline. Keep it a sentence a human would actually say. */
	title: string;
	/** Narrative body. One paragraph, plain prose, no bullet lists. */
	paragraphs: readonly string[];
	artifacts: readonly ArtifactListItem[];
	workItemKeys: readonly string[];
	looseWorkIds: readonly string[];
	attention: readonly PulseSignal[];
	nextActions: readonly PulseAction[];
	stats: readonly PulseStat[];
	/** Members active in this window — drives roster availability. */
	memberIds: readonly string[];
	contributions: readonly PulseContribution[];
}

/* ------------------------------------------------------------------ */
/* Scope — the epic or sprint the reader has narrowed the article to.   */
/* ------------------------------------------------------------------ */

export type PulseScopeKind = "epic" | "sprint";

/** What the board header's Filter writes. `null` is the whole timeline. */
export interface PulseScopeSelection {
	kind: PulseScopeKind;
	id: string;
}

/**
 * The three states any body of work is in. Named by role rather than by board
 * column so an epic's roll-up and a sprint's commitment read on one scale.
 */
export type PulseProgressTone = "done" | "progress" | "todo";

/** One band of a progress bar, authored as a count. Percentages are derived. */
export interface PulseProgressSegment {
	tone: PulseProgressTone;
	/** Reading label, e.g. "Done" / "In progress" / "Not started". */
	label: string;
	count: number;
}

/** A row in the epic's child list — its own name, key and progress bar. */
export interface PulseEpicChild {
	id: string;
	/** Jira key rendered as the row's link text, e.g. "PAY-104". */
	key: string;
	name: string;
	segments: readonly PulseProgressSegment[];
}

/** One point on the sprint burndown. `remaining: null` is the future. */
export interface PulseBurndownPoint {
	/** Axis label; only the first and last are painted. */
	label: string;
	/** Points still open at the close of this day, or null once past today. */
	remaining: number | null;
}

export type PulseScopeChangeTone = "added" | "removed" | "modified";

/** One column of the sprint's scope-change read-out. */
export interface PulseScopeChangeEntry {
	id: string;
	label: string;
	/** Signed, so the renderer never re-derives the direction. */
	points: number;
	workItems: number;
	tone: PulseScopeChangeTone;
}

interface PulseScopeBase {
	id: string;
	/** Eyebrow key, e.g. "PAY-90" / "Sprint 24". */
	key: string;
	/** Display headline. */
	name: string;
	/** One prose line under the headline — the goal, in a human's words. */
	goal: string;
	/** Work items this scope owns. Drives the article's own narrowing. */
	workItemKeys: readonly string[];
	/** The roll-up bar. */
	segments: readonly PulseProgressSegment[];
}

export interface PulseEpicScope extends PulseScopeBase {
	kind: "epic";
	/** Pre-formatted, e.g. "12 Sep 2026" — never formatted at render time. */
	targetDate: string;
	/** Quiet clause beside the date, e.g. "three weeks out". */
	targetNote: string;
	children: readonly PulseEpicChild[];
}

export interface PulseSprintScope extends PulseScopeBase {
	kind: "sprint";
	/** Pre-formatted window, e.g. "18 Aug – 2 Sep". */
	rangeLabel: string;
	daysRemaining: number;
	/**
	 * Three point totals that are easy to conflate and must not be.
	 *
	 * `committedPoints` is what the sprint opened with — it is the guideline's
	 * origin and nothing else. `scopePoints` is what the sprint holds *now*,
	 * after everything that came in and went out. `donePoints` is what has
	 * burned down.
	 *
	 * The invariant is `donePoints + last closed remaining === scopePoints`.
	 * Reading the sentence off `committedPoints` instead is how a brief ends up
	 * printing "30 of 84 points done, 71 to go" — three true numbers that add
	 * up to a lie, and the first thing a lead notices.
	 */
	committedPoints: number;
	scopePoints: number;
	donePoints: number;
	burndown: readonly PulseBurndownPoint[];
	/** Net signed points the sprint has gained or shed since it opened. */
	scopeChangeNetPoints: number;
	scopeChange: readonly PulseScopeChangeEntry[];
}

export type PulseScope = PulseEpicScope | PulseSprintScope;

/** A question the reader asked the article, and what it answered. */
export interface PulseAnswer {
	id: string;
	question: string;
	answer: string;
}

export interface PulseTimeline {
	/** Epic line, e.g. "PAY · Payments SDK v2 migration". */
	projectLabel: string;
	members: readonly PulseMember[];
	workItems: readonly PulseWorkItem[];
	looseWork: readonly PulseLooseWork[];
	/** Chronological, oldest first. */
	snapshots: readonly PulseSnapshot[];
}

/* ------------------------------------------------------------------ */
/* Component contracts — implemented by `components/*`, composed by     */
/* `experimental-pulse.tsx`. Do not widen without updating every owner. */
/* ------------------------------------------------------------------ */

export interface PulseScrubberProps {
	snapshots: readonly PulseSnapshot[];
	activeIndex: number;
	onActiveIndexChange: (index: number) => void;
	/** Indexes where the filtered member was active; others render muted. */
	highlightedIndexes: ReadonlySet<number>;
	/** Set while a member filter is on — changes tick emphasis only. */
	isFiltered: boolean;
}

export interface PulseStoryProps {
	snapshot: PulseSnapshot;
	index: number;
	total: number;
	onPrevious: () => void;
	onNext: () => void;
	/** Present only while a member filter is on. */
	member: PulseMember | null;
	contribution: PulseContribution | null;
	/** Already filtered by the shell — render as given. */
	artifacts: readonly ArtifactListItem[];
	attention: readonly PulseSignal[];
	nextActions: readonly PulseAction[];
}

export interface PulseRailProps {
	members: readonly PulseMember[];
	/** Members active in the current snapshot; others render disabled. */
	activeMemberIds: ReadonlySet<string>;
	selectedMemberId: string | null;
	onSelectedMemberIdChange: (memberId: string | null) => void;
	stats: readonly PulseStat[];
	/** Already filtered by the shell — render as given. */
	workItems: readonly PulseWorkItem[];
	looseWork: readonly PulseLooseWork[];
}
