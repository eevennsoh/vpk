import type { AgentListAgent, AgentListSessionDetails } from "@/components/blocks/agent-list";
import type { AgentSessionItem } from "@/components/blocks/agent-session";

import {
	PULSE_SPACE_REPOSITORY,
	PULSE_VIEWER_MACHINE_NAME,
} from "../data/pulse-loose-work";
import {
	isPulseAgentSession,
	type PulseAgentSessionPullRequest,
	type PulseCodingAgentId,
	type PulseLooseWork,
	type PulseMember,
	type PulseWorkItem,
} from "../types";

/**
 * Boundary between a Pulse local coding session and the shared Agent Session card.
 *
 * Uncaptured GitHub work stays a dashed card with a Link to work item chin. A
 * coding session uses the same card chrome through the Agent Session block:
 * the shared row (identity, static stamp, viewer machine) sits on the dashed
 * surface, and the issue key becomes the untracked-work flyout suggestion. The
 * worktree stays on the flyout payload. Machine name, stamp, and agent identity
 * are authored on the fixture and passed through here so a 16-session column
 * does not look copy-pasted.
 */

const WORKTREE_PATTERN = /worktree (\S+)/u;

/**
 * Whether a row is a local session running on the viewer's own device.
 *
 * A local session can only be picked back up from the machine it is running
 * on, so this — not a hand-listed set of session ids — is the default gate on
 * the Resume affordance. Hosts that want a narrower rule (a scripted demo
 * resuming exactly one row) pass their own predicate instead.
 */
export function isPulseLooseWorkOnViewerMachine(item: PulseLooseWork): boolean {
	return isPulseAgentSession(item) && item.machineName === PULSE_VIEWER_MACHINE_NAME;
}

/**
 * Row identity for a Pulse coding agent. Claude, Codex, Copilot, and Cursor use
 * third-party brand marks already in the logo catalog. Directory profiles are
 * not imported here so this mapper stays a test-harness leaf.
 */
export function toPulseSessionAgent(agentId: PulseCodingAgentId): AgentListAgent {
	switch (agentId) {
		case "claude":
			return {
				brandName: "claude",
				id: "claude",
				kind: "agent",
				name: "Claude",
			};
		case "codex":
			return {
				brandName: "openai-codex",
				id: "codex",
				kind: "agent",
				name: "Codex",
			};
		case "copilot":
			return {
				brandName: "github-copilot",
				id: "github-copilot",
				kind: "agent",
				name: "GitHub Copilot",
			};
		case "cursor":
			return {
				brandName: "cursor",
				id: "cursor",
				kind: "agent",
				name: "Cursor",
			};
		default: {
			const _exhaustive: never = agentId;
			return _exhaustive;
		}
	}
}

/** Worktree path from a session detail line, when the fixture named one. */
export function toPulseSessionWorktree(detail: string): string | undefined {
	return WORKTREE_PATTERN.exec(detail)?.[1];
}

/**
 * Session pull request → the flyout fields the pull-request Smart Link renders.
 *
 * The repository is the space's own repo unless the fixture names another, and
 * every PR merges into `main` — the same two defaults the uncaptured GitHub
 * cards use, so a PR reads identically whether it arrives as loose work or as a
 * session artifact. The URL is built from the resolved repository rather than
 * the constant, so an overridden repo cannot link to a repo it does not name.
 */
export function toPulseSessionPullRequestDetails(
	pullRequest: PulseAgentSessionPullRequest,
): AgentListSessionDetails {
	const repository = pullRequest.repository ?? PULSE_SPACE_REPOSITORY;
	const reviewerCount = pullRequest.status === "merged" ? 3 : 2;
	const updatedLabel = pullRequest.status === "merged"
		? "5h ago"
		: pullRequest.status === "failed"
			? "2h ago"
			: "1h ago";

	return {
		additions: pullRequest.additions,
		branch: pullRequest.branch,
		deletions: pullRequest.deletions,
		files: pullRequest.files,
		pullRequestDescription: pullRequest.description,
		pullRequestNumber: pullRequest.number,
		pullRequestReviewerCount: reviewerCount,
		pullRequestTitle: pullRequest.title,
		pullRequestUpdatedLabel: updatedLabel,
		pullRequestUrl: `https://github.com/${repository}/pull/${pullRequest.number}`,
		repository,
		targetBranch: "main",
	};
}

/** Board status for the issue a session names, when that work item is on the timeline. */
export function toPulseSessionIssueStatus(
	issueKey: string,
	workItems: readonly PulseWorkItem[],
): string | undefined {
	return workItems.find((item) => item.key === issueKey)?.status;
}

/**
 * Maps one window's loose work onto agent-list rows for the local sessions.
 *
 * GitHub artifacts are skipped. A session whose members are all unknown to the
 * roster still renders: the row leads with the coding agent, not a teammate, so
 * a missing invoker is omission rather than a faceless row. Invoker stays on
 * the row for flyouts; the metadata chip always shows the devices glyph and
 * machine name. When `workItems` is passed, the session's issue key is resolved
 * onto that work item's board status so the untracked-work flyout chip can
 * show it.
 */
export function toPulseSessionItems(
	looseWork: readonly PulseLooseWork[],
	members: readonly PulseMember[],
	workItems: readonly PulseWorkItem[] = [],
): readonly AgentSessionItem[] {
	const byId = new Map(members.map((member) => [member.id, member]));

	return looseWork.flatMap((item) => {
		if (!isPulseAgentSession(item)) {
			return [];
		}

		const invoker = item.memberIds
			.map((id) => byId.get(id))
			.find((member) => member !== undefined && member.kind === "human");
		const worktree = toPulseSessionWorktree(item.detail);
		const issueStatus = item.issueStatus
			?? toPulseSessionIssueStatus(item.sourceTitle, workItems);

		return [{
			agent: toPulseSessionAgent(item.agentId),
			host: "local",
			id: item.id,
			invokedBy: invoker === undefined
				? undefined
				: {
					avatarSrc: invoker.avatarSrc,
					name: invoker.name,
				},
			machineName: item.machineName,
			prStatus: item.pullRequest?.status,
			sessionDetails: {
				host: "local",
				issueKey: item.sourceTitle,
				issueSummary: item.title,
				...(issueStatus === undefined ? {} : { issueStatus }),
				...(item.pullRequest === undefined
					? {}
					: toPulseSessionPullRequestDetails(item.pullRequest)),
				worktreePath: worktree,
			},
			shortTitle: item.shortTitle,
			state: item.state ?? "complete",
			timeLabel: item.timeLabel,
			title: item.title,
		} satisfies AgentSessionItem];
	});
}

/**
 * Loose work attributable to the selected roster member.
 *
 * The board header's assignee filter narrows the status columns, so it has to
 * narrow the untracked-work column too — otherwise picking one person hides
 * their teammates' cards while leaving every teammate's session on screen, and
 * the filter stops describing the whole board.
 *
 * It takes the *roster-resolved* member id rather than the raw assignee set on
 * purpose. The assignee field carries ids from whichever facepile wrote it, and
 * only some of those name a Pulse member — that is what `toPulseMemberId` is
 * for. Matching the raw ids instead would empty the column for every selection
 * made in the other id space, asserting "nobody has untracked sessions" when
 * the truth is that the selection cannot be expressed in this roster at all.
 * `null` means no roster member is selected, which is not the same as "nobody
 * matched".
 */
export function filterPulseLooseWorkByMember(
	looseWork: readonly PulseLooseWork[],
	memberId: string | null,
): readonly PulseLooseWork[] {
	if (memberId === null) {
		return looseWork;
	}

	return looseWork.filter((item) => item.memberIds.includes(memberId));
}

/**
 * The Agent Session callbacks for a set of Pulse loose work.
 *
 * The card speaks `AgentSessionItem`; every Pulse action speaks
 * `PulseLooseWork`. Translating between them is a rule, not a rendering
 * detail — resume is gated on host capability *and* on the row still resolving
 * to a known session — so it lives here once and is shared by every surface
 * that shows these sessions (the Insights rail and the board's untracked-work
 * column). A second hand-rolled copy is how the two would drift.
 *
 * Create, link, and add-as-subtask all capture: the prototype has one capture
 * path, the same one uncaptured GitHub cards already use. Omitting create or
 * subtask is what greyed those flyout actions out.
 *
 * Continue-in is a separate host capability from resume. Resume copies a
 * terminal prompt and is gated on the viewer's machine. Continue-in reopens
 * the session in its agent. The menu already hides that row for cloud hosts;
 * this adapter only omits the callback when the host did not supply one.
 */
export function toPulseSessionHandlers({
	isLooseWorkResumable,
	looseWork,
	onCapture,
	onContinue,
	onResume,
}: Readonly<{
	isLooseWorkResumable?: (item: PulseLooseWork) => boolean;
	looseWork: readonly PulseLooseWork[];
	onCapture: (item: PulseLooseWork) => void;
	onContinue?: (item: PulseLooseWork) => void;
	onResume?: (item: PulseLooseWork) => void;
}>) {
	const sessionById = new Map(
		looseWork.filter(isPulseAgentSession).map((item) => [item.id, item] as const),
	);
	const captureSession = (item: AgentSessionItem) => {
		const session = sessionById.get(item.id);
		if (session === undefined) return;
		onCapture(session);
	};
	const resolveResumable = (item: AgentSessionItem): PulseLooseWork | undefined => {
		if (onResume === undefined) return undefined;
		const session = sessionById.get(item.id);
		if (session === undefined) return undefined;
		return (isLooseWorkResumable?.(session) ?? true) ? session : undefined;
	};
	const continueSession = onContinue === undefined
		? undefined
		: (item: AgentSessionItem) => {
			const session = sessionById.get(item.id);
			if (session === undefined) return;
			onContinue(session);
		};

	return {
		isResumable: (item: AgentSessionItem) => resolveResumable(item) !== undefined,
		onContinueInAgent: continueSession,
		onCopyResume: onResume === undefined ? undefined : (item: AgentSessionItem) => {
			const session = resolveResumable(item);
			if (session === undefined) return;
			onResume(session);
		},
		onCreateWorkItem: captureSession,
		onLinkWorkItem: captureSession,
		onSubtasks: captureSession,
		onView: onResume === undefined ? undefined : (item: AgentSessionItem) => {
			const session = resolveResumable(item);
			if (session === undefined) return;
			onResume(session);
		},
	};
}
