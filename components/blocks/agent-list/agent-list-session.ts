import type {
	JiraSidebarSessionItem,
	JiraSidebarSessionStatus,
} from "@/components/blocks/product-sidebar/variants/jira";

import type { AgentListHost, AgentListItem, AgentListState } from "./agent-list-types";

/**
 * Where a row's session runs. The row field wins; `sessionDetails.host` is the
 * flyout-era fallback so older payloads still resolve without duplicating host
 * onto every consumer.
 */
export function getAgentListHost(item: AgentListItem): AgentListHost {
	return item.host ?? item.sessionDetails?.host ?? "cloud";
}

/** Local sessions surface a device chip instead of a live runtime and agent name. */
export function isLocalAgentListItem(item: AgentListItem): boolean {
	return getAgentListHost(item) === "local";
}

/**
 * POSIX-safe shell argument. Values that are already made only of characters no
 * shell treats specially are left bare so the copied command stays readable;
 * anything else (spaces in a checkout path, `$`, quotes, …) is single-quoted,
 * with embedded single quotes closed and re-opened as `'\''`.
 */
const SHELL_SAFE_PATTERN = /^[A-Za-z0-9_@%+=:,./-]+$/u;

export function quoteShellArgument(value: string): string {
	if (SHELL_SAFE_PATTERN.test(value)) {
		return value;
	}
	return `'${value.replaceAll("'", String.raw`'\''`)}'`;
}

/**
 * Shell command that restores a local coding session in the viewer's terminal.
 * Prefers an explicit resume id when the fixture named one; otherwise the row
 * id. A worktree path, when present, is prefixed as `cd … &&`. Both values are
 * shell-quoted so a path such as `/Users/me/My Project` pastes correctly.
 */
export function toAgentListResumeCommand(item: AgentListItem): string {
	const resumeId = quoteShellArgument(item.sessionDetails?.resumeSessionId ?? item.id);
	const worktree = item.sessionDetails?.worktreePath?.trim();
	if (worktree === undefined || worktree.length === 0) {
		return `claude --resume ${resumeId}`;
	}

	return `cd ${quoteShellArgument(worktree)} && claude --resume ${resumeId}`;
}

/**
 * Agent coding sessions, as opposed to person rows (comments, @mentions).
 * Coding rows always keep the hover View / Resume actions; `canViewItem` may
 * still hide Reply on a person row.
 */
export function isCodingAgentListItem(item: AgentListItem): boolean {
	return (item.agent.kind ?? "agent") !== "person";
}

/**
 * Boundary between the agent-session row model (`AgentListItem`) and the
 * canonical Jira session flyout model (`JiraSidebarSessionItem`).
 *
 * The row model is deliberately lean — it only carries what a single-line
 * session row renders. The flyout is the richer surface, so anything it needs
 * that the row does not already know (issue key, repository, pull request,
 * checks, …) arrives through `item.sessionDetails` and everything else is
 * derived here. Keeping the derivation in one pure function means the card
 * never reaches into flyout-shaped fields itself.
 */

/**
 * Derives a Jira-style issue key from an agent-session branch:
 * `rovo/vita-142-vision-deck` → `VITA-142`. Falls back to the raw branch when
 * the pattern does not match, so the flyout still names something real, and to
 * an empty string for rows that carry no branch — those are not agent sessions
 * and never open the session flyout.
 */
export function deriveIssueKeyFromBranch(branch: string | undefined): string {
	if (branch === undefined) {
		return "";
	}
	const match = /^rovo\/([a-z]+)-(\d+)-/.exec(branch);
	return match ? `${match[1].toUpperCase()}-${match[2]}` : branch;
}

/**
 * Status copy for the states that wait on the viewer. Both share the
 * needs-input treatment (shimmer, dots, information icon) and differ only here.
 */
export function getWaitingStatusLabel(state: "needs-input" | "ready-for-review"): string;
export function getWaitingStatusLabel(state: AgentListState): string | undefined;
export function getWaitingStatusLabel(state: AgentListState): string | undefined {
	return state === "needs-input" ? "Needs input" : state === "ready-for-review" ? "Ready for review" : undefined;
}

/**
 * Row lifecycle → flyout lifecycle. The row model has no dedicated "PR open"
 * state, so a finished session borrows it from `prStatus`; a finished session
 * that never opened a PR reads as `merged` (work item Done) because that is the
 * only terminal-success status the flyout models. `attention` is a
 * notification, not a session, but it still reads as blocked on the viewer.
 */
export function toAgentSessionStatus(item: AgentListItem): JiraSidebarSessionStatus {
	switch (item.state) {
		case "needs-input":
		case "ready-for-review":
		case "attention":
			return "awaiting-input";
		case "running":
			return "running";
		case "complete": {
			switch (item.prStatus) {
				case "created":
					return "pr-open";
				case "failed":
					return "stopped";
				case "merged":
				case undefined:
					return "merged";
			}
		}
	}
}

/** Maps a session row onto the payload the shared Jira session flyout renders. */
export function toAgentSessionFlyoutItem(item: AgentListItem): JiraSidebarSessionItem {
	const details = item.sessionDetails;

	return {
		...details,
		agentAvatarSrc: item.agent.avatarSrc,
		agentName: item.agent.name,
		// The row owns who started the session. Keep that person distinct from
		// the Jira work-item assignee while carrying the header avatar into the
		// shared flyout payload.
		...(item.invokedBy === undefined
			? {}
			: {
				invokedBy: {
					name: item.invokedBy.name,
					...(item.invokedBy.avatarSrc === undefined ? {} : { src: item.invokedBy.avatarSrc }),
				},
			}),
		...(item.agent.brandName === undefined ? {} : { brandName: item.agent.brandName }),
		...(item.agent.vpkLogo === undefined ? {} : { vpkLogo: item.agent.vpkLogo }),
		branch: details?.branch ?? item.branch,
		completedAtMs: item.completedAtMs,
		completedSecondsAgo: item.completedSecondsAgo,
		host: getAgentListHost(item),
		id: item.id,
		initialElapsedSeconds: item.elapsedSeconds,
		issueKey: details?.issueKey ?? deriveIssueKeyFromBranch(item.branch),
		issueSummary: details?.issueSummary ?? item.title,
		startedAtMs: item.startedAtMs,
		status: toAgentSessionStatus(item),
		title: item.title,
	};
}
