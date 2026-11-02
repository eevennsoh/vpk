import type { AgentListItem } from "@/components/blocks/agent-list";
import type { ArtifactListItem } from "@/components/ui-custom/artifact-list";
import type { ThirdPartyLogoName } from "@/components/ui/data/logo-third-party-data";
import type { LozengeProps } from "@/components/ui/lozenge";
import type { TagColor } from "@/components/ui/tag";

/**
 * Who performed an activity. Drives the leading timeline visual:
 * `person` → circular photo avatar, `agent` → hexagon agent art,
 * `app` → third-party brand mark (e.g. GitHub).
 */
export type JiraActivityActorKind = "person" | "agent" | "app";

export interface JiraActivityActor {
	id: string;
	name: string;
	kind: JiraActivityActorKind;
	/** Person photo or 1P agent art under `public/`. */
	avatarSrc?: string;
	/** Canonical VPK product mark for platform-owned actors such as Rovo. */
	vpkLogo?: "rovo";
	/** Third-party brand mark for `app` actors, rendered via `LogoThirdParty`. */
	brandName?: ThirdPartyLogoName;
}

/**
 * Leading glyph for an event row. Most are neutral ADS icons; platform services
 * can use their canonical branded mark. When omitted, the actor avatar is shown.
 */
export type JiraActivityEventIcon =
	| "created"
	| "assigned"
	| "label"
	| "sla"
	| "status"
	| "delegated"
	| "in-progress"
	| "linked"
	| "description"
	| "teamwork-graph"
	| "commit"
	| "pull-request"
	/** Connected-app event glyph (e.g. GitHub checks / ready-to-merge). */
	| "app";

export type JiraActivityPriority = "Highest" | "High" | "Medium" | "Low" | "Lowest";

/**
 * A rich inline text run. Shared by event action lines and comment bodies so
 * the code/link/lozenge/tag styling lives in one renderer.
 */
export type JiraActivitySegment =
	| { type: "text"; text: string }
	| { type: "code"; text: string }
	| { type: "link"; text: string; href?: string }
	/** Circular user mention chip for humans (e.g. Venn, Maya Chen). */
	| { type: "user-mention"; text: string; avatarSrc?: string }
	| {
			type: "agent-mention";
			text: string;
			avatarSrc?: string;
			brandName?: ThirdPartyLogoName;
			vpkLogo?: "rovo";
		}
	/**
	 * Product mention chip for connected apps (e.g. GitHub). Renders a
	 * `BrandLogoMark` product tag — not a hexagon agent avatar.
	 */
	| { type: "app-mention"; text: string; brandName?: ThirdPartyLogoName }
	| {
			type: "lozenge";
			text: string;
			variant?: NonNullable<LozengeProps["variant"]>;
		}
	| { type: "label"; text: string; color: TagColor }
	| { type: "tag"; text: string; color?: TagColor }
	| { type: "transition-arrow" }
	| { type: "priority"; text: JiraActivityPriority };

interface JiraActivityEntryBase {
	id: string;
	actor: JiraActivityActor;
	/** Human-readable relative time, e.g. "15min ago". */
	timestamp: string;
	/** Optional chronological timestamp used when entries from multiple sources are merged. */
	createdAtMs?: number;
	/** Cross-cutting feed category. Insights share the Activity spine but can be filtered. */
	category?: "insight";
}

/** A compact single-line event on the timeline spine. */
export interface JiraActivityEventEntry extends JiraActivityEntryBase {
	kind: "event";
	/** Leading event glyph; when omitted the actor avatar is shown instead. */
	icon?: JiraActivityEventIcon;
	/** Hide the leading actor name for event content represented by its own tags. */
	showActor?: boolean;
	/** Hide the relative timestamp for event content that is intentionally self-contained. */
	showTimestamp?: boolean;
	segments: readonly JiraActivitySegment[];
	/** Optional compact pull-request metadata shown in place of the standard action line. */
	pullRequest?: {
		number: number;
		title: string;
		status: "Open" | "Merged";
		additions: number;
		deletions: number;
		/** Optional owner/name path shown on phase-section PR cards (e.g. `acme/storefront`). */
		repository?: string;
		/** Optional source / head branch shown on Pull Request block cards. */
		branch?: string;
		/** Optional target / base branch shown after the arrow on PR cards. */
		targetBranch?: string;
		/** Optional absolute URL for the pull request (Smart Link href). */
		url?: string;
		/** When the pull request was opened (ms). Used by Pull requests sort modes. */
		createdAtMs?: number;
		/** Most recent pull-request activity (ms). Falls back to `createdAtMs` when sorting. */
		updatedAtMs?: number;
		/**
		 * Display name of the PR author (or primary involver). Compared to the
		 * signed-in viewer for the Pull requests "By me" sort.
		 */
		authorName?: string;
		/** Optional avatar for the PR author on Pull Request list/select rows. */
		authorAvatarSrc?: string;
		/** Provider-normalized review outcome for contextual PR details. */
		reviewDecision?: "approved" | "changes-requested" | "review-required" | "not-required";
		/** Provider-normalized reviewer states when individual approvals are available. */
		reviewers?: readonly {
			id: string;
			name: string;
			avatarSrc?: string;
			status: "approved" | "changes-requested" | "commented" | "pending";
		}[];
		/** Provider-normalized mergeability for contextual PR details. */
		mergeState?: "ready" | "blocked" | "conflicts" | "merged";
		/** Commit summaries returned by the connected SCM. */
		commits?: readonly {
			id: string;
			shortSha: string;
			title: string;
			author: {
				id: string;
				name: string;
				avatarSrc?: string;
			};
			timestamp: string;
			additions: number;
			deletions: number;
			/** SCM commit page URL for the short SHA. */
			url?: string;
		}[];
		/** CI/check-run summaries returned by the connected SCM. */
		checks?: readonly {
			id: string;
			name: string;
			status: "passed" | "failed" | "running" | "queued";
			details: string;
			/** SCM check-run / Actions URL for the check details page. */
			url?: string;
		}[];
	};
}

export interface JiraActivityReply {
	id: string;
	actor: JiraActivityActor;
	timestamp: string;
	createdAtMs?: number;
	body: string;
	reactions?: readonly JiraActivityReaction[];
	/** Optional agent-session summary used to open an embedded Rovo chat. */
	sessionItem?: AgentListItem;
}

export interface JiraActivityCollapsible {
	label: string;
	content: readonly JiraActivitySegment[];
}

/** One read-only progress step maintained by an agent in its lead comment. */
export interface JiraActivityProgressItem {
	id: string;
	label: string;
	completed: boolean;
}

/** A generated image shown inline as evidence attached to a comment. */
export interface JiraActivityImageAttachment {
	src: string;
	alt: string;
	filename: string;
	/** Optional preview destination; defaults to the image source. */
	href?: string;
}

/** One emoji reaction on a comment, keyed by glyph. */
export interface JiraActivityReaction {
	emoji: string;
	/** Actor ids that reacted, in first-reacted order. */
	actorIds: readonly string[];
}

/** A comment card with a rich body, optional collapsible, and replies. */
export interface JiraActivityCommentEntry extends JiraActivityEntryBase {
	kind: "comment";
	/** Optional parent activity for inline review comments nested under a review summary. */
	parentId?: string;
	/** Optional trailing tag on the header, e.g. "Automation". */
	tag?: { text: string; color?: TagColor };
	/** Optional semantic review decision shown as a lozenge beside the timestamp. */
	statusLozenge?: {
		text: string;
		variant: NonNullable<LozengeProps["variant"]>;
	};
	body: readonly JiraActivitySegment[];
	/** Optional collapsible detail section (e.g. "Investigation"). */
	collapsible?: JiraActivityCollapsible;
	/** Agent-owned progress steps, rendered as a compact read-only checklist. */
	progressChecklist?: readonly JiraActivityProgressItem[];
	/** Compact artifact rows (code/PR, docs) attached to the comment. */
	outputs?: readonly ArtifactListItem[];
	/** Optional generated image evidence attached to the comment. */
	imageAttachment?: JiraActivityImageAttachment;
	replies?: readonly JiraActivityReply[];
	/**
	 * Initial expand state for replies. Top-level comments default to expanded;
	 * comments with a `parentId` default to collapsed so only one nested level is visible.
	 */
	defaultRepliesExpanded?: boolean;
	/** Keep the latest N replies visible while collapsed; omit for collapse-all behavior. */
	replyPreviewCount?: number;
	/** Emoji reactions on this comment, in first-reacted order. */
	reactions?: readonly JiraActivityReaction[];
	/** Render the reply composer under this comment. Defaults to `true`. */
	allowReply?: boolean;
	/**
	 * PR review-thread resolve state. Only meaningful when `allowResolve` is true.
	 * Resolved threads hide reply/reaction controls and label the latest reply timestamp.
	 */
	resolved?: boolean;
	/**
	 * Show Resolve / Unresolve (SCM review discussion threads). Defaults to
	 * `false` so Jira work-item comments stay reply/reaction-only.
	 */
	allowResolve?: boolean;
	/** Optional Agent List summary for the expanded activity-card header. */
	sessionItem?: AgentListItem;
}

/** A bordered card summarizing a code change, with a branch/PR reference. */
export interface JiraActivityChangedFilesEntry extends JiraActivityEntryBase {
	kind: "changed-files";
	tag?: { text: string; color?: TagColor };
	/** Optional agent-session summary for output-list cards. */
	sessionItem?: AgentListItem;
	/** Artifacts produced by the session, rendered as compact output rows. */
	outputs?: readonly ArtifactListItem[];
	/** Headline, e.g. "Changed 2 files". */
	summary: string;
	/** Muted description of the change. */
	description: string;
	/** Optional branch/PR reference, e.g. "#78672". */
	branch?: string;
}

export type JiraActivityEntry =
	| JiraActivityEventEntry
	| JiraActivityCommentEntry
	| JiraActivityChangedFilesEntry;

/** Timeline ordering: `ascending` = oldest first, `descending` = newest first. */
export type JiraActivitySortOrder = "ascending" | "descending";

/**
 * Timeline filtering for the Activities view control.
 * - `all` — every entry (used with Latest/Oldest sort)
 * - `agents-only` — agent-authored comments and generated-output cards
 * - `needs-input` — entries awaiting viewer input (`sessionItem.state === "needs-input"`)
 * - `comments-only` — human and agent comment cards only
 * - `history-only` — work item changes and other non-comment events
 * - `insights-only` — captured insight/decision rows on the shared Activity timeline
 */
export type JiraActivityFilter =
	| "all"
	| "agents-only"
	| "needs-input"
	| "comments-only"
	| "history-only"
	| "insights-only";
