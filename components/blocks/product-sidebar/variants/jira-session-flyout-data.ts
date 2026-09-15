import {
	toPullRequestSmartLink,
	type PullRequestSmartLinkStatus,
	type SmartLinkItem,
} from "@/components/blocks/smart-link";
import type { LozengeProps } from "@/components/ui/lozenge";
import { createHoverCardHandle } from "@/components/ui/hover-card-handle";
import { toCompactRelativeTimeLabel } from "@/lib/elapsed-time";
import type {
	JiraSidebarSessionChecks,
	JiraSidebarSessionItem,
	JiraSidebarSessionStatus,
} from "./jira";

export function createJiraSessionFlyoutHandle() {
	return createHoverCardHandle<JiraSidebarSessionItem>();
}

/** Stable relative "updated" label per session state (demo data only). */
export const JIRA_SESSION_UPDATED_LABEL: Record<JiraSidebarSessionStatus, string> = {
	"awaiting-input": toCompactRelativeTimeLabel("2d ago"),
	running: toCompactRelativeTimeLabel("3m ago"),
	"pr-open": toCompactRelativeTimeLabel("1h ago"),
	merged: toCompactRelativeTimeLabel("5h ago"),
	stopped: toCompactRelativeTimeLabel("1d ago"),
};

export type JiraSessionFlyoutState = "needs-input" | "working" | "finished";

export const JIRA_SESSION_FLYOUT_STATE: Record<JiraSidebarSessionStatus, JiraSessionFlyoutState> = {
	"awaiting-input": "needs-input",
	running: "working",
	"pr-open": "finished",
	merged: "finished",
	stopped: "finished",
};

export const JIRA_SESSION_FLYOUT_STATE_LABEL: Record<JiraSessionFlyoutState, string> = {
	"needs-input": "Needs input",
	working: "Working",
	finished: "Finished",
};

export function prStateLozenge(status: JiraSidebarSessionStatus): { label: string; variant: LozengeProps["variant"] } {
	return status === "merged"
		? { label: "Merged", variant: "discovery" }
		: { label: "Open", variant: "success" };
}

export function formatSessionChecks(checks: JiraSidebarSessionChecks): string {
	const total = checks.passed + checks.failed;
	return checks.failed > 0
		? `${checks.passed}/${total} passed ${checks.failed} failed`
		: `${checks.passed}/${total} passed`;
}

/** Session lifecycle → Smart Link PR status used by the flyout Artifacts chip. */
export function toSessionPullRequestSmartLinkStatus(
	status: JiraSidebarSessionStatus,
): PullRequestSmartLinkStatus {
	switch (status) {
		case "merged":
			return "Merged";
		case "stopped":
			return "Failed";
		case "awaiting-input":
		case "running":
		case "pr-open":
			return "Open";
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

/** Builds the GitHub pull-request Smart Link for a session, or `null` when none exists. */
export function toSessionPullRequestSmartLink(
	session: JiraSidebarSessionItem,
): SmartLinkItem | null {
	if (session.pullRequestNumber === undefined) {
		return null;
	}

	const title = session.pullRequestTitle
		?? (session.issueKey.length > 0
			? `${session.issueKey}: ${session.issueSummary}`
			: session.issueSummary);
	const item = toPullRequestSmartLink({
		id: `${session.id}-pull-request`,
		number: session.pullRequestNumber,
		title,
		status: toSessionPullRequestSmartLinkStatus(session.status),
		additions: session.additions ?? 0,
		deletions: session.deletions ?? 0,
		files: session.files,
		repository: session.repository,
		branch: session.branch,
		targetBranch: session.targetBranch,
		href: session.pullRequestUrl,
		author: session.pullRequestAuthor ?? session.invokedBy,
		description: session.pullRequestDescription,
	});

	if (session.additions === undefined && session.deletions === undefined) {
		return { ...item, codeStats: undefined };
	}

	return item;
}

/** Artifacts the session flyout card renders as Smart Links. */
export function sessionArtifactItems(session: JiraSidebarSessionItem): SmartLinkItem[] {
	const pullRequest = toSessionPullRequestSmartLink(session);
	return pullRequest === null ? [] : [pullRequest];
}
