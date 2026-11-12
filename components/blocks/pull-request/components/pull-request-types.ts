import type { PullRequestCheck } from "@/components/blocks/pull-request/components/pull-request-checks-list";
import type { AgentListAgent } from "@/components/blocks/agent-list/agent-list-types";

export type PullRequestStatus = "Open" | "Merged" | "Draft" | "Failed";

/**
 * Card layout. `dropdown` is the compact two-row list card used in select
 * menus (title + trailing status, then GitHub branch path and diff metrics).
 * `spacious` is the three-row dropdown/summary card (title + trailing
 * status, GitHub branch path, author/diff footer). `flyout` is the overlay
 * summary card: title + lozenge, author · time, then a divided GitHub branch
 * path and files / diff footer.
 */
export type PullRequestVariant = "dropdown" | "spacious" | "flyout";

export interface PullRequestAuthor {
	name: string;
	avatarUrl?: string;
	/** Agent that assisted the human author, shown alongside their avatar. */
	assistedBy?: Pick<AgentListAgent, "name" | "avatarSrc" | "brandName" | "vpkLogo">;
}

/** Source-control host. Picks the provider mark on the flyout repository / branch row. */
export type PullRequestProvider = "github" | "bitbucket";

/** Reviewer sign-off, shown on the flyout as `0/1 reviewer` (or `No reviewers` at total 0). */
export interface PullRequestReviewers {
	approved: number;
	total: number;
}

export interface PullRequestProps {
	/** Layout. Defaults to the compact dropdown list card. */
	variant?: PullRequestVariant;
	/** Flyout only. Omit the lower metadata and actions section when false. */
	showDetails?: boolean;
	/** Pull request number (shown as `#1306` in subtle text). */
	number: number;
	/** Pull request title (shown after the number). */
	title: string;
	/** Review state shown as a status lozenge. */
	status: PullRequestStatus;
	/** Author shown as a circular avatar, and on the flyout as name · time. */
	author?: PullRequestAuthor;
	/** Source / head branch name shown before the arrow. */
	branch?: string;
	/** Target / base branch name shown after the arrow (e.g. `main`). */
	targetBranch?: string;
	additions: number;
	deletions: number;
	/** Number of changed files, rendered as `N files` on every card. */
	filesChanged?: number;
	/** Flyout only. Provider mark for the repository row. Defaults to `github`. */
	provider?: PullRequestProvider;
	/** Flyout only. Reviewer sign-off, appended to the `Name · time` line. Omitted when absent. */
	reviewers?: PullRequestReviewers;
	/** Flyout only. `workspace/repo` shown beside the provider mark. */
	repository?: string;
	/**
	 * Flyout only. CI checks. The row reads `3/3 builds passed` and expands inline into
	 * the full checks list. Omitted when absent or empty.
	 */
	checks?: readonly PullRequestCheck[];
	/** Flyout only. Whether the CI summary can reveal individual checks. */
	checksExpandable?: boolean;
	/** Flyout only. Renders the primary Review action as a link. Omitted without it. */
	reviewHref?: string;
	/** Flyout only. Show a Review button when no review destination is available. */
	showReview?: boolean;
	/** Flyout only. Makes the pull request title an external link. */
	href?: string;
	/** Called with failing CI checks when Fix PR is activated. */
	onFix?: (checks: readonly PullRequestCheck[]) => void;
	/** Flyout only. Whether to show the Fix PR action for failing checks. */
	showFix?: boolean;
	/** Flyout only. A fix is in progress, so the Fix PR action stays visible and disabled. */
	isFixing?: boolean;
	/**
	 * Absolute timestamp (ms). Reserved for callers that already track PR age;
	 * the card renders `relativeTime` when provided.
	 */
	timestampMs?: number;
	/** Static relative label. Rendered on the flyout as `Name · relativeTime`. Ignored by dropdown variants. */
	relativeTime?: string;
	/** Marks the card as the active selection, including read-only summaries. */
	selected?: boolean;
	/**
	 * On dropdown and spacious cards, activates a pressed button (select-to-open).
	 * The flyout stays a container for its links and actions.
	 */
	onActivate?: () => void;
	className?: string;
}
